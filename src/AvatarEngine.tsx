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
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    camera.position.set(0, 1.1, 4.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xe8fbff, 0x172333, 1.7));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2, 5, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0x28dfff, 1.4); rim.position.set(-3, 3, -3); scene.add(rim);

    const stage = new THREE.Group();
    scene.add(stage);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.25, 96),
      new THREE.MeshBasicMaterial({ color: 0x06131d, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01;
    stage.add(floor);

    const floorRing = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 0.845, 128),
      new THREE.MeshBasicMaterial({ color: 0x45e6ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
    );
    floorRing.rotation.x = -Math.PI / 2;
    floorRing.position.y = 0.025;
    stage.add(floorRing);

    const avatarRoot = new THREE.Group();
    stage.add(avatarRoot);

    const shellMaterials: THREE.MeshBasicMaterial[] = [];
    const loader = new GLTFLoader();
    let model: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let baseScale = 1;
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
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const height = Math.max(size.y, 0.001);

      // Fit the entire real GLB into the stage without changing its geometry.
      baseScale = Math.min(1.62 / height, 1.05);
      root.position.set(-center.x, -box.min.y, -center.z);
      root.updateMatrixWorld(true);

      const scaledHeight = height * baseScale;
      camera.position.set(0, scaledHeight * 0.48, Math.max(3.0, scaledHeight * 1.65));
      camera.lookAt(0, scaledHeight * 0.47, 0);
    };

    statusRef.current?.('LOADING • REAL NEERAJ 3D MODEL');
    loader.load(
      AVATAR_SOURCE,
      (gltf) => {
        model = gltf.scene;
        model.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) return;
          obj.visible = true;
          obj.castShadow = false;
          obj.receiveShadow = false;
          obj.renderOrder = 1;

          // CRITICAL: keep the GLB's original materials, textures, skinning and colors.
          // Do not replace or make the real character transparent.
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((mat) => {
            if (!mat) return;
            mat.visible = true;
            mat.transparent = false;
            mat.opacity = 1;
            mat.depthWrite = true;
            mat.depthTest = true;
          });

          // Separate hologram outline. It is a sibling of the real mesh so it cannot
          // interfere with the GLB material or skinning.
          const shell = new THREE.Mesh(
            obj.geometry,
            new THREE.MeshBasicMaterial({
              color: 0x39e8ff,
              transparent: true,
              opacity: 0.24,
              wireframe: true,
              depthWrite: false,
              depthTest: false,
              side: THREE.DoubleSide,
              blending: THREE.AdditiveBlending,
            })
          );
          shell.name = 'NEERAJ_HOLOGRAM_OUTLINE';
          shell.position.copy(obj.position);
          shell.quaternion.copy(obj.quaternion);
          shell.scale.copy(obj.scale).multiplyScalar(1.006);
          shell.renderOrder = 4;
          obj.parent?.add(shell);
          shellMaterials.push(shell.material);
        });

        avatarRoot.add(model);
        frameModel(model);
        mouthTarget = findMouthTarget(model);

        if (gltf.animations?.length) {
          mixer = new THREE.AnimationMixer(model);
          const idle = gltf.animations.find((clip) => /idle|breath|stand/i.test(clip.name)) ?? gltf.animations[0];
          mixer.clipAction(idle).reset().fadeIn(0.25).play();
        }

        statusRef.current?.(`ONLINE • REAL NEERAJ 3D READY${gltf.animations?.length ? ` • ${gltf.animations.length} ANIMATION${gltf.animations.length > 1 ? 'S' : ''}` : ''}`);
      },
      undefined,
      (error) => {
        console.error('Neeraj GLB load error', error);
        statusRef.current?.('3D MODEL LOAD ERROR • CHECK /profile/scene.gltf + scene.bin');
      }
    );

    const command = (cmd: AvatarCommand) => {
      if (cmd.type === 'performance') {
        intensity = Math.max(0, Math.min(1, Number(cmd.value?.intensity ?? cmd.value?.amplitude ?? intensity)));
        if (typeof cmd.value?.speaking === 'boolean') speaking = cmd.value.speaking;
      }
      if (cmd.type === 'gesture') {
        const value = cmd.value.toLowerCase();
        targetRotation = value.includes('left') ? -0.08 : value.includes('right') ? 0.08 : 0;
      }
      if (cmd.type === 'viseme' && mouthTarget) {
        mouthTarget.mesh.morphTargetInfluences![mouthTarget.index] = Math.max(0, Math.min(1, Number(cmd.weight ?? 0)));
      }
    };
    apiRef.current?.({ command });

    let lastW = 0;
    let lastH = 0;
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
      targetRotation += Math.sin(time * 0.2) * 0.00025;
      avatarRoot.rotation.y = THREE.MathUtils.lerp(avatarRoot.rotation.y, targetRotation, 0.045);
      avatarRoot.scale.setScalar(baseScale);
      if (mixer) mixer.update(dt);
      if (mouthTarget?.mesh.morphTargetInfluences) {
        const current = mouthTarget.mesh.morphTargetInfluences[mouthTarget.index] ?? 0;
        const target = speaking ? Math.max(0.04, intensity * 0.5) : 0;
        mouthTarget.mesh.morphTargetInfluences[mouthTarget.index] = THREE.MathUtils.lerp(current, target, 0.18);
      }
      floorRing.rotation.z += dt * 0.08;
      shellMaterials.forEach((mat) => { mat.opacity = 0.16 + intensity * 0.12 + Math.sin(time * 4) * 0.035; });
      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      mixer?.stopAllAction();
      if (model) avatarRoot.remove(model);
      shellMaterials.forEach((mat) => { mat.dispose(); });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{ width: '100%', height: '100%', minHeight: 0, position: 'relative', overflow: 'hidden' }} />;
}
