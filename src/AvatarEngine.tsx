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
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x101522, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 3.2); key.position.set(1.5, 3, 3); scene.add(key);
    const rim = new THREE.DirectionalLight(0x55aaff, 2.4); rim.position.set(-2, 2, -2); scene.add(rim);
    const fill = new THREE.PointLight(0x38a8ff, 1.8, 6); fill.position.set(0, 1.4, 1.2); scene.add(fill);

    const hologramGroup = new THREE.Group();
    scene.add(hologramGroup);
    const holoRings: THREE.Mesh[] = [];
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x39bfff, transparent: true, opacity: 0.52, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (const [radius, y, thickness] of [[0.82, 0.03, 0.018], [0.66, 0.34, 0.012], [0.54, 2.36, 0.012]] as const) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 8, 96), ringMaterial.clone());
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      hologramGroup.add(ring);
      holoRings.push(ring);
    }

    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.94, 2.48, 48, 1, true), new THREE.MeshBasicMaterial({ color: 0x2aaeff, transparent: true, opacity: 0.055, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 1.24;
    hologramGroup.add(beam);

    const scanLines: THREE.Mesh[] = [];
    const scanMaterial = new THREE.MeshBasicMaterial({ color: 0x5fd7ff, transparent: true, opacity: 0.075, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < 46; i += 1) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(1.72, 0.006), scanMaterial.clone());
      line.position.set(0, 0.12 + (i / 45) * 2.34, 0.02);
      hologramGroup.add(line);
      scanLines.push(line);
    }

    const particleCount = 260;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.34 + Math.random() * 0.66;
      particlePositions[i * 3] = Math.cos(a) * r;
      particlePositions[i * 3 + 1] = Math.random() * 2.5;
      particlePositions[i * 3 + 2] = Math.sin(a) * r;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({ color: 0x7bdcff, size: 0.014, transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
    particles.position.y = 0.01;
    hologramGroup.add(particles);

    let model: THREE.Object3D | null = null;
    let runtime: AvatarRuntime | null = null;
    let speaking = false;
    let expression = 'neutral';
    let gesture = 'idle';
    let perf: any = { intensity: 0.35, gaze: 'camera', head: '', body: '' };
    let blinkTimer = 0, blinkUntil = 0;
    let modelBaseY = 0, modelBaseScale = 1;
    const clock = new THREE.Clock();
    const setStatus = (s: string) => onStatus?.(s);
    const loader = new GLTFLoader();

    const prepareModel = (root: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const height = Math.max(size.y, 0.01);
      modelBaseScale = 2.45 / height;
      root.scale.setScalar(modelBaseScale);
      root.position.sub(center.multiplyScalar(modelBaseScale));
      const framed = new THREE.Box3().setFromObject(root);
      modelBaseY = -framed.min.y + 0.02;
      root.position.y += modelBaseY;
      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true; mesh.receiveShadow = true;
        const raw = mesh.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
        for (const material of Array.isArray(raw) ? raw : [raw]) {
          if (!material) continue;
          material.metalness = Math.min(material.metalness ?? 0, 0.2);
          material.roughness = Math.max(material.roughness ?? 0.5, 0.3);
          material.emissive = new THREE.Color(0x0b3158);
          material.emissiveIntensity = 0.22;
          material.transparent = true;
          material.opacity = 0.76;
          material.blending = THREE.AdditiveBlending;
          material.depthWrite = false;
        }
      });
    };

    const acceptModel = (gltf: any, source: string) => {
      const candidate = gltf.scene as THREE.Object3D;
      prepareModel(candidate);
      model = candidate;
      scene.add(candidate);
      runtime = new AvatarRuntime(candidate, gltf.animations ?? []);
      const report = runtime.report();
      setStatus(`NEERAJ 3D HOLOGRAM READY • ${source.includes('gltf') ? 'GLTF' : 'GLB'} • ${report.skinnedMeshes} SKINNED • ${report.bones} BONES • ${report.morphTargets} MORPHS • ${gltf.animations?.length ?? 0} ANIMATIONS`);
    };

    const loadSource = (index: number) => {
      const source = AVATAR_SOURCES[index];
      setStatus(`LOADING • NEERAJ 3D HOLOGRAM ${index + 1}/${AVATAR_SOURCES.length}`);
      loader.load(source, (gltf) => acceptModel(gltf, source), undefined, (error) => {
        console.warn(`Avatar source unavailable: ${source}`, error);
        if (index + 1 < AVATAR_SOURCES.length) loadSource(index + 1);
        else setStatus('3D HOLOGRAM LOAD FAILED • CHECK GLTF, BIN AND TEXTURES');
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
        const v = norm(cmd.value), w = cmd.weight ?? 1;
        const aliases = [`viseme_${v}`, v];
        if (['aa', 'ah'].includes(v)) aliases.push('jawOpen', 'mouthOpen');
        if (['ou', 'u', 'o'].includes(v)) aliases.push('mouthPucker', 'mouthFunnel');
        if (['pp', 'mm', 'bb'].includes(v)) aliases.push('mouthClose');
        runtime.setFirstAvailable(aliases, w);
      }
    };
    apiRef.current = { command }; onApi?.(apiRef.current);

    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.05);
      runtime?.update(dt);
      const t = performance.now() / 1000;
      blinkTimer += dt;
      if (blinkTimer > 3.2 + Math.random() * 2.7) { blinkTimer = 0; blinkUntil = t + 0.14; }
      const blink = blinkUntil > t ? Math.sin(((blinkUntil - t) / 0.14) * Math.PI) : 0;
      if (runtime) {
        runtime.setFirstAvailable(['eyeBlinkLeft', 'eyeBlink', 'blink'], blink);
        runtime.setFirstAvailable(['eyeBlinkRight', 'eyeBlink', 'blink'], blink);
        if (!speaking) runtime.setFirstAvailable(['jawOpen', 'mouthOpen', 'viseme_sil'], 0);
        const happy = ['happy', 'excited', 'celebrating'].includes(expression);
        runtime.setFirstAvailable(['mouthSmileLeft', 'mouthSmile', 'smile'], happy ? 0.42 : 0);
        runtime.setFirstAvailable(['mouthSmileRight', 'mouthSmile', 'smile'], happy ? 0.42 : 0);
        const head = runtime.bone(['head']), neck = runtime.bone(['neck']), spine = runtime.bone(['spine', 'chest', 'upperchest']);
        const leftArm = runtime.bone(['leftupperarm', 'left_arm', 'leftarm']), rightArm = runtime.bone(['rightupperarm', 'right_arm', 'rightarm']);
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
        if (rightArm) rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, ['open_hand','explain','enumerate','emphasis','wave','bye_wave'].includes(gesture) ? -arm : 0, 0.06);
        if (leftArm) leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, ['namaste','clap','contrast'].includes(gesture) ? arm * 0.9 : 0, 0.06);
      }

      const audioIntensity = clamp(Number(perf.amplitude ?? perf.audioAmplitude ?? perf.voiceLevel ?? 0));
      const activeEnergy = Math.max(audioIntensity, speaking ? 0.12 : 0);
      if (model) {
        model.position.y = modelBaseY + Math.sin(t * 1.15) * (0.006 + activeEnergy * 0.004) + (speaking ? Math.sin(t * 5.2) * 0.008 : 0);
        model.rotation.y = THREE.MathUtils.lerp(model.rotation.y, Math.sin(t * 0.38) * (0.035 + activeEnergy * 0.025), 0.025);
        model.scale.setScalar(modelBaseScale * (1 + Math.sin(t * 1.7) * 0.0025 + activeEnergy * 0.008));
        model.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          const raw = mesh.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
          for (const material of Array.isArray(raw) ? raw : [raw]) {
            if (!material) continue;
            material.emissiveIntensity = 0.18 + activeEnergy * 0.72;
            material.opacity = 0.70 + activeEnergy * 0.18;
          }
        });
      }

      holoRings.forEach((ring, index) => {
        ring.rotation.z += dt * (index % 2 === 0 ? 0.42 : -0.3);
        const pulse = 1 + Math.sin(t * (1.8 + index * 0.35) + index) * 0.035 + activeEnergy * 0.055;
        ring.scale.setScalar(pulse);
        const material = ring.material as THREE.MeshBasicMaterial;
        material.opacity = 0.24 + (Math.sin(t * 2.2 + index) + 1) * 0.10 + activeEnergy * 0.22;
      });
      (beam.material as THREE.MeshBasicMaterial).opacity = 0.035 + (Math.sin(t * 1.7) + 1) * 0.018 + activeEnergy * 0.045;

      scanLines.forEach((line, index) => {
        const cycle = (t * (0.42 + activeEnergy * 0.7) + index / scanLines.length) % 1;
        line.position.y = 0.12 + cycle * 2.34;
        const material = line.material as THREE.MeshBasicMaterial;
        material.opacity = 0.02 + (Math.sin(t * 3.5 + index * 0.7) + 1) * 0.025 + activeEnergy * 0.09;
        line.scale.x = 0.86 + Math.sin(t * 1.8 + index) * 0.08 + activeEnergy * 0.10;
      });

      particles.rotation.y += dt * (0.08 + activeEnergy * 0.18);
      particles.position.y = 0.01 + Math.sin(t * 0.6) * 0.008;
      const particleMaterial = particles.material as THREE.PointsMaterial;
      particleMaterial.opacity = 0.56 + activeEnergy * 0.38;
      particleMaterial.size = 0.012 + activeEnergy * 0.012;
      renderer.render(scene, camera);
    });

    const resize = () => { const w = mount.clientWidth || 1, h = mount.clientHeight || 1; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false); };
    resize(); const ro = new ResizeObserver(resize); ro.observe(mount);
    return () => { renderer.setAnimationLoop(null); ro.disconnect(); apiRef.current = null; renderer.dispose(); particleGeometry.dispose(); if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement); };
  }, [onApi, onStatus]);
  return <div ref={mountRef} style={{ width: '100%', height: '100%', minHeight: 420 }} />;
}
