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

const AVATAR_SOURCE = `${import.meta.env.BASE_URL}profile/scene.gltf`;

export default function AvatarEngine({ onStatus, onApi }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef(onStatus);
  const apiRef = useRef(onApi);

  useEffect(() => { statusRef.current = onStatus; apiRef.current = onApi; }, [onApi, onStatus]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x03070c, 0.055);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    camera.position.set(0, 1.2, 4.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x02050a, 0);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0x9defff, 0x07101a, 1.2));
    const key = new THREE.DirectionalLight(0x9fefff, 1.2); key.position.set(2.5, 4.5, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0x36d9ff, 2.0); rim.position.set(-3, 2.5, -3); scene.add(rim);
    const fill = new THREE.PointLight(0x2c8dff, 0.9, 7); fill.position.set(0, 1.8, 1.5); scene.add(fill);

    const stage = new THREE.Group(); scene.add(stage);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.25, 96), new THREE.MeshStandardMaterial({ color: 0x071019, metalness: 0.4, roughness: 0.48 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.01; stage.add(floor);
    const floorRing = new THREE.Mesh(new THREE.RingGeometry(0.82, 0.84, 128), new THREE.MeshBasicMaterial({ color: 0x6ee7ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    floorRing.rotation.x = -Math.PI / 2; floorRing.position.y = 0.025; stage.add(floorRing);
    const stageRing = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.009, 8, 128), new THREE.MeshBasicMaterial({ color: 0xa5e0e8, transparent: true, opacity: 0.36, side: THREE.DoubleSide }));
    stageRing.rotation.x = Math.PI / 2; stageRing.position.y = 0.045; stage.add(stageRing);

    const particleCount = 90;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) { const a = Math.random() * Math.PI * 2; const r = 0.82 + Math.random() * 0.58; positions[i * 3] = Math.cos(a) * r; positions[i * 3 + 1] = 0.08 + Math.random() * 2.5; positions[i * 3 + 2] = Math.sin(a) * r; }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xc5e8ee, size: 0.008, transparent: true, opacity: 0.28, depthWrite: false })); stage.add(particles);

    const avatarRoot = new THREE.Group(); stage.add(avatarRoot);
    const loader = new GLTFLoader();
    let model: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let clips: THREE.AnimationClip[] = [];
    let autoRotate = true;
    let targetRotation = 0;
    let speaking = false;
    let intensity = 0.25;
    let mouthTarget: { mesh: THREE.Mesh; index: number } | null = null;
    let baseScale = 1;

    const findMouthTarget = (root: THREE.Object3D) => {
      let best: { mesh: THREE.Mesh; index: number } | null = null;
      root.traverse((object) => { if (!(object instanceof THREE.Mesh) || !object.morphTargetDictionary) return; const names = Object.keys(object.morphTargetDictionary); const name = names.find((n) => /mouth.?open|jaw.?open|viseme.?aa|viseme.?sil/i.test(n)); if (name) best = { mesh: object, index: object.morphTargetDictionary[name] }; });
      return best;
    };

    const frameModel = (root: THREE.Object3D) => {
      root.scale.setScalar(1); root.position.set(0, 0, 0); root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const height = Math.max(size.y, 0.001);
      baseScale = Math.min(1.62 / height, 1.0);
      root.position.set(-center.x, -box.min.y, -center.z);
      root.updateMatrixWorld(true);
      const scaledHeight = height * baseScale;
      const distance = (scaledHeight * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
      camera.position.set(0, scaledHeight * 0.48, Math.max(2.9, distance * 1.14));
      camera.lookAt(0, scaledHeight * 0.47, 0);
    };

    statusRef.current?.('LOADING • NEERAJ 3D MODEL');
    loader.load(AVATAR_SOURCE, (gltf) => {
      model = gltf.scene;
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.castShadow = false; object.receiveShadow = false;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          if (!material) return;
          const hologram = material.clone() as THREE.MeshStandardMaterial;
          hologram.color.set(0x55ddff);
          hologram.emissive.set(0x087da0);
          hologram.emissiveIntensity = 1.7;
          hologram.metalness = 0.15;
          hologram.roughness = 0.32;
          hologram.transparent = true;
          hologram.opacity = 0.62;
          hologram.depthWrite = false;
          hologram.blending = THREE.AdditiveBlending;
          hologram.side = THREE.DoubleSide;
          object.material = hologram;
        });
      });
      avatarRoot.add(model);
      frameModel(model);
      mouthTarget = findMouthTarget(model);
      clips = gltf.animations ?? [];
      if (clips.length) { mixer = new THREE.AnimationMixer(model); const idle = clips.find((clip) => /idle|breath|stand/i.test(clip.name)) ?? clips[0]; mixer.clipAction(idle).reset().fadeIn(0.25).play(); }
      statusRef.current?.(`ONLINE • 3D NEERAJ READY${clips.length ? ` • ${clips.length} ANIMATION${clips.length > 1 ? 'S' : ''}` : ''}`);
    }, undefined, () => statusRef.current?.('3D MODEL LOAD ERROR • CHECK /profile/scene.gltf + scene.bin'));

    const command = (cmd: AvatarCommand) => {
      if (cmd.type === 'performance') { intensity = Math.max(0, Math.min(1, Number(cmd.value?.intensity ?? cmd.value?.amplitude ?? intensity))); if (typeof cmd.value?.speaking === 'boolean') speaking = cmd.value.speaking; }
      if (cmd.type === 'gesture') { const v = cmd.value.toLowerCase(); if (v.includes('left')) targetRotation = -0.14; else if (v.includes('right')) targetRotation = 0.14; else targetRotation = 0; }
      if (cmd.type === 'expression' && cmd.value.toLowerCase() === 'auto-rotate') autoRotate = !autoRotate;
      if (cmd.type === 'viseme' && mouthTarget) mouthTarget.mesh.morphTargetInfluences![mouthTarget.index] = Math.max(0, Math.min(1, Number(cmd.weight ?? 0)));
    };
    apiRef.current?.({ command });

    let lastWidth = 0, lastHeight = 0;
    const resize = () => { const w = mount.clientWidth || 640, h = mount.clientHeight || 640; if (w === lastWidth && h === lastHeight) return; lastWidth = w; lastHeight = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    resize(); const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(mount);
    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.05), t = performance.now() / 1000;
      if (autoRotate) targetRotation = Math.sin(t * 0.34) * 0.045;
      avatarRoot.rotation.y = THREE.MathUtils.lerp(avatarRoot.rotation.y, targetRotation, 0.045);
      avatarRoot.position.y = Math.sin(t * 1.15) * (0.003 + intensity * 0.004);
      avatarRoot.scale.setScalar(baseScale * (1 + Math.sin(t * 1.7) * 0.001 + (speaking ? 0.0015 : 0)));
      if (mixer) mixer.update(dt);
      if (mouthTarget?.mesh.morphTargetInfluences) { const current = mouthTarget.mesh.morphTargetInfluences[mouthTarget.index] ?? 0; const target = speaking ? Math.max(0.04, intensity * 0.5) : 0; mouthTarget.mesh.morphTargetInfluences[mouthTarget.index] = THREE.MathUtils.lerp(current, target, 0.18); }
      floorRing.rotation.z += dt * 0.08; stageRing.rotation.z -= dt * 0.045; particles.rotation.y += dt * 0.025;
      (floorRing.material as THREE.MeshBasicMaterial).opacity = 0.38 + intensity * 0.12;
      (stageRing.material as THREE.MeshBasicMaterial).opacity = 0.28 + intensity * 0.1;
      renderer.render(scene, camera);
    });

    return () => { renderer.setAnimationLoop(null); resizeObserver.disconnect(); mixer?.stopAllAction(); if (model) avatarRoot.remove(model); renderer.dispose(); pg.dispose(); if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement); };
  }, []);

  return <div ref={mountRef} style={{ width: '100%', height: '100%', minHeight: 0, position: 'relative', overflow: 'hidden' }} />;
}
