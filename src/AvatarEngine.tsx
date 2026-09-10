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

  useEffect(() => {
    statusRef.current = onStatus;
    apiRef.current = onApi;
  }, [onApi, onStatus]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020710, 0.035);
    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // Lighting is deliberately independent from the character materials.
    const masterAmbient = new THREE.AmbientLight(0x0f2042, 1.8);
    scene.add(masterAmbient);
    const keyCyanLight = new THREE.DirectionalLight(0x8fe9ff, 2.45);
    keyCyanLight.position.set(3, 5, 3);
    scene.add(keyCyanLight);
    const secondaryMagentaLight = new THREE.DirectionalLight(0xd946ef, 0.45);
    secondaryMagentaLight.position.set(-3, 3, -2);
    scene.add(secondaryMagentaLight);
    const neutralFill = new THREE.DirectionalLight(0xffffff, 1.1);
    neutralFill.position.set(-2, 2.5, 4);
    scene.add(neutralFill);

    const stage = new THREE.Group();
    scene.add(stage);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.28, 96),
      new THREE.MeshBasicMaterial({ color: 0x061722, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01;
    stage.add(floor);

    const grid = new THREE.GridHelper(6, 24, 0x06b6d4, 0x111e36);
    grid.position.y = 0.015;
    grid.material.transparent = true;
    grid.material.opacity = 0.12;
    stage.add(grid);

    const innerRing = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 0.845, 128),
      new THREE.MeshBasicMaterial({ color: 0x45e6ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
    );
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.025;
    stage.add(innerRing);

    const outerRing = new THREE.Mesh(
      new THREE.RingGeometry(1.05, 1.065, 128),
      new THREE.MeshBasicMaterial({ color: 0x31cfff, transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false }),
    );
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = 0.028;
    stage.add(outerRing);

    const avatarRoot = new THREE.Group();
    stage.add(avatarRoot);

    const loader = new GLTFLoader();
    let model: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    const actions = new Map<string, THREE.AnimationAction>();
    let activeAction: THREE.AnimationAction | null = null;
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
      const rawSize = rawBox.getSize(new THREE.Vector3());
      const rawHeight = Math.max(rawSize.y, 0.001);
      const scale = Math.min(1.48 / rawHeight, 1);
      root.scale.setScalar(scale);
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const height = Math.max(size.y, 0.001);
      root.position.set(-center.x, -box.min.y, -center.z);
      root.updateMatrixWorld(true);
      const fitHeight = height * 1.08;
      const distance = (fitHeight * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
      camera.position.set(0, height * 0.46, Math.max(2.05, distance * 1.16));
      camera.lookAt(0, height * 0.46, 0);
      camera.updateProjectionMatrix();
    };

    const crossfade = (name: string, duration = 0.45) => {
      const next = actions.get(name.toLowerCase());
      if (!next || next === activeAction) return;
      next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
      activeAction?.crossFadeTo(next, duration, true);
      activeAction = next;
    };

    statusRef.current?.('LOADING • REAL NEERAJ 3D MODEL');
    loader.load(
      AVATAR_SOURCE,
      (gltf) => {
        model = gltf.scene;
        // Preserve the GLB's original textures/material appearance. We only enforce visibility.
        model.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) return;
          obj.visible = true;
          obj.renderOrder = 2;
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach((material) => {
            if (!material) return;
            material.visible = true;
            material.transparent = false;
            material.opacity = 1;
            material.depthWrite = true;
            material.depthTest = true;
            material.blending = THREE.NormalBlending;
            material.needsUpdate = true;
          });
        });
        avatarRoot.add(model);
        frameModel(model);
        mouthTarget = findMouthTarget(model);

        if (gltf.animations?.length) {
          mixer = new THREE.AnimationMixer(model);
          gltf.animations.forEach((clip) => actions.set(clip.name.toLowerCase(), mixer!.clipAction(clip)));
          const idleName = [...actions.keys()].find((name) => /idle|breath|stand|rest/i.test(name)) ?? [...actions.keys()][0];
          if (idleName) crossfade(idleName, 0);
        }

        statusRef.current?.(`ONLINE • REAL NEERAJ 3D READY${gltf.animations?.length ? ` • ${gltf.animations.length} ANIMATION${gltf.animations.length > 1 ? 'S' : ''}` : ''}`);
      },
      undefined,
      (error) => {
        console.error('Neeraj GLTF load error', error);
        statusRef.current?.('3D MODEL LOAD ERROR • CHECK /profile/scene.gltf + scene.bin');
      },
    );

    // Small production-safe tuning panel. It controls lights only, never model materials.
    const panel = document.createElement('div');
    panel.className = 'avatar-light-controller';
    panel.innerHTML = `
      <div class="avatar-light-title">LIGHT CONTROLLER FIELD</div>
      <label>POSITION_X <input id="avatar-light-x" type="range" min="-10" max="10" step="0.5" value="3"></label>
      <label>INTENSITY <input id="avatar-light-intensity" type="range" min="0" max="8" step="0.2" value="2.4"></label>
    `;
    mount.appendChild(panel);
    const xInput = panel.querySelector('#avatar-light-x') as HTMLInputElement | null;
    const intensityInput = panel.querySelector('#avatar-light-intensity') as HTMLInputElement | null;
    xInput?.addEventListener('input', () => { keyCyanLight.position.x = Number(xInput.value); });
    intensityInput?.addEventListener('input', () => { keyCyanLight.intensity = Number(intensityInput.value); });

    const command = (cmd: AvatarCommand) => {
      if (cmd.type === 'performance') {
        intensity = Math.max(0, Math.min(1, Number(cmd.value?.intensity ?? cmd.value?.amplitude ?? intensity)));
        if (typeof cmd.value?.speaking === 'boolean') speaking = cmd.value.speaking;
      }
      if (cmd.type === 'gesture') {
        const value = cmd.value.toLowerCase();
        targetRotation = value.includes('left') ? -0.08 : value.includes('right') ? 0.08 : 0;
        if (value.includes('run')) {
          const runName = [...actions.keys()].find((name) => /run|walk|move/i.test(name));
          if (runName) crossfade(runName);
        } else if (activeAction) {
          const idleName = [...actions.keys()].find((name) => /idle|breath|stand|rest/i.test(name));
          if (idleName) crossfade(idleName);
        }
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
      lastW = w;
      lastH = h;
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
      mixer?.update(dt);
      if (mouthTarget?.mesh.morphTargetInfluences) {
        const current = mouthTarget.mesh.morphTargetInfluences[mouthTarget.index] ?? 0;
        const target = speaking ? Math.max(0.04, intensity * 0.5) : 0;
        mouthTarget.mesh.morphTargetInfluences[mouthTarget.index] = THREE.MathUtils.lerp(current, target, 0.18);
      }
      innerRing.rotation.z += dt * 0.08;
      outerRing.rotation.z -= dt * 0.045;
      grid.rotation.y += dt * 0.003;
      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      mixer?.stopAllAction();
      if (model) avatarRoot.remove(model);
      panel.remove();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{ width: '100%', height: '100%', minHeight: 0, position: 'relative', overflow: 'hidden' }} />;
}
