import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import createMicroExpressionEngine from './idle-behavior.js';

export type AvatarCommand =
  | { type: 'expression'; value: string }
  | { type: 'viseme'; value: string; weight?: number }
  | { type: 'gesture'; value: string }
  | { type: 'performance'; value: any };

type AvatarApi = { command: (cmd: AvatarCommand) => void };
type Props = { onStatus?: (s: string) => void; onApi?: (api: AvatarApi) => void };

type MouthTarget = { mesh: THREE.Mesh; index: number };

const AVATAR_SOURCE = `${import.meta.env.BASE_URL}profile/scene.gltf`;

const VISEME_MAP: Record<'mouthOpen' | 'jawOpen', string[]> = {
  mouthOpen: ['mouthOpen', 'mouth_open', 'Mouth_Open', 'openMouth', 'shapes.mouth_O', 'mb_lab_mouth_open', 'viseme_aa', 'viseme_AA', 'viseme_O_M'],
  jawOpen: ['jawOpen', 'jaw_open', 'Jaw_Open', 'jawDrop', 'Jaw_Lower', 'mb_lab_jaw_v', 'viseme_Jaw_Drop'],
};

const normalizeMorphName = (name: string) => name.replace(/[\s_-]+/g, '').toLowerCase();

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
    camera.position.set(0, 0.75, 2.35);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0x000000, 0);

    const canvasContainer = document.createElement('div');
    canvasContainer.id = 'canvas-runtime-container';
    canvasContainer.className = 'absolute inset-0 z-0 w-full h-full';
    canvasContainer.style.cssText = 'position:absolute;inset:0;z-index:0;width:100%;height:100%;';
    mount.appendChild(canvasContainer);
    canvasContainer.appendChild(renderer.domElement);

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
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.28, 96), new THREE.MeshBasicMaterial({ color: 0x061722, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01;
    stage.add(floor);
    const grid = new THREE.GridHelper(6, 24, 0x06b6d4, 0x111e36);
    grid.position.y = 0.015;
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((material) => { material.transparent = true; material.opacity = 0.12; });
    stage.add(grid);
    const innerRing = new THREE.Mesh(new THREE.RingGeometry(0.82, 0.845, 128), new THREE.MeshBasicMaterial({ color: 0x45e6ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.025;
    stage.add(innerRing);
    const outerRing = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.065, 128), new THREE.MeshBasicMaterial({ color: 0x31cfff, transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false }));
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = 0.028;
    stage.add(outerRing);
    const avatarRoot = new THREE.Group();
    stage.add(avatarRoot);

    const loader = new GLTFLoader();
    let model: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let microExpressions: ReturnType<typeof createMicroExpressionEngine> | null = null;
    const actions = new Map<string, THREE.AnimationAction>();
    let activeAction: THREE.AnimationAction | null = null;
    let targetRotation = 0;
    let mouthTargets: MouthTarget[] = [];
    let jawTargets: MouthTarget[] = [];
    let speaking = false;
    let intensity = 0.2;

    const findTargetMorphs = (root: THREE.Object3D, standardKey: 'mouthOpen' | 'jawOpen') => {
      const targets: MouthTarget[] = [];
      const alternatives = VISEME_MAP[standardKey].map(normalizeMorphName);
      root.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh) || !obj.morphTargetDictionary || !obj.morphTargetInfluences) return;
        const match = Object.entries(obj.morphTargetDictionary).find(([name]) => alternatives.includes(normalizeMorphName(name)));
        if (match) targets.push({ mesh: obj, index: match[1] });
      });
      return targets;
    };

    const setTargets = (targets: MouthTarget[], weight: number) => {
      targets.forEach(({ mesh, index }) => {
        if (!mesh.morphTargetInfluences) return;
        const current = mesh.morphTargetInfluences[index] ?? 0;
        mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(current, weight, 0.25);
      });
    };

    const resetTargets = (targets: MouthTarget[]) => {
      targets.forEach(({ mesh, index }) => {
        if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = 0;
      });
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

    const findAction = (patterns: RegExp[]) => [...actions.entries()].find(([name]) => patterns.some((pattern) => pattern.test(name)))?.[1] ?? null;
    const crossfade = (action: THREE.AnimationAction | null, duration = 0.45) => {
      if (!action || action === activeAction) return;
      action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
      activeAction?.crossFadeTo(action, duration, true);
      activeAction = action;
    };

    statusRef.current?.('LOADING • REAL NEERAJ 3D MODEL');
    loader.load(AVATAR_SOURCE, (gltf) => {
      model = gltf.scene;
      model.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        obj.visible = true;
        obj.renderOrder = 2;
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach((material) => { if (material) { material.visible = true; material.needsUpdate = true; } });
      });
      avatarRoot.add(model);
      frameModel(model);
      mouthTargets = findTargetMorphs(model, 'mouthOpen');
      jawTargets = findTargetMorphs(model, 'jawOpen');
      microExpressions = createMicroExpressionEngine(model, { isSpeaking: () => speaking });
      if (gltf.animations?.length) {
        mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach((clip) => actions.set(clip.name.toLowerCase(), mixer!.clipAction(clip)));
        crossfade(findAction([/idle/i, /breath/i, /stand/i, /rest/i]) ?? [...actions.values()][0], 0);
      }
      statusRef.current?.(`ONLINE • REAL NEERAJ 3D READY${gltf.animations?.length ? ` • ${gltf.animations.length} ANIMATION${gltf.animations.length > 1 ? 'S' : ''}` : ''}${mouthTargets.length || jawTargets.length ? ' • FACIAL VISEMES READY' : ''} • MICRO-EXPRESSIONS READY`);
    }, (xhr) => {
      if (xhr.total > 0) statusRef.current?.(`LOADING • REAL NEERAJ 3D MODEL • ${Math.round((xhr.loaded / xhr.total) * 100)}%`);
    }, (error) => {
      console.error('Neeraj GLTF load error', error);
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
        if (value.includes('run') || value.includes('walk') || value.includes('move')) crossfade(findAction([/run/i, /walk/i, /move/i]));
        else crossfade(findAction([/idle/i, /breath/i, /stand/i, /rest/i]));
      }
      if (cmd.type === 'viseme') {
        const weight = Math.max(0, Math.min(1, Number(cmd.weight ?? 0)));
        if (/jaw/i.test(cmd.value)) setTargets(jawTargets, Math.min(weight * 0.5, 0.45));
        else setTargets(mouthTargets, Math.min(weight, 0.85));
        if (/silence|close|rest/i.test(cmd.value)) {
          resetTargets(mouthTargets);
          resetTargets(jawTargets);
        }
      }
    };
    apiRef.current?.({ command });

    const resize = () => {
      const w = Math.max(1, mount.clientWidth || 640);
      const h = Math.max(1, mount.clientHeight || 640);
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
      if (mouthTargets.length || jawTargets.length) {
        const target = speaking ? Math.max(0.04, intensity * 0.5) : 0;
        setTargets(mouthTargets, target);
        setTargets(jawTargets, Math.min(target * 0.5, 0.45));
      }
      microExpressions?.update();
      innerRing.rotation.z += dt * 0.08;
      outerRing.rotation.z -= dt * 0.045;
      grid.rotation.y += dt * 0.003;
      keyCyanLight.intensity = 2.35 + Math.sin(time * 1.8) * 0.18;
      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      microExpressions?.dispose();
      mixer?.stopAllAction();
      resetTargets(mouthTargets);
      resetTargets(jawTargets);
      if (model) avatarRoot.remove(model);
      renderer.dispose();
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      grid.geometry.dispose();
      gridMaterials.forEach((material) => material.dispose());
      innerRing.geometry.dispose();
      (innerRing.material as THREE.Material).dispose();
      outerRing.geometry.dispose();
      (outerRing.material as THREE.Material).dispose();
      if (renderer.domElement.parentNode === canvasContainer) canvasContainer.removeChild(renderer.domElement);
      canvasContainer.remove();
    };
  }, []);

  return <div ref={mountRef} className="relative w-full h-full min-h-[500px]" />;
}
