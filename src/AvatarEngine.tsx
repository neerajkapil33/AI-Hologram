import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type AvatarCommand =
  | { type: 'expression'; value: string }
  | { type: 'viseme'; value: string; weight?: number }
  | { type: 'gesture'; value: string }
  | { type: 'performance'; value: any };

type AvatarApi = { command: (cmd: AvatarCommand) => void };

type Props = { onStatus?: (s: string) => void; onApi?: (api: AvatarApi) => void };

const LOCAL_NEERAJ_GLB = '/avatar/avatar.glb';
const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));

export default function AvatarEngine({ onStatus, onApi }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<AvatarApi | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
    camera.position.set(0, 1.62, 3.15);
    camera.lookAt(0, 1.45, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x182030, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 3.2); key.position.set(1.5, 3, 3); scene.add(key);
    const rim = new THREE.DirectionalLight(0x6ab6ff, 2.0); rim.position.set(-2, 2, -2); scene.add(rim);

    let model: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let speaking = false;
    let expression = 'neutral';
    let gesture = 'idle';
    let perf: any = { intensity: 0.35, gaze: 'camera', head: '', body: '' };
    let blinkTimer = 0;
    let blinkUntil = 0;
    const clock = new THREE.Clock();

    const morphMeshes: THREE.Mesh[] = [];
    const morphAliases: Record<string, string[]> = {
      mouthOpen: ['mouthOpen', 'jawOpen', 'viseme_aa', 'viseme_AA'],
      smile: ['smile', 'mouthSmile', 'mouthSmileLeft', 'mouthSmileRight'],
      blink: ['blink', 'eyeBlink', 'eyeBlinkLeft', 'eyeBlinkRight', 'eyesClosed'],
      brow: ['brow', 'browInnerUp', 'browDownLeft', 'browDownRight'],
      pucker: ['mouthPucker', 'viseme_OU', 'viseme_ou'],
      funnel: ['mouthFunnel', 'viseme_O', 'viseme_oh'],
    };

    const setMorph = (keyName: string, weight: number) => {
      for (const mesh of morphMeshes) {
        const dict = mesh.morphTargetDictionary;
        const influences = mesh.morphTargetInfluences;
        if (!dict || !influences) continue;
        for (const alias of morphAliases[keyName] ?? [keyName]) {
          const index = dict[alias];
          if (index !== undefined) influences[index] = clamp(weight);
        }
      }
    };

    const findBone = (names: string[]): THREE.Object3D | null => {
      if (!model) return null;
      const wanted = names.map((n) => n.toLowerCase());
      let found: THREE.Object3D | null = null;
      model.traverse((obj: THREE.Object3D) => {
        if (found) return;
        const n = obj.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (wanted.some((w) => n === w || n.endsWith(w))) found = obj;
      });
      return found;
    };

    const setStatus = (s: string) => onStatus?.(s);
    const loader = new GLTFLoader();

    loader.load(LOCAL_NEERAJ_GLB, (gltf) => {
      model = gltf.scene;
      model.position.set(0, 0, 0);
      model.scale.setScalar(1);
      scene.add(model);
      model.traverse((obj: THREE.Object3D) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          const mat = mesh.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
          if (mat) {
            const materials = Array.isArray(mat) ? mat : [mat];
            for (const m of materials) { if (m) { m.metalness = Math.min(m.metalness ?? 0, 0.15); m.roughness = Math.max(m.roughness ?? 0.5, 0.32); } }
          }
          if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) morphMeshes.push(mesh);
        }
      });
      if (gltf.animations.length) {
        mixer = new THREE.AnimationMixer(model);
        for (const clip of gltf.animations) mixer.clipAction(clip).play();
      }
      const meshCount = morphMeshes.length;
      let morphCount = 0;
      for (const mesh of morphMeshes) morphCount += Object.keys(mesh.morphTargetDictionary ?? {}).length;
      setStatus(`Neeraj avatar loaded • meshes ${meshCount} • morph targets ${morphCount} • animations ${gltf.animations.length}`);
    }, undefined, (error) => {
      console.error(error);
      setStatus('Avatar GLB failed to load');
    });

    const resize = () => { const w = mount.clientWidth || 1; const h = mount.clientHeight || 1; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false); };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(mount);

    const command = (cmd: AvatarCommand) => {
      if (cmd.type === 'expression') expression = cmd.value;
      if (cmd.type === 'gesture') gesture = cmd.value;
      if (cmd.type === 'performance') perf = { ...perf, ...(cmd.value ?? {}) };
      if (cmd.type === 'viseme') {
        const v = cmd.value.toLowerCase(); const w = cmd.weight ?? 1;
        setMorph('mouthOpen', ['aa', 'a', 'e', 'ih', 'l', 'nn', 'rr'].includes(v) ? w : 0);
        setMorph('pucker', ['ou', 'u'].includes(v) ? w : 0);
        setMorph('funnel', ['o', 'oh'].includes(v) ? w : 0);
      }
      if (cmd.type === 'performance' && typeof cmd.value?.speaking === 'boolean') speaking = cmd.value.speaking;
      if (cmd.type === 'gesture' && ['wave', 'bye_wave'].includes(cmd.value)) setStatus('Neeraj avatar • greeting gesture');
    };
    apiRef.current = { command }; onApi?.(apiRef.current);

    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.05);
      mixer?.update(dt);
      const t = performance.now() / 1000;
      blinkTimer += dt;
      if (blinkTimer > 3.2 + Math.random() * 2.7) { blinkTimer = 0; blinkUntil = t + 0.14; }
      const blinkAmount = blinkUntil > t ? Math.sin(((blinkUntil - t) / 0.14) * Math.PI) : 0;
      setMorph('blink', blinkAmount);

      const head = findBone(['head']) as THREE.Object3D | null;
      const neck = findBone(['neck']) as THREE.Object3D | null;
      const spine = findBone(['spine', 'chest', 'upperchest']) as THREE.Object3D | null;
      const leftArm = findBone(['leftupperarm', 'left_arm', 'leftarm']) as THREE.Object3D | null;
      const rightArm = findBone(['rightupperarm', 'right_arm', 'rightarm']) as THREE.Object3D | null;
      const intensity = clamp(Number(perf.intensity ?? 0.35));

      if (head) {
        const look = perf.gaze === 'camera' || perf.gaze === 'direct' ? Math.sin(t * 0.55) * 0.035 : Math.sin(t * 0.32) * 0.015;
        head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, look, 0.035);
        head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, perf.head?.includes?.('tilt') ? 0.025 : 0, 0.04);
        if (gesture === 'nod' || gesture === 'acknowledge') head.rotation.x = Math.sin(t * 3.1) * 0.035;
      }
      if (neck) neck.rotation.y = THREE.MathUtils.lerp(neck.rotation.y, Math.sin(t * 0.4) * 0.012, 0.02);
      if (spine) spine.rotation.x = THREE.MathUtils.lerp(spine.rotation.x, perf.body?.includes?.('lean') ? -0.035 * intensity : 0, 0.025);

      const armAmount = 0.18 + intensity * 0.32;
      if (rightArm) rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, ['open_hand', 'explain', 'enumerate', 'emphasis', 'wave', 'bye_wave'].includes(gesture) ? -armAmount : gesture === 'namaste' || gesture === 'clap' ? -0.3 : 0, 0.06);
      if (leftArm) leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, ['namaste', 'clap', 'contrast'].includes(gesture) ? armAmount * 0.9 : 0, 0.06);

      if (!speaking) setMorph('mouthOpen', 0);
      if (expression !== 'happy') setMorph('smile', 0);
      renderer.render(scene, camera);
    });

    return () => { renderer.setAnimationLoop(null); ro.disconnect(); apiRef.current = null; mixer?.stopAllAction(); renderer.dispose(); if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement); };
  }, [onApi, onStatus]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%', minHeight: 420 }} />;
}
