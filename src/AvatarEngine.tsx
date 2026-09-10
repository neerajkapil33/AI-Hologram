import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

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
    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xdffaff, 0x07131f, 1.65));
    const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(2.5, 5, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0x28ddff, 2.0); rim.position.set(-3, 3.5, -3); scene.add(rim);
    const fill = new THREE.PointLight(0x66eaff, 0.65, 8); fill.position.set(0, 1.3, 2.5); scene.add(fill);

    const stage = new THREE.Group();
    scene.add(stage);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.28, 96), new THREE.MeshBasicMaterial({ color: 0x061722, transparent: true, opacity: 0.62, side: THREE.DoubleSide }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.01; stage.add(floor);
    const floorRing = new THREE.Mesh(new THREE.RingGeometry(0.82, 0.85, 128), new THREE.MeshBasicMaterial({ color: 0x45e6ff, transparent: true, opacity: 0.82, side: THREE.DoubleSide }));
    floorRing.rotation.x = -Math.PI / 2; floorRing.position.y = 0.025; stage.add(floorRing);
    const innerRing = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.065, 128), new THREE.MeshBasicMaterial({ color: 0x31cfff, transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
    innerRing.rotation.x = -Math.PI / 2; innerRing.position.y = 0.028; stage.add(innerRing);

    const avatarRoot = new THREE.Group();
    stage.add(avatarRoot);
    const loader = new GLTFLoader();
    let model: THREE.Object3D | null = null;
    let hologramModel: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let targetRotation = 0;
    let mouthTarget: { mesh: THREE.Mesh; index: number } | null = null;
    let speaking = false;
    let intensity = 0.2;

    const findMouthTarget = (root: THREE.Object3D) => {
      let result: { mesh: THREE.Mesh; index: number } | null = null;
      root.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh) || !obj.morphTargetDictionary) return;
        const name = Object.keys(obj.morphTargetDictionary).find((n) => /mouth.?open|jaw.?open|viseme.?aa|viseme.?sil/i.test(n));
        if (name) result = { mesh: obj, index: obj.morphTargetDictionary[name] };
      });
      return result;
    };

    const frameModel = (root: THREE.Object3D) => {
      root.scale.setScalar(1);
      root.position.set(0, 0, 0);
      root.updateMatrixWorld(true);
      const rawBox = new THREE.Box3().setFromObject(root);
      const rawHeight = Math.max(rawBox.getSize(new THREE.Vector3()).y, 0.001);
      const scale = Math.min(1.48 / rawHeight, 1.0);
      root.scale.setScalar(scale);
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const height = Math.max(size.y, 0.001);
      root.position.set(-center.x, -box.min.y, -center.z);
      root.updateMatrixWorld(true);
      const fitHeight = height * 1.10;
      const distance = (fitHeight * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
      camera.position.set(0, height * 0.46, Math.max(2.05, distance * 1.14));
      camera.lookAt(0, height * 0.46, 0);
      camera.updateProjectionMatrix();
    };

    statusRef.current?.('LOADING • REAL NEERAJ 3D MODEL');
    loader.load(AVATAR_SOURCE, (gltf) => {
      model = gltf.scene;
      model.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        obj.visible = true;
        obj.renderOrder = 2;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((mat) => {
          if (!mat) return;
          mat.visible = true;
          mat.transparent = true;
          mat.opacity = 0.88;
          mat.depthWrite = true;
          mat.depthTest = true;
          if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
            mat.emissive.set(0x087f9e);
            mat.emissiveIntensity = 0.16;
            mat.needsUpdate = true;
          }
        });
      });

      avatarRoot.add(model);
      frameModel(model);
      mouthTarget = findMouthTarget(model);

      // Separate skeleton-aware hologram shell. The source character hierarchy is never mutated during traversal.
      hologramModel = cloneSkinned(model);
      hologramModel.renderOrder = 3;
      hologramModel.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        obj.renderOrder = 3;
        obj.material = new THREE.MeshBasicMaterial({ color: 0x45e6ff, wireframe: true, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true });
      });
      avatarRoot.add(hologramModel);

      if (gltf.animations?.length) {
        mixer = new THREE.AnimationMixer(model);
        const idle = gltf.animations.find((clip) => /idle|breath|stand/i.test(clip.name)) ?? gltf.animations[0];
        mixer.clipAction(idle).reset().fadeIn(0.25).play();
      }
      statusRef.current?.(`ONLINE • REAL NEERAJ 3D READY${gltf.animations?.length ? ` • ${gltf.animations.length} ANIMATION${gltf.animations.length > 1 ? 'S' : ''}` : ''}`);
    }, undefined, (error) => {
      console.error('Neeraj GLB load error', error);
      statusRef.current?.('3D MODEL LOAD ERROR • CHECK /profile/scene.gltf + scene.bin');
    });

    const command = (cmd: AvatarCommand) => {
      if (cmd.type === 'performance') {
        intensity = Math.max(0, Math.min(1, Number(cmd.value?.intensity ?? cmd.value?.amplitude ?? intensity)));
        if (typeof cmd.value?.speaking === 'boolean') speaking = cmd.value.speaking;
      }
      if (cmd.type === 'gesture') {
        const value = cmd.value.toLowerCase();
        targetRotation = value.includes('left') ? -0.08 : value.includes('right') ? 0.08 : 0;
      }
      if (cmd.type === 'viseme' && mouthTarget) mouthTarget.mesh.morphTargetInfluences![mouthTarget.index] = Math.max(0, Math.min(1, Number(cmd.weight ?? 0)));
    };
    apiRef.current?.({ command });

    let lastW = 0, lastH = 0;
    const resize = () => {
      const w = Math.max(1, mount.clientWidth || 640);
      const h = Math.max(1, mount.clientHeight || 640);
      if (w === lastW && h === lastH) return;
      lastW = w; lastH = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const time = performance.now() / 1000;
      avatarRoot.rotation.y = THREE.MathUtils.lerp(avatarRoot.rotation.y, targetRotation + Math.sin(time * 0.22) * 0.018, 0.045);
      if (mixer) mixer.update(dt);
      if (mouthTarget?.mesh.morphTargetInfluences) {
        const current = mouthTarget.mesh.morphTargetInfluences[mouthTarget.index] ?? 0;
        const target = speaking ? Math.max(0.04, intensity * 0.5) : 0;
        mouthTarget.mesh.morphTargetInfluences[mouthTarget.index] = THREE.MathUtils.lerp(current, target, 0.18);
      }
      floorRing.rotation.z += dt * 0.08;
      innerRing.rotation.z -= dt * 0.045;
      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      mixer?.stopAllAction();
      if (hologramModel) {
        hologramModel.traverse((obj) => { if (obj instanceof THREE.Mesh && !Array.isArray(obj.material)) obj.material.dispose(); });
        avatarRoot.remove(hologramModel);
      }
      if (model) avatarRoot.remove(model);
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{ width: '100%', height: '100%', minHeight: 0, position: 'relative', overflow: 'hidden' }} />;
}
