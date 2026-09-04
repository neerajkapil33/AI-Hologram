import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AvatarRuntime } from './avatar/rig/AvatarRuntime.js';

export type AvatarCommand =
  | { type: 'expression'; value: string }
  | { type: 'viseme'; value: string; weight?: number }
  | { type: 'gesture'; value: string }
  | { type: 'performance'; value: any };

type AvatarApi = { command: (cmd: AvatarCommand) => void };
type Props = { onStatus?: (s: string) => void; onApi?: (api: AvatarApi) => void };

// The repository contains a real GLTF + external binary/texture payload under
// /profile. Prefer the production GLB when it exists, but never block the
// experience just because the GLTF is not skinned/morph-rigged yet.
const AVATAR_SOURCES = ['/avatar/avatar.glb', '/profile/scene.gltf'];
const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');

export default function AvatarEngine({ onStatus, onApi }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<AvatarApi | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
    camera.position.set(0, 1.55, 3.1);
    camera.lookAt(0, 1.35, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x101522, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 3.2);
    key.position.set(1.5, 3, 3);
    key.castShadow = true;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x55aaff, 2.4);
    rim.position.set(-2, 2, -2);
    scene.add(rim);
    const fill = new THREE.PointLight(0x38a8ff, 1.8, 6);
    fill.position.set(0, 1.4, 1.2);
    scene.add(fill);

    let model: THREE.Object3D | null = null;
    let runtime: AvatarRuntime | null = null;
    let speaking = false;
    let expression = 'neutral';
    let gesture = 'idle';
    let perf: any = { intensity: 0.35, gaze: 'camera', head: '', body: '' };
    let blinkTimer = 0;
    let blinkUntil = 0;
    let modelBaseY = 0;
    let modelBaseScale = 1;
    const clock = new THREE.Clock();
    const setStatus = (s: string) => onStatus?.(s);
    const loader = new GLTFLoader();

    const prepareModel = (root: THREE.Object3D) => {
      // Frame any valid GLTF automatically. This is important for models whose
      // authoring origin/scale differs from the hologram stage.
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const height = Math.max(size.y, 0.01);
      const targetHeight = 2.45;
      modelBaseScale = targetHeight / height;
      root.scale.setScalar(modelBaseScale);
      root.position.sub(center.multiplyScalar(modelBaseScale));
      const framed = new THREE.Box3().setFromObject(root);
      modelBaseY = -framed.min.y + 0.02;
      root.position.y += modelBaseY;

      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const raw = mesh.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
        for (const material of Array.isArray(raw) ? raw : [raw]) {
          if (!material) continue;
          material.metalness = Math.min(material.metalness ?? 0, 0.2);
          material.roughness = Math.max(material.roughness ?? 0.5, 0.3);
          // Subtle emissive lift gives the model the requested hologram presence
          // while retaining its original skin/clothing textures.
          material.emissive = new THREE.Color(0x0b3158);
          material.emissiveIntensity = 0.22;
        }
      });
    };

    const loadSource = (index: number) => {
      const source = AVATAR_SOURCES[index];
      setStatus(`LOADING • NEERAJ 3D AVATAR ${index + 1}/${AVATAR_SOURCES.length}`);
      loader.load(source, (gltf) => {
        const candidate = gltf.scene;
        prepareModel(candidate);
        model = candidate;
        scene.add(model);
        runtime = new AvatarRuntime(model, gltf.animations);
        const report = runtime.report();
        const meshCount = report.morphMeshes + report.skinnedMeshes;
        if (meshCount === 0 && index + 1 < AVATAR_SOURCES.length) {
          scene.remove(model);
          model = null;
          runtime = null;
          loadSource(index + 1);
          return;
        }
        setStatus(`NEERAJ 3D AVATAR READY • ${report.skinnedMeshes} SKINNED • ${report.bones} BONES • ${report.morphTargets} MORPHS • ${gltf.animations.length} ANIMATIONS`);
      }, (progress) => {
        if (progress.total > 0) setStatus(`LOADING • NEERAJ 3D AVATAR ${Math.round((progress.loaded / progress.total) * 100)}%`);
      }, (error) => {
        console.error(`Avatar source failed: ${source}`, error);
        if (index + 1 < AVATAR_SOURCES.length) loadSource(index + 1);
        else setStatus('3D AVATAR LOAD FAILED • CHECK GLTF, BIN AND TEXTURES');
      });
    };
    loadSource(0);

    const command = (cmd: AvatarCommand) => {
      if (cmd.type === 'expression') expression = cmd.value;
      if (cmd.type === 'gesture') gesture = cmd.value;
      if (cmd.type === 'performance') {
        perf = { ...perf, ...(cmd.value ?? {}) };
        if (typeof cmd.value?.speaking === 'boolean') speaking = cmd.value.speaking;
      }
      if (cmd.type === 'viseme' && runtime) {
        const v = norm(cmd.value);
        const w = cmd.weight ?? 1;
        const aliases = [`viseme_${v}`, v];
        if (['aa', 'ah'].includes(v)) aliases.push('jawOpen', 'mouthOpen');
        if (['ou', 'u', 'o'].includes(v)) aliases.push('mouthPucker', 'mouthFunnel');
        if (['pp', 'mm', 'bb'].includes(v)) aliases.push('mouthClose');
        runtime.setFirstAvailable(aliases, w);
      }
      if (cmd.type === 'gesture' && ['wave', 'bye_wave'].includes(cmd.value)) setStatus('NEERAJ 3D AVATAR • GREETING');
    };

    apiRef.current = { command };
    onApi?.(apiRef.current);

    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.05);
      runtime?.update(dt);
      const t = performance.now() / 1000;
      blinkTimer += dt;

      if (blinkTimer > 3.2 + Math.random() * 2.7) {
        blinkTimer = 0;
        blinkUntil = t + 0.14;
      }
      const blink = blinkUntil > t ? Math.sin(((blinkUntil - t) / 0.14) * Math.PI) : 0;

      if (runtime) {
        runtime.setFirstAvailable(['eyeBlinkLeft', 'eyeBlink', 'blink'], blink);
        runtime.setFirstAvailable(['eyeBlinkRight', 'eyeBlink', 'blink'], blink);
        if (!speaking) runtime.setFirstAvailable(['jawOpen', 'mouthOpen', 'viseme_sil'], 0);

        const happy = expression === 'happy' || expression === 'excited' || expression === 'celebrating';
        runtime.setFirstAvailable(['mouthSmileLeft', 'mouthSmile', 'smile'], happy ? 0.42 : 0);
        runtime.setFirstAvailable(['mouthSmileRight', 'mouthSmile', 'smile'], happy ? 0.42 : 0);

        const head = runtime.bone(['head']);
        const neck = runtime.bone(['neck']);
        const spine = runtime.bone(['spine', 'chest', 'upperchest']);
        const leftArm = runtime.bone(['leftupperarm', 'left_arm', 'leftarm']);
        const rightArm = runtime.bone(['rightupperarm', 'right_arm', 'rightarm']);
        const intensity = clamp(Number(perf.intensity ?? 0.35));

        if (head) {
          const look = perf.gaze === 'camera' || perf.gaze === 'direct' ? Math.sin(t * 0.55) * 0.035 : Math.sin(t * 0.32) * 0.015;
          head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, look, 0.035);
          head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, perf.head?.includes?.('tilt') ? 0.025 : 0, 0.04);
          if (gesture === 'nod' || gesture === 'acknowledge') head.rotation.x = Math.sin(t * 3.1) * 0.035;
        }
        if (neck) neck.rotation.y = THREE.MathUtils.lerp(neck.rotation.y, Math.sin(t * 0.4) * 0.012, 0.02);
        if (spine) spine.rotation.x = THREE.MathUtils.lerp(spine.rotation.x, perf.body?.includes?.('lean') ? -0.035 * intensity : 0, 0.025);

        const arm = 0.18 + intensity * 0.32;
        if (rightArm) rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, ['open_hand', 'explain', 'enumerate', 'emphasis', 'wave', 'bye_wave'].includes(gesture) ? -arm : gesture === 'namaste' || gesture === 'clap' ? -0.3 : 0, 0.06);
        if (leftArm) leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, ['namaste', 'clap', 'contrast'].includes(gesture) ? arm * 0.9 : 0, 0.06);
      }

      // Procedural micro-motion keeps a valid static GLTF alive even before a
      // production skeletal animation set is attached.
      if (model) {
        const idle = Math.sin(t * 1.15) * 0.006;
        const talking = speaking ? Math.sin(t * 5.2) * 0.008 : 0;
        model.position.y = modelBaseY + idle + talking;
        model.rotation.y = THREE.MathUtils.lerp(model.rotation.y, Math.sin(t * 0.38) * 0.035, 0.025);
        const scalePulse = 1 + Math.sin(t * 1.7) * 0.0025;
        model.scale.setScalar(modelBaseScale * scalePulse);
      }

      renderer.render(scene, camera);
    });

    const resize = () => {
      const w = mount.clientWidth || 1;
      const h = mount.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      apiRef.current = null;
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, [onApi, onStatus]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%', minHeight: 420 }} />;
}
