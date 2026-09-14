import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import createMicroExpressionEngine, { type MicroExpressionEngine } from './idle-behavior';

export type AvatarCommand =
  | { type: 'expression'; value: string }
  | { type: 'viseme'; value: string; weight?: number }
  | { type: 'gesture'; value: string }
  | { type: 'performance'; value: any };

type AvatarApi = { command: (cmd: AvatarCommand) => void };
type Props = { onStatus?: (status: string) => void; onApi?: (api: AvatarApi) => void };
type MorphTarget = { mesh: THREE.Mesh; index: number };
type BoneSet = {
  head: THREE.Object3D[];
  neck: THREE.Object3D[];
  spine: THREE.Object3D[];
  shoulders: THREE.Object3D[];
  leftUpperArm: THREE.Object3D[];
  leftForeArm: THREE.Object3D[];
  rightUpperArm: THREE.Object3D[];
  rightForeArm: THREE.Object3D[];
  leftHand: THREE.Object3D[];
  rightHand: THREE.Object3D[];
  leftThigh: THREE.Object3D[];
  rightThigh: THREE.Object3D[];
  leftCalf: THREE.Object3D[];
  rightCalf: THREE.Object3D[];
};

const AVATAR_SOURCE = `${import.meta.env.BASE_URL}profile/avatar.fbx`;
const VISEME_ALIASES = [
  'mouthOpen', 'mouth_open', 'Mouth_Open', 'openMouth', 'jawOpen', 'jaw_open',
  'jawDrop', 'viseme_aa', 'viseme_AA', 'viseme_O_M', 'viseme_Jaw_Drop',
];
const normalize = (name: string) => name.replace(/[^a-z0-9]/gi, '').toLowerCase();
const has = (name: string, ...parts: string[]) => parts.some((part) => name.includes(part));

const makeBoneSet = (root: THREE.Object3D): BoneSet => {
  const bones: BoneSet = {
    head: [], neck: [], spine: [], shoulders: [],
    leftUpperArm: [], leftForeArm: [], rightUpperArm: [], rightForeArm: [],
    leftHand: [], rightHand: [], leftThigh: [], rightThigh: [],
    leftCalf: [], rightCalf: [],
  };

  root.traverse((node) => {
    if (!(node instanceof THREE.Bone)) return;
    const n = normalize(node.name);
    const left = has(n, 'left', 'lft') || /(^|[^a-z])l($|[^a-z])/.test(n);
    const right = has(n, 'right', 'rgt') || /(^|[^a-z])r($|[^a-z])/.test(n);

    if (has(n, 'head', 'headtop', 'headend') && !has(n, 'end')) bones.head.push(node);
    else if (has(n, 'neck')) bones.neck.push(node);
    else if (has(n, 'spine', 'chest', 'upperchest', 'abdomen')) bones.spine.push(node);
    else if (has(n, 'shoulder', 'clavicle')) bones.shoulders.push(node);
    else if (has(n, 'upperarm', 'arm')) {
      if (left && !right) bones.leftUpperArm.push(node);
      else if (right) bones.rightUpperArm.push(node);
    } else if (has(n, 'forearm', 'lowerarm')) {
      if (left && !right) bones.leftForeArm.push(node);
      else if (right) bones.rightForeArm.push(node);
    } else if (has(n, 'hand', 'wrist')) {
      if (left && !right) bones.leftHand.push(node);
      else if (right) bones.rightHand.push(node);
    } else if (has(n, 'thigh', 'upleg')) {
      if (left && !right) bones.leftThigh.push(node);
      else if (right) bones.rightThigh.push(node);
    } else if (has(n, 'calf', 'lowerleg', 'shin')) {
      if (left && !right) bones.leftCalf.push(node);
      else if (right) bones.rightCalf.push(node);
    }
  });

  return bones;
};

const allBones = (set: BoneSet) => Object.values(set).flat();

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
    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setClearColor(0, 0);

    const canvasContainer = document.createElement('div');
    canvasContainer.style.cssText = 'position:absolute;inset:0;z-index:2;pointer-events:none';
    mount.appendChild(canvasContainer);
    canvasContainer.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xb9ecff, 0x07111d, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(3, 6, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9beeff, 1.4);
    fill.position.set(-3, 3, 4);
    scene.add(fill);

    const avatarRoot = new THREE.Group();
    scene.add(avatarRoot);
    const loader = new FBXLoader();

    let model: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let microExpressions: MicroExpressionEngine | null = null;
    let bones: BoneSet | null = null;
    let activeAction: THREE.AnimationAction | null = null;
    let targetRotation = 0;
    let speaking = false;
    let gestureTarget = 0;
    let gestureStarted = 0;
    let gestureKind = 'none';
    const actions = new Map<string, THREE.AnimationAction>();
    const morphTargets: MorphTarget[] = [];
    const baseRotations = new Map<THREE.Object3D, THREE.Euler>();

    const findMorphTargets = (root: THREE.Object3D) => {
      root.traverse((object) => {
        if (!(object instanceof THREE.Mesh) || !object.morphTargetDictionary || !object.morphTargetInfluences) return;
        Object.entries(object.morphTargetDictionary).forEach(([name, index]) => {
          const n = normalize(name);
          if (VISEME_ALIASES.some((alias) => n === normalize(alias) || n.includes(normalize(alias)))) {
            morphTargets.push({ mesh: object, index });
          }
        });
      });
    };

    const setMorphs = (targets: MorphTarget[], weight: number, alpha = 0.25) => {
      targets.forEach(({ mesh, index }) => {
        if (mesh.morphTargetInfluences) {
          mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(mesh.morphTargetInfluences[index] ?? 0, weight, alpha);
        }
      });
    };

    const frameModel = (root: THREE.Object3D) => {
      root.scale.setScalar(1);
      root.position.set(0, 0, 0);
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const height = Math.max(size.y, 0.001);
      root.position.set(-center.x, -box.min.y, -center.z);
      root.updateMatrixWorld(true);
      const distance = height * 0.60 / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
      camera.position.set(0, height * 0.46, Math.max(2, distance));
      camera.lookAt(0, height * 0.46, 0);
      camera.updateProjectionMatrix();
      return size;
    };

    const findAction = (patterns: RegExp[]) =>
      [...actions.entries()].find(([name]) => patterns.some((pattern) => pattern.test(name)))?.[1] ?? null;

    const playAction = (action: THREE.AnimationAction | null, duration = 0.35) => {
      if (!action || action === activeAction) return;
      action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
      activeAction?.crossFadeTo(action, duration, true);
      activeAction = action;
    };

    const rotateBone = (bone: THREE.Object3D, x: number, y: number, z: number, amount: number) => {
      const base = baseRotations.get(bone);
      if (!base) return;
      bone.rotation.x = THREE.MathUtils.lerp(bone.rotation.x, base.x + x * amount, 0.16);
      bone.rotation.y = THREE.MathUtils.lerp(bone.rotation.y, base.y + y * amount, 0.16);
      bone.rotation.z = THREE.MathUtils.lerp(bone.rotation.z, base.z + z * amount, 0.16);
    };

    const applyBodyMotion = (time: number, dt: number) => {
      if (!bones) return;
      const t = time * 0.001;
      const breath = Math.sin(t * 1.55) * 0.5 + 0.5;
      const sway = Math.sin(t * 0.65) * 0.5 + Math.sin(t * 0.31) * 0.25;

      bones.spine.forEach((bone, i) => rotateBone(bone, Math.sin(t * 1.55 + i * 0.4) * 0.012, sway * 0.018, 0, 1));
      bones.shoulders.forEach((bone, i) => rotateBone(bone, 0, 0, Math.sin(t * 1.55 + i) * 0.025 * breath, 1));

      const walkAmount = gestureKind === 'walk' || gestureKind === 'move' ? gestureTarget : 0;
      bones.leftUpperArm.forEach((bone) => rotateBone(bone, Math.sin(t * 1.9) * 0.10 * walkAmount, 0, -0.035 * walkAmount, 1));
      bones.rightUpperArm.forEach((bone) => rotateBone(bone, Math.sin(t * 1.9 + Math.PI) * 0.10 * walkAmount, 0, 0.035 * walkAmount, 1));
      bones.leftThigh.forEach((bone) => rotateBone(bone, Math.sin(t * 1.9 + Math.PI) * 0.12 * walkAmount, 0, 0, 1));
      bones.rightThigh.forEach((bone) => rotateBone(bone, Math.sin(t * 1.9) * 0.12 * walkAmount, 0, 0, 1));
      bones.leftCalf.forEach((bone) => rotateBone(bone, Math.max(0, Math.sin(t * 1.9 + Math.PI)) * 0.10 * walkAmount, 0, 0, 1));
      bones.rightCalf.forEach((bone) => rotateBone(bone, Math.max(0, Math.sin(t * 1.9)) * 0.10 * walkAmount, 0, 0, 1));

      const elapsed = time - gestureStarted;
      const gestureProgress = Math.min(1, elapsed / 650);
      const ease = gestureProgress < 0.5 ? gestureProgress * 2 : 2 - gestureProgress * 2;
      const gesture = gestureTarget * ease;

      if (gestureKind === 'wave' || gestureKind === 'hand' || gestureKind === 'greet') {
        bones.rightUpperArm.forEach((bone) => rotateBone(bone, -0.65, 0.15, -0.45, gesture));
        bones.rightForeArm.forEach((bone) => rotateBone(bone, -0.55, 0, 0.15, gesture));
        bones.rightHand.forEach((bone) => rotateBone(bone, 0, Math.sin(t * 7) * 0.25, 0.1, gesture));
      } else if (gestureKind === 'point') {
        bones.rightUpperArm.forEach((bone) => rotateBone(bone, -0.42, -0.12, -0.30, gesture));
        bones.rightForeArm.forEach((bone) => rotateBone(bone, -0.80, 0, 0.05, gesture));
        bones.rightHand.forEach((bone) => rotateBone(bone, -0.12, 0.12, 0, gesture));
      } else if (gestureKind === 'open') {
        bones.rightUpperArm.forEach((bone) => rotateBone(bone, -0.30, -0.28, -0.25, gesture));
        bones.leftUpperArm.forEach((bone) => rotateBone(bone, -0.30, 0.28, 0.25, gesture));
        bones.rightForeArm.forEach((bone) => rotateBone(bone, -0.22, 0, 0, gesture));
        bones.leftForeArm.forEach((bone) => rotateBone(bone, -0.22, 0, 0, gesture));
      } else if (gestureKind === 'nod') {
        bones.head.forEach((bone) => rotateBone(bone, Math.sin(t * 5) * 0.18, 0, 0, gesture));
        bones.neck.forEach((bone) => rotateBone(bone, Math.sin(t * 5) * 0.07, 0, 0, gesture));
      } else if (gestureKind === 'shrug') {
        bones.shoulders.forEach((bone) => rotateBone(bone, 0, 0, Math.sin(t * 6) * 0.14, gesture));
      }

      if (gestureTarget > 0) {
        gestureTarget = Math.max(0, gestureTarget - dt * 0.0012);
        if (gestureTarget <= 0.01) gestureKind = 'none';
      }
    };

    const command = (cmd: AvatarCommand) => {
      if (cmd.type === 'performance') {
        if (typeof cmd.value?.speaking === 'boolean') speaking = cmd.value.speaking;
        const emotion = String(cmd.value?.emotion ?? '').toLowerCase();
        if (/happy|positive|excited|warm|insight|success|confident/.test(emotion)) {
          microExpressions?.triggerInsightSmileExpression(true);
        }
      }

      if (cmd.type === 'expression') {
        const value = cmd.value.toLowerCase();
        if (/smile|happy|warm|positive|success|confident|encourag/.test(value)) microExpressions?.triggerInsightSmileExpression(true);
        if (/neutral|rest|stop/.test(value)) microExpressions?.triggerInsightSmileExpression(false);
      }

      if (cmd.type === 'viseme') {
        const weight = THREE.MathUtils.clamp(Number(cmd.weight ?? 0), 0, 1);
        setMorphs(morphTargets, /silence|close|rest/i.test(cmd.value) ? 0 : Math.min(weight, 0.9), 0.35);
      }

      if (cmd.type === 'gesture') {
        const value = cmd.value.toLowerCase();
        targetRotation = value.includes('left') ? -0.12 : value.includes('right') ? 0.12 : 0;
        gestureKind = /wave|hand|greet|hello/.test(value) ? 'wave'
          : /point|indicate/.test(value) ? 'point'
          : /open|present|explain/.test(value) ? 'open'
          : /nod|yes/.test(value) ? 'nod'
          : /shrug/.test(value) ? 'shrug'
          : /walk/.test(value) ? 'walk'
          : /move|run/.test(value) ? 'move'
          : 'none';
        gestureTarget = gestureKind === 'none' ? 0 : 1;
        gestureStarted = performance.now();
        if (/walk|run|move/.test(value)) playAction(findAction([/walk/i, /run/i, /move/i]));
        else if (gestureKind !== 'none') playAction(findAction([/gesture/i, /wave/i, /talk/i, /idle/i, /stand/i]) ?? activeAction);
      }
    };

    statusRef.current?.('LOADING • NEERAJ FBX AVATAR');

    loader.load(
      AVATAR_SOURCE,
      (fbx) => {
        model = fbx;
        model.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.visible = true;
          object.frustumCulled = false;
          object.renderOrder = 2;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => { if (material) { material.visible = true; material.needsUpdate = true; } });
        });

        avatarRoot.add(model);
        const size = frameModel(model);
        bones = makeBoneSet(model);
        allBones(bones).forEach((bone) => baseRotations.set(bone, bone.rotation.clone()));
        findMorphTargets(model);
        microExpressions = createMicroExpressionEngine(model, { isSpeaking: () => speaking });

        if (fbx.animations?.length) {
          mixer = new THREE.AnimationMixer(model);
          fbx.animations.forEach((clip) => actions.set(clip.name.toLowerCase(), mixer!.clipAction(clip)));
          playAction(findAction([/idle/i, /breath/i, /stand/i, /rest/i]) ?? [...actions.values()][0], 0);
        }

        apiRef.current?.({ command });
        const bodyParts = Object.values(bones).filter((group) => group.length).length;
        statusRef.current?.(`ONLINE • FBX BODY RIG READY • ${Math.round(size.y * 100) / 100} HEIGHT • ${bodyParts} BODY GROUPS • BLINK + FACE + LIP SYNC`);
      },
      (xhr) => {
        if (xhr.total > 0) statusRef.current?.(`LOADING • NEERAJ FBX AVATAR • ${Math.round((xhr.loaded / xhr.total) * 100)}%`);
      },
      (error) => {
        console.error('Neeraj FBX load error', error);
        statusRef.current?.('3D MODEL LOAD ERROR • CHECK /profile/avatar.fbx');
      },
    );

    const resize = () => {
      const width = Math.max(1, mount.clientWidth || 640);
      const height = Math.max(1, mount.clientHeight || 640);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    const clock = new THREE.Clock();

    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const now = performance.now();
      const time = now / 1000;

      avatarRoot.rotation.y = THREE.MathUtils.damp(avatarRoot.rotation.y, targetRotation + Math.sin(time * 0.22) * 0.025, 4, dt);
      mixer?.update(dt);
      applyBodyMotion(now, dt);

      if (speaking) {
        const mouth = 0.48 + Math.max(0, Math.sin(time * 13)) * 0.30 + Math.sin(time * 29) * 0.08;
        setMorphs(morphTargets, THREE.MathUtils.clamp(mouth, 0, 0.9), 0.32);
      } else {
        setMorphs(morphTargets, 0, 0.12);
      }

      microExpressions?.update(now);
      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      microExpressions?.dispose();
      mixer?.stopAllAction();
      if (model) avatarRoot.remove(model);
      renderer.dispose();
      canvasContainer.remove();
    };
  }, []);

  return <div ref={mountRef} className="relative w-full h-full min-h-[500px]" />;
}
