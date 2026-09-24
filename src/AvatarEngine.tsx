import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

export type AvatarCommand =
  | { type: 'expression'; value: string }
  | { type: 'viseme'; value: string; weight?: number }
  | { type: 'gesture'; value: string }
  | { type: 'performance'; value: any };

type Props = {
  onStatus?: (status: string) => void;
  onApi?: (api: { command: (cmd: AvatarCommand) => void }) => void;
};

type BoneMap = {
  root: THREE.Bone | null;
  hips: THREE.Bone | null;
  spine: THREE.Bone | null;
  spine1: THREE.Bone | null;
  spine2: THREE.Bone | null;
  neck: THREE.Bone | null;
  neck1: THREE.Bone | null;
  neck2: THREE.Bone | null;
  head: THREE.Bone | null;

  lShoulder: THREE.Bone | null;
  rShoulder: THREE.Bone | null;
  lArm: THREE.Bone | null;
  rArm: THREE.Bone | null;
  lFore: THREE.Bone | null;
  rFore: THREE.Bone | null;
  lHand: THREE.Bone | null;
  rHand: THREE.Bone | null;
  lThigh: THREE.Bone | null;
  rThigh: THREE.Bone | null;
  lCalf: THREE.Bone | null;
  rCalf: THREE.Bone | null;
  lFoot: THREE.Bone | null;
  rFoot: THREE.Bone | null;
  jaw: THREE.Bone | null;

  lEye: THREE.Bone | null;
  rEye: THREE.Bone | null;
};

type Morph = {
  mesh: THREE.Mesh;
  index: number;
  name: string;
};

const SRC = `${import.meta.env.BASE_URL}avatar/model.fbx`;

const norm = (s: string) =>
  s.replace(/[^a-z0-9]/gi, '').toLowerCase();

function findExactBone(
  root: THREE.Object3D,
  names: string[],
): THREE.Bone | null {
  const wanted = new Set(names.map(norm));
  let result: THREE.Bone | null = null;

  root.traverse((object) => {
    if (result) return;

    if (!(object instanceof THREE.Bone)) return;

    if (wanted.has(norm(object.name))) {
      result = object;
    }
  });

  return result;
}

function findAncestorBone(
  start: THREE.Bone | null,
  names: string[],
): THREE.Bone | null {
  if (!start) return null;

  const wanted = new Set(names.map(norm));
  let current: THREE.Object3D | null = start.parent;

  while (current) {
    if (current instanceof THREE.Bone && wanted.has(norm(current.name))) {
      return current;
    }
    current = current.parent;
  }

  return null;
}

function collectDescendantBones(
  start: THREE.Bone | null,
  pattern: RegExp,
): THREE.Bone[] {
  if (!start) return [];

  const result: THREE.Bone[] = [];

  start.traverse((object) => {
    if (!(object instanceof THREE.Bone)) return;
    if (pattern.test(norm(object.name))) result.push(object);
  });

  return result;
}

function findBones(root: THREE.Object3D): BoneMap {
  const bones: BoneMap = {
    root: null,
    hips: null,
    spine: null,
    spine1: null,
    spine2: null,
    neck: null,
    neck1: null,
    neck2: null,
    head: null,

    lShoulder: null,
    rShoulder: null,
    lArm: null,
    rArm: null,
    lFore: null,
    rFore: null,
    lHand: null,
    rHand: null,
    lThigh: null,
    rThigh: null,
    lCalf: null,
    rCalf: null,
    lFoot: null,
    rFoot: null,
    jaw: null,
    lEye: null,
    rEye: null,
  };

  bones.root = findExactBone(root, [
    'Root',
    'RootNode',
    'Armature',
  ]);

  bones.hips = findExactBone(root, [
    'Hips',
    'Hip',
    'Pelvis',
  ]);

  bones.spine = findExactBone(root, ['Spine']);
  bones.spine1 = findExactBone(root, ['Spine1']);
  bones.spine2 = findExactBone(root, ['Spine2']);
  bones.neck = findExactBone(root, ['Neck']);
  bones.neck1 = findExactBone(root, ['Neck1']);
  bones.neck2 = findExactBone(root, ['Neck2']);
  bones.head = findExactBone(root, ['Head']);

  bones.lHand = findExactBone(root, ['LeftHand', 'LHand']);
  bones.rHand = findExactBone(root, ['RightHand', 'RHand']);

  // The FBX contains parallel forearm branches (for example LeftForeArm1/2).
  // Resolve the actual deforming chain from the hand upward instead of picking
  // the first matching name in the scene.
  bones.lFore =
    findAncestorBone(bones.lHand, [
      'LeftForeArm',
      'LeftForeArm1',
      'LeftForeArm2',
      'LeftLowerArm',
      'LForeArm',
      'LForeArm1',
      'LForeArm2',
    ]) ??
    findExactBone(root, ['LeftForeArm', 'LeftForeArm1', 'LeftForeArm2']);

  bones.rFore =
    findAncestorBone(bones.rHand, [
      'RightForeArm',
      'RightForeArm1',
      'RightForeArm2',
      'RightLowerArm',
      'RForeArm',
      'RForeArm1',
      'RForeArm2',
    ]) ??
    findExactBone(root, ['RightForeArm', 'RightForeArm1', 'RightForeArm2']);

  bones.lArm =
    findAncestorBone(bones.lFore, [
      'LeftArm',
      'LeftUpperArm',
      'LArm',
      'LUpperArm',
    ]) ??
    findExactBone(root, ['LeftArm', 'LeftUpperArm', 'LArm', 'LUpperArm']);

  bones.rArm =
    findAncestorBone(bones.rFore, [
      'RightArm',
      'RightUpperArm',
      'RArm',
      'RUpperArm',
    ]) ??
    findExactBone(root, ['RightArm', 'RightUpperArm', 'RArm', 'RUpperArm']);

  bones.lShoulder =
    findAncestorBone(bones.lArm, [
      'LeftShoulder',
      'LShoulder',
      'LeftClavicle',
      'LClavicle',
    ]) ??
    findExactBone(root, ['LeftShoulder', 'LShoulder']);

  bones.rShoulder =
    findAncestorBone(bones.rArm, [
      'RightShoulder',
      'RShoulder',
      'RightClavicle',
      'RClavicle',
    ]) ??
    findExactBone(root, ['RightShoulder', 'RShoulder']);

  bones.lFoot = findExactBone(root, [
    'LeftFoot',
    'LFoot',
    'LeftAnkle',
    'LAnkle',
  ]);
  bones.rFoot = findExactBone(root, [
    'RightFoot',
    'RFoot',
    'RightAnkle',
    'RAnkle',
  ]);

  // Resolve the leg chain from the actual foot bone. This avoids confusing
  // a bone named "LeftLeg" with either the thigh or calf when the FBX uses
  // a non-standard naming convention.
  bones.lCalf =
    findAncestorBone(bones.lFoot, [
      'LeftLeg',
      'LeftCalf',
      'LeftLowerLeg',
      'LCalf',
      'LLeg',
      'LLowerLeg',
    ]) ??
    findExactBone(root, [
      'LeftCalf',
      'LeftLowerLeg',
      'LCalf',
      'LLeg',
    ]);

  bones.rCalf =
    findAncestorBone(bones.rFoot, [
      'RightLeg',
      'RightCalf',
      'RightLowerLeg',
      'RCalf',
      'RLeg',
      'RLowerLeg',
    ]) ??
    findExactBone(root, [
      'RightCalf',
      'RightLowerLeg',
      'RCalf',
      'RLeg',
    ]);

  bones.lThigh =
    findAncestorBone(bones.lCalf, [
      'LeftUpLeg',
      'LeftThigh',
      'LeftUpperLeg',
      'LThigh',
      'LUpLeg',
      'LUpperLeg',
    ]) ??
    findExactBone(root, [
      'LeftUpLeg',
      'LeftThigh',
      'LeftUpperLeg',
      'LThigh',
      'LUpLeg',
    ]);

  bones.rThigh =
    findAncestorBone(bones.rCalf, [
      'RightUpLeg',
      'RightThigh',
      'RightUpperLeg',
      'RThigh',
      'RUpLeg',
      'RUpperLeg',
    ]) ??
    findExactBone(root, [
      'RightUpLeg',
      'RightThigh',
      'RightUpperLeg',
      'RThigh',
      'RUpLeg',
    ]);

  bones.jaw = findExactBone(root, ['Jaw', 'LowerJaw', 'Mandible']);

  bones.lEye = findExactBone(root, [
    'LeftEye',
    'LEye',
    'iEye',
  ]);

  bones.rEye = findExactBone(root, [
    'RightEye',
    'REye',
  ]);

  return bones;
}

export default function AvatarEngine({
  onStatus,
  onApi,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  const statusRef = useRef(onStatus);
const apiRef = useRef<{ command: (cmd: AvatarCommand) => void } | null>(null);
  const onApiRef = useRef(onApi);

  useEffect(() => {
    statusRef.current = onStatus;
    onApiRef.current = onApi;
  }, [onApi, onStatus]);

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) return;

    mount.style.cssText =
      'position:relative;width:100%;height:100%;min-height:560px;overflow:hidden';

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      38,
      1,
      0.01,
      1000,
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 1.5),
    );

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0, 0);

    renderer.domElement.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;display:block;z-index:2;pointer-events:none';

    mount.appendChild(renderer.domElement);

    scene.add(
      new THREE.HemisphereLight(
        0xd9f5ff,
        0x10141b,
        2.8,
      ),
    );

    const key = new THREE.DirectionalLight(
      0xffffff,
      3.4,
    );

    key.position.set(3, 6, 5);
    scene.add(key);

    const fill = new THREE.DirectionalLight(
      0x9beeff,
      1.8,
    );

    fill.position.set(-4, 3, 4);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(
      0xffffff,
      1.6,
    );

    rim.position.set(0, 5, -5);
    scene.add(rim);

    const root = new THREE.Group();
    scene.add(root);

    const loader = new FBXLoader();

    let model: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let activeAction: THREE.AnimationAction | null = null;
    let nativeMotion = false;

    let bones: BoneMap | null = null;

    let disposed = false;

    let gesture = 'idle';
    let gestureStarted = performance.now();

    let speaking = false;
    let expression = 'neutral';

    let performanceState = {
      head: 'neutral',
      body: 'idle',
      gaze: 'camera',
      intensity: 0.35,
      durationMs: 1800,
      startedAt: performance.now(),
    };

    let targetMouth = 0;
    let mouth = 0;

    let eyeTargetX = 0;
    let eyeTargetY = 0;
    let eyeX = 0;
    let eyeY = 0;
    let nextEyeShift = performance.now() + 700;

    let avatarFrame: {
      height: number;
      width: number;
      depth: number;
    } | null = null;

    let targetRotation = 0;
    let rotationStep = 0;
    const glassesObjects: THREE.Object3D[] = [];

    const morphs: Morph[] = [];
    const blinkMorphs: Morph[] = [];
    const expressionMorphs: Morph[] = [];
    const fingerBones: { left: THREE.Bone[]; right: THREE.Bone[] } = { left: [], right: [] };
    const adaptiveProfile = { arm: 1, forearm: 1, hand: 1, leg: 1, ankle: 1, spine: 1 };

    type RestBonePose = {
      worldQuaternion: THREE.Quaternion;
      worldDirection: THREE.Vector3;
    };

    // The FBX is not guaranteed to use X as the bend axis. Instead of
    // guessing an Euler axis, capture each deform bone's real rest-pose
    // direction and later aim that bone toward a desired world direction.
    // This keeps the same AvatarEngine as the single body controller while
    // making arm/leg motion independent of the FBX local-axis convention.
    const restPose = new Map<THREE.Bone, RestBonePose>();
    const restWorldPositions = new Map<THREE.Bone, THREE.Vector3>();

    const originalRotation = new Map<
      THREE.Bone,
      THREE.Euler
    >();

    const setStatus = (value: string) => {
      statusRef.current?.(value);
    };

    const rememberBone = (bone: THREE.Bone | null) => {
      if (!bone) return;

      if (!originalRotation.has(bone)) {
        originalRotation.set(
          bone,
          bone.rotation.clone(),
        );
      }
    };

    const rememberAllBones = (map: BoneMap) => {
      Object.values(map).forEach((value) => {
        if (value instanceof THREE.Bone) {
          rememberBone(value);
        }
      });
    };

    const captureRestPose = (root: THREE.Object3D) => {
      root.updateMatrixWorld(true);
      root.traverse((object) => {
        if (!(object instanceof THREE.Bone)) return;

        const child = object.children.find(
          (candidate): candidate is THREE.Bone =>
            candidate instanceof THREE.Bone,
        );

        if (!child) return;

        const start = new THREE.Vector3();
        const end = new THREE.Vector3();
        object.getWorldPosition(start);
        child.getWorldPosition(end);

        const direction = end.sub(start);
        if (direction.lengthSq() < 0.0001) return;

        const worldQuaternion = new THREE.Quaternion();
        object.getWorldQuaternion(worldQuaternion);

        restPose.set(object, {
          worldQuaternion: worldQuaternion.clone(),
          worldDirection: direction.normalize(),
        });
        restWorldPositions.set(object, start.clone());
      });
    };

    const dampRotation = (
      bone: THREE.Bone | null,
      axis: 'x' | 'y' | 'z',
      value: number,
      speed: number,
      dt: number,
    ) => {
      if (!bone) return;

      bone.rotation[axis] = THREE.MathUtils.damp(
        bone.rotation[axis],
        value,
        speed,
        dt,
      );
    };

    const addRotation = (
      bone: THREE.Bone | null,
      axis: 'x' | 'y' | 'z',
      amount: number,
      speed: number,
      dt: number,
    ) => {
      if (!bone) return;

      const base = originalRotation.get(bone);
      if (!base) return;

      dampRotation(
        bone,
        axis,
        base[axis] + amount,
        speed,
        dt,
      );
    };

    const poseBoneToward = (
      bone: THREE.Bone | null,
      worldDirection: THREE.Vector3,
      speed: number,
      dt: number,
    ) => {
      if (!bone || !bone.parent) return;

      const rest = restPose.get(bone);
      if (!rest) return;

      const direction = worldDirection.clone().normalize();
      if (direction.lengthSq() < 0.0001) return;

      // Rotate the rest-pose bone direction into the requested direction,
      // then convert the resulting world quaternion back into the bone's
      // parent-local space.
      const delta = new THREE.Quaternion().setFromUnitVectors(
        rest.worldDirection,
        direction,
      );
      const targetWorld = delta.multiply(rest.worldQuaternion.clone());
      const parentWorld = new THREE.Quaternion();
      bone.parent.getWorldQuaternion(parentWorld);

      const targetLocal = parentWorld
        .invert()
        .multiply(targetWorld);

      const alpha = 1 - Math.exp(-speed * Math.max(dt, 0.001));
      bone.quaternion.slerp(targetLocal, THREE.MathUtils.clamp(alpha, 0, 1));
    };

    const solveTwoBoneIK = (
      upper: THREE.Bone | null,
      lower: THREE.Bone | null,
      end: THREE.Bone | null,
      targetWorld: THREE.Vector3,
      poleWorld: THREE.Vector3,
      speed: number,
      dt: number,
    ) => {
      if (!upper || !lower || !end) return;

      model?.updateMatrixWorld(true);

      const rootPos = new THREE.Vector3();
      const midPos = new THREE.Vector3();
      const endPos = new THREE.Vector3();
      upper.getWorldPosition(rootPos);
      lower.getWorldPosition(midPos);
      end.getWorldPosition(endPos);

      const upperLength = Math.max(rootPos.distanceTo(midPos), 0.001);
      const lowerLength = Math.max(midPos.distanceTo(endPos), 0.001);

      const toTarget = targetWorld.clone().sub(rootPos);
      const rawDistance = toTarget.length();
      if (rawDistance < 0.001) return;

      const maxReach = Math.max(0.001, upperLength + lowerLength - 0.002);
      const minReach = Math.max(0.001, Math.abs(upperLength - lowerLength) + 0.002);
      const distance = THREE.MathUtils.clamp(rawDistance, minReach, maxReach);
      const target = rootPos.clone().add(toTarget.normalize().multiplyScalar(distance));

      // Human legs/arms are two-link chains. The pole vector chooses the
      // anatomical bend direction instead of independently aiming thigh/calf.
      const axis = target.clone().sub(rootPos).normalize();
      const pole = poleWorld.clone().sub(rootPos);
      pole.sub(axis.clone().multiplyScalar(pole.dot(axis)));
      if (pole.lengthSq() < 1e-6) pole.set(0, 0, -1);
      pole.normalize();

      const x = THREE.MathUtils.clamp(
        (upperLength * upperLength - lowerLength * lowerLength + distance * distance) /
          (2 * distance),
        -upperLength,
        upperLength,
      );
      const h = Math.sqrt(Math.max(0, upperLength * upperLength - x * x));
      const kneeTarget = rootPos
        .clone()
        .add(axis.clone().multiplyScalar(x))
        .add(pole.clone().multiplyScalar(h));

      poseBoneToward(upper, kneeTarget.clone().sub(rootPos).normalize(), speed, dt);

      // Re-read the knee after the upper leg rotates; this prevents the
      // lower leg from being aimed at an impossible independent direction.
      model?.updateMatrixWorld(true);
      lower.getWorldPosition(midPos);
      const lowerTargetDirection = target.clone().sub(midPos).normalize();
      poseBoneToward(lower, lowerTargetDirection, speed, dt);

      // Keep the ankle/hand approximately aligned with the requested target.
      const endDirection = target.clone().sub(midPos).normalize();
      if (endDirection.lengthSq() > 0.001) {
        poseBoneToward(lower, endDirection, speed, dt);
      }
    };

    const poseChain = (
      chain: Array<{ bone: THREE.Bone | null; direction: THREE.Vector3 }>,
      speed: number,
      dt: number,
    ) => {
      chain.forEach(({ bone, direction }) =>
        poseBoneToward(bone, direction, speed, dt),
      );
    };

    const restoreBone = (
      bone: THREE.Bone | null,
      speed: number,
      dt: number,
    ) => {
      if (!bone) return;

      const base = originalRotation.get(bone);

      if (!base) return;

      dampRotation(
        bone,
        'x',
        base.x,
        speed,
        dt,
      );

      dampRotation(
        bone,
        'y',
        base.y,
        speed,
        dt,
      );

      dampRotation(
        bone,
        'z',
        base.z,
        speed,
        dt,
      );
    };

    const restoreLowerBody = (
      map: BoneMap,
      speed: number,
      dt: number,
    ) => {
      [map.lThigh, map.rThigh, map.lCalf, map.rCalf, map.lFoot, map.rFoot]
        .forEach((bone) => restoreBone(bone, speed, dt));
    };

    const restoreUpperBody = (
      map: BoneMap,
      speed: number,
      dt: number,
    ) => {
      [
        map.lShoulder,
        map.rShoulder,
        map.lArm,
        map.rArm,
        map.lFore,
        map.rFore,
        map.lHand,
        map.rHand,
        map.head,
        map.neck,
        map.neck1,
        map.neck2,
        map.lEye,
        map.rEye,
      ].forEach((bone) =>
        restoreBone(bone, speed, dt),
      );
    };

    const restoreAllBones = (
      speed: number,
      dt: number,
    ) => {
      originalRotation.forEach((_base, bone) => restoreBone(bone, speed, dt));
    };

    const frameAvatar = () => {
      if (!avatarFrame) return;

      const vFov = THREE.MathUtils.degToRad(camera.fov);
      const aspect = Math.max(camera.aspect, 0.1);
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
      const distanceFromHeight = (avatarFrame.height * 1.10) / (2 * Math.tan(vFov / 2));
      const distanceFromWidth = (avatarFrame.width * 1.10) / (2 * Math.tan(hFov / 2));
      const distance = Math.max(distanceFromHeight, distanceFromWidth, avatarFrame.depth * 1.35);

      camera.position.set(0, avatarFrame.height * 0.50, distance);
      camera.lookAt(0, avatarFrame.height * 0.50, 0);
      camera.near = Math.max(0.01, avatarFrame.height / 1000);
      camera.far = Math.max(100, avatarFrame.height * 10);
      camera.updateProjectionMatrix();
    };

    const setMorph = (
      items: Morph[],
      value: number,
      alpha = 0.3,
    ) => {
      items.forEach(({ mesh, index }) => {
        if (!mesh.morphTargetInfluences) return;

        const current =
          mesh.morphTargetInfluences[index] ?? 0;

        mesh.morphTargetInfluences[index] =
          THREE.MathUtils.lerp(
            current,
            THREE.MathUtils.clamp(value, 0, 1),
            alpha,
          );
      });
    };

    const playNative = (
      patterns: RegExp[],
      loop: boolean,
      fallbackFirst = false,
    ) => {
      if (!mixer || !model) {
        nativeMotion = false;
        return false;
      }

      const clip =
        model.animations.find((candidate) =>
          patterns.some((pattern) =>
            pattern.test(norm(candidate.name)),
          ),
        ) ??
        (fallbackFirst
          ? model.animations[0]
          : undefined);

      if (!clip) {
        nativeMotion = false;
        return false;
      }

      const action = mixer.clipAction(clip);

      nativeMotion = true;
      action.reset();
      action.setEffectiveWeight(1);
      action.setEffectiveTimeScale(1);

      action.setLoop(
        loop ? THREE.LoopRepeat : THREE.LoopOnce,
        loop ? Infinity : 1,
      );

      action.clampWhenFinished = !loop;

      if (
        activeAction &&
        activeAction !== action
      ) {
        activeAction.fadeOut(0.16);
        action.fadeIn(0.16);
      }

      action.play();
      activeAction = action;

      return true;
    };

    const stopNativeMotion = () => {
      if (mixer) {
        mixer.stopAllAction();
      }
      activeAction = null;
      nativeMotion = false;
    };

    const createFurniture = (height: number) => {
      const group = new THREE.Group();
      group.name = 'AURA_HUMAN_ENVIRONMENT';

      const scale = Math.max(height, 1);
      const wood = new THREE.MeshStandardMaterial({
        color: 0x3a4652,
        metalness: 0.15,
        roughness: 0.62,
        transparent: true,
        opacity: 0.78,
      });
      const seat = new THREE.MeshStandardMaterial({
        color: 0x20384a,
        metalness: 0.08,
        roughness: 0.72,
        transparent: true,
        opacity: 0.88,
      });

      const makeBox = (w: number, h: number, d: number, material: THREE.Material) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        group.add(mesh);
        return mesh;
      };

      const chair = new THREE.Group();
      chair.name = 'AURA_CHAIR';
      const seatW = scale * 0.34;
      const seatH = scale * 0.45;
      const seatD = scale * 0.34;
      makeBox(seatW, scale * 0.055, seatD, seat).position.y = seatH;
      makeBox(seatW, scale * 0.48, scale * 0.055, seat).position.set(0, seatH + scale * 0.24, -seatD * 0.43);
      const legH = seatH;
      for (const x of [-1, 1]) {
        for (const z of [-1, 1]) {
          makeBox(scale * 0.035, legH, scale * 0.035, wood).position.set(
            x * seatW * 0.42,
            legH * 0.5,
            z * seatD * 0.42,
          );
        }
      }
      chair.position.set(-scale * 0.72, 0, -scale * 0.02);
      group.add(chair);

      const table = new THREE.Group();
      table.name = 'AURA_TABLE';
      const tableW = scale * 0.72;
      const tableD = scale * 0.46;
      const tableH = scale * 0.56;
      makeBox(tableW, scale * 0.045, tableD, wood).position.y = tableH;
      for (const x of [-1, 1]) {
        for (const z of [-1, 1]) {
          makeBox(scale * 0.035, tableH, scale * 0.035, wood).position.set(
            x * tableW * 0.42,
            tableH * 0.5,
            z * tableD * 0.40,
          );
        }
      }
      // Workstation is placed in front of the chair so seated writing uses
      // a natural hip-to-elbow reach rather than twisting sideways.
      chair.position.set(-scale * 0.42, 0, -scale * 0.06);
      table.position.set(-scale * 0.42, 0, scale * 0.48);

      const book = new THREE.Group();
      book.name = 'AURA_BOOK';
      const cover = makeBox(scale * 0.28, scale * 0.018, scale * 0.20, seat);
      cover.position.set(-scale * 0.08, tableH + scale * 0.025, 0);
      cover.rotation.x = -0.12;
      const pages = makeBox(scale * 0.25, scale * 0.014, scale * 0.18, wood);
      pages.position.set(-scale * 0.08, tableH + scale * 0.043, 0);
      pages.rotation.x = -0.12;
      book.position.set(table.position.x, 0, table.position.z);
      table.add(book);

      const pad = new THREE.Group();
      pad.name = 'AURA_NOTEPAD';
      const padMesh = makeBox(scale * 0.32, scale * 0.014, scale * 0.24, wood);
      padMesh.position.y = tableH + scale * 0.032;
      padMesh.rotation.x = -0.03;
      pad.position.set(scale * 0.15, 0, scale * 0.02);
      table.add(pad);

      const pen = new THREE.Mesh(
        new THREE.CylinderGeometry(scale * 0.012, scale * 0.012, scale * 0.20, 10),
        wood,
      );
      pen.name = 'AURA_PEN';
      pen.rotation.z = Math.PI / 2;
      pen.position.set(scale * 0.12, tableH + scale * 0.055, scale * 0.14);
      table.add(pen);

      bookObject = book;
      notepadObject = pad;
      penObject = pen;

      scene.add(group);
      return group;
    };

    let furniture: THREE.Group | null = null;
    let bookObject: THREE.Group | null = null;
    let notepadObject: THREE.Group | null = null;
    let penObject: THREE.Mesh | null = null;

    const setGlasses = (visible: boolean) => {
      glassesObjects.forEach((object) => { object.visible = visible; });
      setStatus(`3D AVATAR • GLASSES ${visible ? 'ON' : 'OFF'}`);
    };

    const runGesture = (raw: string) => {
      const value = raw
        .toLowerCase()
        .replace(/[_\s]+/g, '-')
        .replace(/--+/g, '-')
        .trim();

      if (value === 'reset-rotation' || value === 'face-front' || value === 'front') {
        rotationStep = 0;
        targetRotation = 0;
        setStatus('3D AVATAR • FRONT');
        return;
      }

      if (value === 'rotate' || value === 'turn' || value === 'turn-around' || value === 'rotate-step' || value === 'turn-step') {
        rotationStep += THREE.MathUtils.degToRad(45);
        targetRotation = rotationStep;
        setStatus('3D AVATAR • ROTATION STEP 45°');
        return;
      }

      if (/^(calibrate|self-check|diagnose|diagnostics)$/.test(value)) {
        setStatus('NEERAJ SELF-CHECK • ARMS ' + [bones?.lArm, bones?.rArm, bones?.lFore, bones?.rFore].filter(Boolean).length + ' • FINGERS ' + (fingerBones.left.length + fingerBones.right.length) + ' • LEGS ' + [bones?.lThigh, bones?.rThigh, bones?.lCalf, bones?.rCalf].filter(Boolean).length + ' • FACE ' + (morphs.length + (bones?.jaw ? 1 : 0)));
        return;
      }

      if (/^blink$/.test(value)) {
        blinkUntil = performance.now() + 180;
        setStatus('3D AVATAR • BLINK TEST');
        return;
      }

      if (/^jaw$/.test(value)) {
        targetMouth = 0.75;
        speaking = true;
        setStatus('3D AVATAR • JAW / LIP TEST');
        return;
      }

      if (/^(look-left|look-right|look-up|look-down|look)$/.test(value)) {
        gesture = value === 'look' ? 'eyes' : value;
        gestureStarted = performance.now();
        stopNativeMotion();
        setStatus(`3D AVATAR • ${gesture.toUpperCase()} TEST`);
        return;
      }

      if (/^(left-arm-up|right-arm-up|arms-up|cross-arms|fingers)$/.test(value)) {
        gesture = value;
        gestureStarted = performance.now();
        stopNativeMotion();
        setStatus(`3D AVATAR • ${value.toUpperCase()} TEST`);
        return;
      }

      if (/^(glasses|spectacles|eyewear|glasses-on|spectacles-on)$/.test(value)) {
        setGlasses(true);
        return;
      }

      if (/^(no-glasses|glasses-off|spectacles-off|remove-glasses|remove-spectacles)$/.test(value)) {
        setGlasses(false);
        return;
      }

      if (/\b(acknowledge|acknowledgement|nod|nodding|yes|agree|agreement)\b/.test(value)) {
        gesture = 'nod';
      } else if (/\b(chin-touch|chin|thinking-hand|think)\b/.test(value)) {
        gesture = 'chin-touch';
      } else if (/\b(namaste)\b/.test(value)) {
        gesture = 'present';
      } else if (/\b(bye-wave|wave|waving|greet|greeting|hello|hi|welcome)\b/.test(value)) {
        gesture = 'wave';
      } else if (/\b(read|reading|read-book|reading-book|book)\b/.test(value)) {
        gesture = 'read-book';
      } else if (/\b(write|writing|write-note|write-notepad|note-taking|take-notes)\b/.test(value)) {
        gesture = 'write-notepad';
      } else if (/\b(cross-legs|crossed-legs|leg-over-thigh|legs-crossed)\b/.test(value)) {
        gesture = 'cross-sit';
      } else if (/\b(hold-chair|holding-chair|chair-support)\b/.test(value)) {
        gesture = 'hold-chair';
      } else if (/\b(point|pointing|indicate|indicating)\b/.test(value)) {
        gesture = 'point';
      } else if (/\b(present|presenting|explain|explaining|show|showing|open-hand|open-palms|emphasis|demonstrate)\b/.test(value)) {
        gesture = 'present';
      } else if (/\b(handshake|hand-shake|shake-hand|shake-hands)\b/.test(value)) {
        gesture = 'handshake';
      } else if (/\b(shrug|shrugging|uncertain|uncertainty)\b/.test(value)) {
        gesture = 'shrug';
      } else if (/\b(laugh|laughing|laughter)\b/.test(value)) {
        gesture = 'laugh';
        expression = 'excited';
      } else if (/\b(smile|smiling|happy|happiness)\b/.test(value)) {
        gesture = 'smile';
        expression = 'smile';
      } else if (/\b(eyes|eye-contact|look|looking|gaze)\b/.test(value)) {
        gesture = 'eyes';
      } else if (/\b(run|running|sprint|sprinting)\b/.test(value)) {
        gesture = 'run';
      } else if (/\b(walk|walking|step|stepping|locomotion)\b/.test(value)) {
        gesture = 'walk';
      } else if (/\b(jump|jumping|leap|leaping)\b/.test(value)) {
        gesture = 'jump';
      } else if (/\b(full-body|fullbody|performance|perform)\b/.test(value)) {
        gesture = 'full-body';
      } else if (/\b(clothes|clothing|adjust-clothes|adjust-clothing)\b/.test(value)) {
        gesture = 'clothes';
      } else if (/\b(crouch|crouching|squat|squatting)\b/.test(value)) {
        gesture = 'crouch';
      } else if (/\b(back-bend|backbend|lean-back|leaning-back)\b/.test(value)) {
        gesture = 'back-bend';
      } else if (/\b(bend|bending|bow|bowing|lean-forward|leaning-forward)\b/.test(value)) {
        gesture = 'bend';
      } else if (/\b(go-to-chair|sit-on-chair|sit-chair|go-sit-chair|chair)\b/.test(value) ||
                 /\b(go|walk|move).*\b(sit|chair)\b/.test(value)) {
        gesture = 'sit-chair';
      } else if (/\b(sit|sitting|sit-down|sitdown)\b/.test(value)) {
        gesture = 'sit';
      } else if (/\b(stand|standing|stand-up|standup|rise|get-up)\b/.test(value)) {
        gesture = 'stand';
      } else if (/\b(idle|neutral|rest|reset|stop)\b/.test(value)) {
        gesture = 'idle';
      } else {
        gesture = 'idle';
      }

      gestureStarted = performance.now();
      stopNativeMotion();

      // Native idle is the only authored FBX clip allowed to drive the rig.
      // Active gestures remain procedural so one controller owns the body bones.
      const nativePatterns: Record<string, RegExp[]> = {
        idle: [/idle/, /stand/, /breath/, /rest/, /neutral/],
      };

      const patterns = nativePatterns[gesture] ?? [];
      // Only idle is allowed to use an authored FBX clip. Active movement is
      // owned by the rig-aware controller so the shoulder/elbow/wrist/fingers,
      // hips/knees/ankles and neck are never locked by a competing clip.
      if (gesture === 'idle' && patterns.length) {
        nativeMotion = playNative(patterns, true);
      } else {
        nativeMotion = false;
      }

      setStatus(
        `3D AVATAR • ${gesture.toUpperCase()} • ${nativeMotion ? 'NATIVE' : 'PROCEDURAL FALLBACK'}`,
      );
    };

    const command = (cmd: AvatarCommand) => {
      if (cmd.type === 'performance') {
        const value = cmd.value ?? {};

        if (typeof value.speaking === 'boolean') {
          speaking = value.speaking;
        }

        if (typeof value.gesture === 'string') {
          runGesture(value.gesture);
        }

        const expressionSource =
          typeof value.expression === 'string'
            ? value.expression
            : typeof value.emotion === 'string'
              ? value.emotion
              : 'neutral';

        const normalizedExpression = expressionSource.toLowerCase();
        if (/smile|happy|warm|kind|positive|confident/.test(normalizedExpression)) {
          expression = 'smile';
        } else if (/sad|grief|hurt/.test(normalizedExpression)) {
          expression = 'sad';
        } else if (/thinking|thoughtful|confused|curious|smart/.test(normalizedExpression)) {
          expression = 'thinking';
        } else if (/surprise|excited|energetic|joyful/.test(normalizedExpression)) {
          expression = 'excited';
        } else if (/firm|angry|assertive|focused/.test(normalizedExpression)) {
          expression = 'firm';
        } else {
          expression = 'neutral';
        }

        performanceState = {
          head: typeof value.head === 'string' ? value.head.toLowerCase() : 'neutral',
          body: typeof value.body === 'string' ? value.body.toLowerCase() : 'idle',
          gaze: typeof value.gaze === 'string' ? value.gaze.toLowerCase() : 'camera',
          intensity: THREE.MathUtils.clamp(Number(value.intensity ?? 0.35), 0.15, 0.85),
          durationMs: Math.max(300, Math.min(10000, Number(value.duration_ms ?? 1800))),
          startedAt: performance.now(),
        };

        setStatus(
          `NEERAJ PERFORMANCE • ${performanceState.body.toUpperCase()} • ${performanceState.head.toUpperCase()} • ${performanceState.gaze.toUpperCase()}`,
        );
        return;
      }

      if (cmd.type === 'viseme') {
        targetMouth =
          /silence|close|rest/i.test(
            cmd.value,
          )
            ? 0
            : THREE.MathUtils.clamp(
                Number(cmd.weight ?? 0),
                0,
                1,
              );

        return;
      }

      if (cmd.type === 'expression') {
        const value =
          cmd.value.toLowerCase();

        if (
          /speaking|talk/.test(value)
        ) {
          speaking = true;
        }

        if (
          /neutral|rest|stop/.test(value)
        ) {
          speaking = false;
          expression = 'neutral';

          playNative(
            [/idle/, /stand/, /breath/, /rest/, /neutral/],
            true,
            true,
          );
        }

        if (
          /smile|happy|warm|positive|confident/.test(
            value,
          )
        ) {
          expression = 'smile';
        }

        if (/sad/.test(value)) {
          expression = 'sad';
        }

        return;
      }

      runGesture(cmd.value);
    };

    apiRef.current = {
      command,
    };

    onApiRef.current?.({
      command,
    });

    loader.load(
      SRC,
      (loaded) => {
        if (disposed) return;

        model = loaded;

        root.add(loaded);

        loaded.traverse((object) => {
          const avatarObjectName = norm(object.name);
          if (/glasses|spectacles|eyewear|eyeglass|sunglasses/.test(avatarObjectName)) {
            glassesObjects.push(object);
            object.visible = false;
          }

          if (object instanceof THREE.Bone) {
            rememberBone(object);
            const n = norm(object.name);
            const isFinger = /finger|thumb|index|middle|ring|pinky|little|metacarp|proximal|distal/.test(n);
            if (isFinger && !/hand$|wrist|forearm|arm/.test(n)) {
              if (/left|^l/.test(n)) fingerBones.left.push(object);
              if (/right|^r/.test(n)) fingerBones.right.push(object);
            }
          }

          if (!(object instanceof THREE.Mesh))
            return;

          object.frustumCulled = false;

          if (
            object.morphTargetDictionary &&
            object.morphTargetInfluences
          ) {
            Object.entries(
              object.morphTargetDictionary,
            ).forEach(([name, index]) => {
              const item = {
                mesh: object,
                index,
                name,
              };

              const normalized = norm(name);

              if (
                /mouth|viseme|phoneme|lip|tongue|jaw|aa|ah|ao|oh|uh/.test(
                  normalized,
                )
              ) {
                morphs.push(item);
              }

              if (
                /blink|eyelid|eyeclose|closeeye|lidclose/.test(
                  normalized,
                )
              ) {
                blinkMorphs.push(item);
              }

              if (
                /smile|happy|sad|frown|brow|cheek|mouthsmile|lipcorner/.test(
                  normalized,
                )
              ) {
                expressionMorphs.push(item);
              }
            });
          }
        });

        bones = findBones(loaded);
        captureRestPose(loaded);

        // Drive only fingers that actually descend from the resolved hand
        // bones. This prevents unrelated/parallel FBX finger branches from
        // receiving the gesture controller's rotations.
        const leftHandFingerBones = collectDescendantBones(
          bones.lHand,
          /thumb|index|middle|ring|pinky|little|finger|metacarp|proximal|distal/,
        );

        const rightHandFingerBones = collectDescendantBones(
          bones.rHand,
          /thumb|index|middle|ring|pinky|little|finger|metacarp|proximal|distal/,
        );

        if (leftHandFingerBones.length || rightHandFingerBones.length) {
          fingerBones.left.length = 0;
          fingerBones.right.length = 0;
          fingerBones.left.push(...leftHandFingerBones);
          fingerBones.right.push(...rightHandFingerBones);
        }

        console.info('[Neeraj Avatar] MOTION ROOT CAUSE CHECK', { nativeClips: loaded.animations.map((c) => c.name), bones, fingerCount: fingerBones.left.length + fingerBones.right.length,
          morphCount: morphs.length,
          blinkMorphCount: blinkMorphs.length,
          expressionMorphCount: expressionMorphs.length,
          nativeProceduralConflictPolicy: 'procedural gestures own bones',
          missingCriticalJoints: Object.entries(bones).filter(([, value]) => !value).map(([name]) => name) });

        rememberAllBones(bones);

        mixer =
          new THREE.AnimationMixer(loaded);

        mixer.addEventListener('finished', (event) => {
          if (event.action !== activeAction) return;
          if (!event.action.clampWhenFinished) return;

          nativeMotion = false;
          gesture = 'idle';
          gestureStarted = performance.now();
          playNative(
            [/idle/, /stand/, /breath/, /rest/, /neutral/],
            true,
            true,
          );
        });

        loaded.updateMatrixWorld(true);

        const box =
          new THREE.Box3().setFromObject(
            loaded,
          );

        const center =
          box.getCenter(
            new THREE.Vector3(),
          );

        const size =
          box.getSize(
            new THREE.Vector3(),
          );

        const height =
          Math.max(size.y, 1);

        loaded.position.set(
          -center.x,
          -box.min.y,
          -center.z,
        );

        loaded.updateMatrixWorld(true);

        avatarFrame = {
          height,
          width: Math.max(size.x, 0.1),
          depth: Math.max(size.z, 0.1),
        };
        frameAvatar();

        // Re-capture after the FBX is grounded/repositioned so IK targets
        // are in the same world space as the normalized avatar.
        captureRestPose(loaded);
        furniture = createFurniture(height);
        bookObject?.traverse((object) => { object.visible = true; });
        notepadObject?.traverse((object) => { object.visible = true; });

        nativeMotion = playNative(
          [
            /idle/,
            /stand/,
            /breath/,
            /rest/,
            /neutral/,
          ],
          true,
          true,
        );

        const nativeStarted = nativeMotion;

        console.log(
          '[Neeraj Avatar] Skeleton:',
          {
            root: bones.root?.name,
            hips: bones.hips?.name,
            spine: bones.spine?.name,
            spine1: bones.spine1?.name,
            spine2: bones.spine2?.name,
            neck: bones.neck?.name,
            head: bones.head?.name,
            lShoulder: bones.lShoulder?.name,
            rShoulder: bones.rShoulder?.name,
            lArm: bones.lArm?.name,
            rArm: bones.rArm?.name,
            lFore: bones.lFore?.name,
            rFore: bones.rFore?.name,
            lHand: bones.lHand?.name,
            rHand: bones.rHand?.name,
            lThigh: bones.lThigh?.name,
            rThigh: bones.rThigh?.name,
            lCalf: bones.lCalf?.name,
            rCalf: bones.rCalf?.name,
            lFoot: bones.lFoot?.name,
            rFoot: bones.rFoot?.name,
            jaw: bones.jaw?.name,
            neck1: bones.neck1?.name,
            neck2: bones.neck2?.name,
            lEye: bones.lEye?.name,
            rEye: bones.rEye?.name,
          },
        );

        console.log(
          '[Neeraj Avatar] FBX animations:',
          loaded.animations.map(
            (clip) => clip.name,
          ),
        );

        console.log(
          '[Neeraj Avatar] Morph targets:',
          morphs.map(
            (item) => item.name,
          ),
        );

        setStatus(
          `NEERAJ AVATAR READY • FULL BODY • ${
            loaded.animations.length
          } FBX CLIP${
            loaded.animations.length === 1
              ? ''
              : 'S'
          } • ${
            nativeStarted
              ? 'NATIVE MOTION PLAYING'
              : 'PROCEDURAL MOTION'
          }`,
        );
      },
      undefined,
      (error) => {
        console.error(
          '[Neeraj Avatar] FBX load error',
          error,
        );

        setStatus(
          `NEERAJ AVATAR LOAD ERROR • ${
            error instanceof Error
              ? error.message
              : 'CHECK avatar/model.fbx'
          }`,
        );
      },
    );

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);

      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      frameAvatar();
    };

    resize();

    const resizeObserver =
      new ResizeObserver(resize);

    resizeObserver.observe(mount);

    const clock =
      new THREE.Clock();

    let nextBlink =
      performance.now() + 2200;

    let blinkUntil = 0;

    renderer.setAnimationLoop(() => {
      const dt = Math.min(
        clock.getDelta(),
        0.033,
      );

      const now =
        performance.now();

      const time =
        now * 0.001;

      mixer?.update(dt);

      root.rotation.y =
        THREE.MathUtils.damp(
          root.rotation.y,
          targetRotation,
          7,
          dt,
        );

      /*
       * BLINKING
       */
      if (
        now >= nextBlink &&
        now > blinkUntil
      ) {
        blinkUntil =
          now + 140;

        nextBlink =
          now +
          2600 +
          Math.random() * 2800;
      }

      setMorph(
        blinkMorphs,
        now < blinkUntil
          ? 1
          : 0,
        0.55,
      );

      /*
       * MOUTH / SPEECH
       */
      mouth =
        THREE.MathUtils.damp(
          mouth,
          speaking
            ? Math.max(
                targetMouth,
                0.16 +
                  Math.abs(
                    Math.sin(
                      time * 8,
                    ),
                  ) *
                    0.14,
              )
            : targetMouth,
          20,
          dt,
        );

      const openMouthMorphs = morphs.filter((item) =>
        /viseme|mouthopen|jawopen|phoneme|^aa$|^ah$|^ao$|^oh$|^uh$|open|vowel|talk|speech|lip/i.test(norm(item.name)),
      );
      // Some exports name the facial keys simply "mouth" or "lip". If the
      // FBX has facial morphs but no explicit open-mouth key, drive the facial
      // morph set rather than leaving the lips permanently sealed.
      const mouthTargets = openMouthMorphs.length ? openMouthMorphs : morphs;
      setMorph(mouthTargets, mouth, 0.72);

      // Always release the previous expression before applying the new one.
      // This prevents smile/brow shapes from becoming permanently stuck.
      setMorph(expressionMorphs, 0, 0.12);

      const faceExpression = expression;
      if (faceExpression !== 'neutral' && expressionMorphs.length) {
        const expressionTargets = expressionMorphs.filter((item) => {
          const n = norm(item.name);
          if (faceExpression === 'smile' || faceExpression === 'happy' || faceExpression === 'warm') {
            return /smile|happy|mouthsmile|lipcorner|cheek/.test(n);
          }
          if (faceExpression === 'sad' || faceExpression === 'concerned') {
            return /sad|frown|brow|mouthdown|lipcorner/.test(n);
          }
          if (faceExpression === 'surprised' || faceExpression === 'excited') {
            return /surprise|wide|brow|open/.test(n);
          }
          if (faceExpression === 'angry' || faceExpression === 'firm') {
            return /angry|frown|brow|tension/.test(n);
          }
          if (faceExpression === 'thinking' || faceExpression === 'confused') {
            return /brow|confus|think|frown/.test(n);
          }
          return false;
        });
        setMorph(expressionTargets, faceExpression === 'surprised' || faceExpression === 'excited' ? 0.42 : 0.34, 0.24);
      }

      // Fallback jaw articulation for FBX rigs without usable lip morphs.
      if (bones?.jaw) {
        const base = originalRotation.get(bones.jaw);
        if (base) {
          bones.jaw.rotation.x = THREE.MathUtils.damp(
            bones.jaw.rotation.x,
            base.x + mouth * 0.22,
            18,
            dt,
          );
        }
      }

      /*
       * PROCEDURAL ATTENTION LAYER
       *
       * One writer owns both eye bones in procedural idle.
       * PerformanceDirector contributes only a target offset here; it never
       * writes the eye bones independently.
       */
      if (bones && !nativeMotion && gesture === 'idle') {
        if (now >= nextEyeShift) {
          eyeTargetX = (Math.random() * 2 - 1) * 0.035;
          eyeTargetY = (Math.random() * 2 - 1) * 0.020;
          nextEyeShift = now + 900 + Math.random() * 1200;
        }

        const performanceAge =
          (now - performanceState.startedAt) /
          Math.max(performanceState.durationMs, 1);
        const pulse =
          Math.sin(Math.min(performanceAge, 1) * Math.PI);
        const attentionStrength =
          performanceState.intensity *
          (0.65 + 0.35 * pulse);
        const focusX =
          performanceState.gaze === 'soft_focus'
            ? -0.045 * attentionStrength
            : 0;
        const focusY =
          performanceState.gaze === 'soft_focus'
            ? -0.025 * attentionStrength
            : 0;

        eyeX = THREE.MathUtils.damp(
          eyeX,
          eyeTargetX + focusX,
          14,
          dt,
        );
        eyeY = THREE.MathUtils.damp(
          eyeY,
          eyeTargetY + focusY,
          14,
          dt,
        );

        addRotation(bones.lEye, 'y', eyeX, 14, dt);
        addRotation(bones.rEye, 'y', eyeX, 14, dt);
        addRotation(bones.lEye, 'x', eyeY, 14, dt);
        addRotation(bones.rEye, 'x', eyeY, 14, dt);
      }

      /*
       * PROCEDURAL BODY MOTION
       */
      if (bones && !nativeMotion) {
        /*
         * Procedural fallback is deliberately conservative. The FBX's own
         * authored clips are preferred because arbitrary rigs do not share
         * the same local bone axes.
         */
        restoreAllBones(10, dt);
        // All procedural gestures start from the captured rest pose each frame;
        // this prevents hand/elbow/leg rotations from accumulating or stacking.

        /*
         * EXECUTABLE PERFORMANCE LAYER
         *
         * PerformanceDirector supplies semantic head/body/gaze instructions.
         * They are converted here into small rig-aware offsets so the real FBX
         * performs instead of merely receiving a label.
         */
        // PerformanceDirector and gesture motion share the same bones.
        // Never stack both controllers: an explicit gesture owns the rig,
        // while PerformanceDirector offsets are applied only during idle.
        if (gesture === 'idle') {
          const performanceAge = (now - performanceState.startedAt) / Math.max(performanceState.durationMs, 1);
          const pulse = Math.sin(Math.min(performanceAge, 1) * Math.PI);
          const strength = performanceState.intensity * (0.65 + 0.35 * pulse);

        if (performanceState.head === 'small_nod') {
          const nod = Math.sin(time * 2.4) * 0.055 * strength;
          addRotation(bones.neck, 'x', nod * 0.35, 9, dt);
          addRotation(bones.neck1, 'x', nod * 0.25, 9, dt);
          addRotation(bones.neck2, 'x', nod * 0.20, 9, dt);
          addRotation(bones.head, 'x', nod, 9, dt);
        } else if (performanceState.head === 'slight_tilt') {
          addRotation(bones.neck, 'z', 0.045 * strength, 8, dt);
          addRotation(bones.neck1, 'z', 0.035 * strength, 8, dt);
          addRotation(bones.head, 'z', 0.075 * strength, 8, dt);
        } else if (performanceState.head === 'soft_tilt') {
          addRotation(bones.neck, 'z', 0.035 * strength, 8, dt);
          addRotation(bones.head, 'z', 0.065 * strength, 8, dt);
        } else if (performanceState.head === 'downward_soft') {
          addRotation(bones.neck, 'x', 0.055 * strength, 8, dt);
          addRotation(bones.neck1, 'x', 0.040 * strength, 8, dt);
          addRotation(bones.head, 'x', 0.080 * strength, 8, dt);
        } else if (performanceState.head === 'firm') {
          addRotation(bones.spine2, 'x', -0.025 * strength, 8, dt);
          addRotation(bones.neck, 'x', -0.018 * strength, 8, dt);
          addRotation(bones.head, 'x', -0.015 * strength, 8, dt);
        } else if (performanceState.head === 'upright') {
          addRotation(bones.spine2, 'x', -0.035 * strength, 8, dt);
          addRotation(bones.head, 'x', -0.018 * strength, 8, dt);
        }

        if (performanceState.body === 'open_posture' || performanceState.body === 'upright') {
          addRotation(bones.lShoulder, 'z', 0.035 * strength, 8, dt);
          addRotation(bones.rShoulder, 'z', -0.035 * strength, 8, dt);
          addRotation(bones.spine2, 'x', -0.025 * strength, 7, dt);
        } else if (performanceState.body === 'forward_lean') {
          addRotation(bones.spine, 'x', -0.045 * strength, 7, dt);
          addRotation(bones.spine1, 'x', -0.035 * strength, 7, dt);
          addRotation(bones.spine2, 'x', -0.025 * strength, 7, dt);
        } else if (performanceState.body === 'softened' || performanceState.body === 'relaxed') {
          addRotation(bones.spine2, 'x', 0.018 * strength, 7, dt);
          addRotation(bones.lShoulder, 'z', -0.025 * strength, 7, dt);
          addRotation(bones.rShoulder, 'z', 0.025 * strength, 7, dt);
          } else if (performanceState.body === 'athletic') {
            addRotation(bones.spine2, 'x', -0.035 * strength, 7, dt);
            addRotation(bones.lArm, 'z', 0.08 * strength, 7, dt);
            addRotation(bones.rArm, 'z', -0.08 * strength, 7, dt);
          }
        }

        /*
         * IDLE
         *
         * restoreAllBones() above already establishes the FBX rest pose.
         * Keep exactly one breathing layer here; authored FBX idle clips
         * already provide breathing and never enter this procedural branch.
         */
        if (gesture === 'idle') {
          addRotation(
            bones.spine,
            'x',
            Math.sin(time * 1.5) *
              0.018,
            5,
            dt,
          );

          addRotation(
            bones.head,
            'y',
            Math.sin(time * 0.8) *
              0.025,
            4,
            dt,
          );
        }

        /*
         * HEAD / NECK DIRECTION TESTS
         */
        else if (/^look-(left|right|up|down)$/.test(gesture)) {
          const horizontal = gesture === 'look-left' ? 0.42 : gesture === 'look-right' ? -0.42 : 0;
          const vertical = gesture === 'look-up' ? -0.24 : gesture === 'look-down' ? 0.24 : 0;
          addRotation(bones.lEye, 'y', horizontal, 12, dt);
          addRotation(bones.rEye, 'y', horizontal, 12, dt);
          addRotation(bones.lEye, 'x', vertical, 12, dt);
          addRotation(bones.rEye, 'x', vertical, 12, dt);
          addRotation(bones.neck, 'y', horizontal * 0.18, 8, dt);
          addRotation(bones.neck1, 'y', horizontal * 0.16, 8, dt);
          addRotation(bones.neck2, 'y', horizontal * 0.18, 8, dt);
          addRotation(bones.head, 'y', horizontal * 0.48, 9, dt);
          addRotation(bones.neck, 'x', vertical * 0.18, 8, dt);
          addRotation(bones.neck1, 'x', vertical * 0.14, 8, dt);
          addRotation(bones.neck2, 'x', vertical * 0.16, 8, dt);
          addRotation(bones.head, 'x', vertical * 0.48, 9, dt);
        }

        /*
         * ARM / HAND / FINGER TESTS
         */
        else if (gesture === 'left-arm-up' || gesture === 'right-arm-up' || gesture === 'arms-up') {
          const left = gesture !== 'right-arm-up';
          const right = gesture !== 'left-arm-up';
          if (left) {
            poseChain(
              [
                { bone: bones.lArm, direction: new THREE.Vector3(-0.22, 0.90, 0.32) },
                { bone: bones.lFore, direction: new THREE.Vector3(-0.08, 0.96, 0.24) },
              ],
              12,
              dt,
            );
          }
          if (right) {
            poseChain(
              [
                { bone: bones.rArm, direction: new THREE.Vector3(0.22, 0.90, 0.32) },
                { bone: bones.rFore, direction: new THREE.Vector3(0.08, 0.96, 0.24) },
              ],
              12,
              dt,
            );
          }
        }
        else if (gesture === 'cross-arms') {
          addRotation(bones.lArm, 'z', 0.48, 10, dt);
          addRotation(bones.rArm, 'z', -0.48, 10, dt);
          addRotation(bones.lFore, 'y', -0.72, 10, dt);
          addRotation(bones.rFore, 'y', 0.72, 10, dt);
        }
        else if (gesture === 'fingers') {
          const curl = (finger: THREE.Bone, index: number) => {
            const segment = Number(norm(finger.name).match(/[1-4]$/)?.[0] ?? 1);
            addRotation(finger, 'x', 0.10 + segment * 0.045 + Math.sin(time * 5 + index * 0.35) * 0.025, 12, dt);
          };
          fingerBones.left.forEach(curl);
          fingerBones.right.forEach(curl);
        }

        /*
         * WAVE
         */
        else if (
          gesture === 'wave'
        ) {
          restoreBone(
            bones.lArm,
            6,
            dt,
          );

          restoreBone(
            bones.lFore,
            6,
            dt,
          );

          const wavePhase = time * 8;
          poseChain(
            [
              {
                bone: bones.rArm,
                direction: new THREE.Vector3(0.18, 0.92, 0.18),
              },
              {
                bone: bones.rFore,
                direction: new THREE.Vector3(0.05, 0.98, 0.12),
              },
            ],
            12,
            dt,
          );

          // Wrist rotation is intentionally separate: waving needs a
          // visible side-to-side hand angle after the arm is raised.
          addRotation(
            bones.rHand,
            'y',
            Math.sin(wavePhase) * 0.34 * adaptiveProfile.hand,
            14,
            dt,
          );
          addRotation(
            bones.rHand,
            'z',
            Math.sin(wavePhase + Math.PI / 2) * 0.18 * adaptiveProfile.hand,
            14,
            dt,
          );
          fingerBones.right.forEach((finger, index) =>
            addRotation(finger, 'x', 0.08 + Math.sin(time * 7 + index * 0.22) * 0.05, 12, dt),
          );
        }

        /*
         * POINT
         */
        else if (gesture === 'point') {
          restoreBone(bones.lArm, 7, dt);
          restoreBone(bones.lFore, 7, dt);

          const shoulder = new THREE.Vector3();
          bones.rShoulder?.getWorldPosition(shoulder);
          const target = shoulder.clone().add(new THREE.Vector3(0.10, -0.05, 1.02));

          // Point uses the same natural forward reach as the handshake, but
          // terminates in a stable index-finger extension toward the front.
          solveTwoBoneIK(
            bones.rArm,
            bones.rFore,
            bones.rHand,
            target,
            shoulder.clone().add(new THREE.Vector3(0, 0, -1)),
            13,
            dt,
          );

          fingerBones.right.forEach((finger, index) => {
            const n = norm(finger.name);
            const isIndex = /index/.test(n);
            addRotation(finger, 'x', isIndex ? 0.0 : 0.20, 12, dt);
          });
          addRotation(bones.rHand, 'x', -0.03, 10, dt);
        }

        /*
         * PRESENT / OPEN HANDS
         */
        else if (
          gesture === 'present'
        ) {
          addRotation(
            bones.lArm,
            'z',
            0.65,
            12,
            dt,
          );

          addRotation(
            bones.rArm,
            'z',
            -0.65,
            12,
            dt,
          );

          addRotation(
            bones.lFore,
            'x',
            -0.25,
            12,
            dt,
          );

          addRotation(
            bones.rFore,
            'x',
            -0.25,
            12,
            dt,
          );

          addRotation(
            bones.lHand,
            'z',
            -0.12,
            12,
            dt,
          );

          addRotation(bones.rHand, 'z', 0.12 * adaptiveProfile.hand, 12, dt);
          fingerBones.left.forEach((finger) => addRotation(finger, 'x', 0.16, 10, dt));
          fingerBones.right.forEach((finger) => addRotation(finger, 'x', 0.16, 10, dt));
        }

        /*
         * HANDSHAKE
         */
        else if (gesture === 'handshake') {
          // Human handshake: reach -> contact -> smooth damped pumps -> return.
          // Published motion-capture work reports ~3.63 s total, with the
          // main shake concentrated in the middle contact phase.
          const elapsed = now - gestureStarted;
          const reach = THREE.MathUtils.clamp(elapsed / 920, 0, 1);
          const contact = THREE.MathUtils.clamp((elapsed - 920) / 1960, 0, 1);
          const retreat = THREE.MathUtils.clamp((elapsed - 2880) / 720, 0, 1);
          const smooth = (x: number) => x * x * (3 - 2 * x);

          const shoulder = new THREE.Vector3();
          bones.rShoulder?.getWorldPosition(shoulder);
          const reachTarget = shoulder.clone().add(new THREE.Vector3(0.10, -0.18, 0.54));
          const contactTarget = shoulder.clone().add(new THREE.Vector3(0.22, -0.20, 0.86));
          const retreatTarget = shoulder.clone().add(new THREE.Vector3(0.02, -0.04, 0.18));

          let target = reachTarget;
          if (elapsed < 920) {
            target = reachTarget.clone().lerp(contactTarget, smooth(reach));
          } else if (elapsed < 2880) {
            const pump = Math.sin(contact * Math.PI * 2.2) * 0.035 * (1 - contact * 0.25);
            target = contactTarget.clone().add(new THREE.Vector3(0, pump, 0));
          } else {
            target = contactTarget.clone().lerp(retreatTarget, smooth(retreat));
          }

          solveTwoBoneIK(
            bones.rArm,
            bones.rFore,
            bones.rHand,
            target,
            shoulder.clone().add(new THREE.Vector3(0, 0, -1)),
            14,
            dt,
          );

          // Wrist stays neutral; fingers close around the imagined handshake.
          addRotation(bones.rHand, 'x', 0.02 + Math.sin(elapsed * 0.006) * 0.015, 14, dt);
          fingerBones.right.forEach((finger) => addRotation(finger, 'x', 0.22, 12, dt));
        }

        /*
         * NOD
         */
        else if (
          gesture === 'nod'
        ) {
          restoreBone(
            bones.lArm,
            7,
            dt,
          );

          restoreBone(
            bones.rArm,
            7,
            dt,
          );

          addRotation(
            bones.head,
            'x',
            Math.sin(
              time * 4.2,
            ) *
              0.15,
            14,
            dt,
          );
        }

        /*
         * SHRUG
         */
        else if (
          gesture === 'shrug'
        ) {
          addRotation(
            bones.lShoulder,
            'z',
            -0.22,
            10,
            dt,
          );

          addRotation(
            bones.rShoulder,
            'z',
            0.22,
            10,
            dt,
          );

          addRotation(
            bones.lArm,
            'z',
            -0.15,
            10,
            dt,
          );

          addRotation(
            bones.rArm,
            'z',
            0.15,
            10,
            dt,
          );
        }

        /*
         * LAUGH
         */
        else if (
          gesture === 'laugh'
        ) {
          addRotation(
            bones.head,
            'x',
            Math.sin(time * 8) * 0.10,
            12,
            dt,
          );

          addRotation(
            bones.spine,
            'x',
            0.075 + Math.abs(Math.sin(time * 7)) * 0.035,
            9,
            dt,
          );

          addRotation(
            bones.spine1,
            'x',
            0.045 + Math.abs(Math.sin(time * 7)) * 0.025,
            9,
            dt,
          );

          // Facial morphs remain under the centralized mouth/expression layer.
        }

        /*
         * SMILE
         */
        else if (
          gesture === 'smile' ||
          expression === 'smile'
        ) {
          restoreUpperBody(
            bones,
            7,
            dt,
          );

          // Facial expression morphs are driven once by the centralized
          // expression layer above; this gesture only restores the body pose.
        }

        /*
         * EYE GESTURES
         */
        else if (
          gesture === 'eyes'
        ) {
          const gaze = Math.sin(time * 1.15) * 0.07;
          const vertical = Math.sin(time * 0.9 + 1) * 0.025;
          addRotation(bones.lEye, 'y', gaze, 10, dt);
          addRotation(bones.rEye, 'y', gaze, 10, dt);
          addRotation(bones.lEye, 'x', vertical, 10, dt);
          addRotation(bones.rEye, 'x', vertical, 10, dt);
          addRotation(bones.neck, 'y', gaze * 0.18, 6, dt);
          addRotation(bones.head, 'y', gaze * 0.35, 7, dt);
        }

        /*
         * CHIN TOUCH / THINKING
         */
        else if (gesture === 'chin-touch') {
          addRotation(bones.rShoulder, 'z', -0.18, 10, dt);
          addRotation(bones.rArm, 'z', -0.58, 10, dt);
          addRotation(bones.rFore, 'x', -1.00, 10, dt);
          addRotation(
            bones.rHand,
            'z',
            Math.sin(time * 1.5) * 0.04,
            10,
            dt,
          );
          addRotation(bones.head, 'x', 0.045, 8, dt);
        }

        /*
         * CLOTHES / SELF-ADJUSTMENT
         */
        else if (gesture === 'clothes') {
          addRotation(bones.rShoulder, 'z', -0.16, 10, dt);
          addRotation(bones.rArm, 'z', -0.34, 10, dt);
          addRotation(bones.rFore, 'x', -0.62, 10, dt);
          addRotation(
            bones.rHand,
            'z',
            Math.sin(time * 2) * 0.06,
            10,
            dt,
          );
          addRotation(bones.spine, 'x', 0.015, 8, dt);
        }

        /*
         * READING
         *
         * Reading couples the eyes/head, trunk, both shoulders and elbows.
         * The book remains a real scene object on the workstation.
         */
        else if (gesture === 'read-book') {
          const bookCenter = new THREE.Vector3();
          if (bookObject) bookObject.getWorldPosition(bookCenter);
          const leftShoulder = new THREE.Vector3();
          const rightShoulder = new THREE.Vector3();
          bones.lShoulder?.getWorldPosition(leftShoulder);
          bones.rShoulder?.getWorldPosition(rightShoulder);

          const leftBook = bookCenter.clone().add(new THREE.Vector3(-0.09, 0.05, -0.02));
          const rightBook = bookCenter.clone().add(new THREE.Vector3(0.09, 0.05, -0.02));

          solveTwoBoneIK(
            bones.lArm, bones.lFore, bones.lHand,
            leftBook, leftShoulder.clone().add(new THREE.Vector3(0, 0, -1)), 9, dt,
          );
          solveTwoBoneIK(
            bones.rArm, bones.rFore, bones.rHand,
            rightBook, rightShoulder.clone().add(new THREE.Vector3(0, 0, -1)), 9, dt,
          );

          addRotation(bones.lHand, 'z', -0.08, 8, dt);
          addRotation(bones.rHand, 'z', 0.08, 8, dt);
          addRotation(bones.spine, 'x', 0.055, 7, dt);
          addRotation(bones.spine1, 'x', 0.045, 7, dt);
          addRotation(bones.spine2, 'x', 0.030, 7, dt);
          addRotation(bones.neck, 'x', 0.10, 7, dt);
          addRotation(bones.head, 'x', 0.16, 7, dt);

          // Eyes alternate between the page and brief upward glances.
          const glance = Math.sin(time * 0.9) > 0.72 ? -0.045 : 0.035;
          addRotation(bones.lEye, 'x', glance, 9, dt);
          addRotation(bones.rEye, 'x', glance, 9, dt);
        }

        /*
         * WRITING
         *
         * Fine writing is led by the fingers/wrist while shoulder and elbow
         * stabilize the hand. This mirrors handwriting biomechanics.
         */
        else if (gesture === 'write-notepad') {
          const padCenter = new THREE.Vector3();
          if (notepadObject) notepadObject.getWorldPosition(padCenter);

          const rightShoulder = new THREE.Vector3();
          bones.rShoulder?.getWorldPosition(rightShoulder);
          const penTarget = padCenter.clone().add(new THREE.Vector3(0.02, 0.07, 0.01));

          solveTwoBoneIK(
            bones.rArm, bones.rFore, bones.rHand,
            penTarget, rightShoulder.clone().add(new THREE.Vector3(0, 0, -1)), 12, dt,
          );

          // Writing hand uses a tripod-like pinch: thumb/index lead, other
          // fingers support the pen. Small wrist oscillations form strokes.
          const stroke = time * 9.5;
          fingerBones.right.forEach((finger, index) => {
            const n = norm(finger.name);
            const isThumb = /thumb/.test(n);
            const isIndex = /index/.test(n);
            const bend = isThumb ? 0.18 : isIndex ? 0.08 : 0.30;
            addRotation(finger, 'x', bend + Math.sin(stroke + index * 0.18) * 0.012, 14, dt);
          });
          addRotation(bones.rHand, 'x', 0.16 + Math.sin(stroke) * 0.035, 12, dt);
          addRotation(bones.rHand, 'y', Math.sin(stroke * 0.72) * 0.035, 12, dt);

          // The left hand stabilizes the page instead of floating independently.
          const leftShoulder = new THREE.Vector3();
          bones.lShoulder?.getWorldPosition(leftShoulder);
          solveTwoBoneIK(
            bones.lArm, bones.lFore, bones.lHand,
            padCenter.clone().add(new THREE.Vector3(-0.11, 0.07, 0.02)),
            leftShoulder.clone().add(new THREE.Vector3(0, 0, -1)), 9, dt,
          );
          fingerBones.left.forEach((finger) => addRotation(finger, 'x', 0.22, 10, dt));

          // Normal desk writing posture: slight forward trunk lean, relaxed
          // neck and elbows supported around the tabletop height.
          addRotation(bones.spine, 'x', 0.10, 7, dt);
          addRotation(bones.spine1, 'x', 0.075, 7, dt);
          addRotation(bones.spine2, 'x', 0.045, 7, dt);
          addRotation(bones.neck, 'x', 0.055, 7, dt);
          addRotation(bones.head, 'x', 0.09, 7, dt);

          // Move the pen with the writing hand after the hand pose has settled.
          if (penObject && bones.rHand) {
            const handPosition = new THREE.Vector3();
            const handQuaternion = new THREE.Quaternion();
            bones.rHand.getWorldPosition(handPosition);
            bones.rHand.getWorldQuaternion(handQuaternion);
            penObject.position.copy(handPosition);
            penObject.quaternion.copy(handQuaternion);
            penObject.scale.setScalar(0.72);
          }
        }

        /*
         * CROSS-LEGGED SEATED POSTURE
         */
        else if (gesture === 'cross-sit') {
          const seatY = (avatarFrame?.height ?? 1) * 0.43;
          root.position.y = THREE.MathUtils.damp(root.position.y, -(avatarFrame?.height ?? 1) * 0.075, 5, dt);

          const rightThigh = new THREE.Vector3();
          const leftThigh = new THREE.Vector3();
          bones.rThigh?.getWorldPosition(rightThigh);
          bones.lThigh?.getWorldPosition(leftThigh);

          // Left ankle travels across and rests over the right thigh.
          const leftFootTarget = rightThigh.clone().add(new THREE.Vector3(0.08, 0.03, 0.02));
          solveTwoBoneIK(
            bones.lThigh, bones.lCalf, bones.lFoot,
            leftFootTarget,
            leftThigh.clone().add(new THREE.Vector3(0, 0, -1)), 8, dt,
          );
          restoreBone(bones.rThigh, 7, dt);
          restoreBone(bones.rCalf, 7, dt);
          restoreBone(bones.rFoot, 7, dt);

          poseChain([
            { bone: bones.spine, direction: new THREE.Vector3(0, 0.995, 0.05) },
            { bone: bones.spine1, direction: new THREE.Vector3(0, 0.995, 0.04) },
            { bone: bones.spine2, direction: new THREE.Vector3(0, 0.995, 0.03) },
          ], 7, dt);
          addRotation(bones.head, 'x', -0.01, 6, dt);
        }

        /*
         * HOLD CHAIR
         */
        else if (gesture === 'hold-chair') {
          const chairWorld = new THREE.Vector3();
          const chair = furniture?.getObjectByName('AURA_CHAIR');
          if (chair) chair.getWorldPosition(chairWorld);
          const leftShoulder = new THREE.Vector3();
          bones.lShoulder?.getWorldPosition(leftShoulder);
          solveTwoBoneIK(
            bones.lArm, bones.lFore, bones.lHand,
            chairWorld.clone().add(new THREE.Vector3(-0.15, 0.48 * (avatarFrame?.height ?? 1), 0.05)),
            leftShoulder.clone().add(new THREE.Vector3(0, 0, -1)), 10, dt,
          );
          addRotation(bones.spine, 'x', 0.02, 6, dt);
        }

        /*
         * WALK / RUN / JUMP LEG TESTS
         */
        else if (gesture === 'walk' || gesture === 'run') {
          const fast = gesture === 'run';
          const phase = time * (fast ? 7.2 : 4.8);
          const leftSwing = Math.sin(phase);
          const rightSwing = Math.sin(phase + Math.PI);

          const leftFootRest = restWorldPositions.get(bones.lFoot!);
          const rightFootRest = restWorldPositions.get(bones.rFoot!);

          const gaitTarget = (
            foot: THREE.Vector3 | undefined,
            swing: number,
            phaseOffset: number,
          ) => {
            const base = foot?.clone();
            if (!base) return null;
            const swingDistance = fast ? 0.26 : 0.18;
            const clearance = fast ? 0.10 : 0.055;
            const lift = Math.max(0, Math.sin(phaseOffset)) * clearance;
            return base.add(new THREE.Vector3(0, lift, swing * swingDistance));
          };

          const leftTarget = gaitTarget(leftFootRest, leftSwing, phase + Math.PI / 2);
          const rightTarget = gaitTarget(rightFootRest, rightSwing, phase + Math.PI / 2 + Math.PI);

          // The knee pole is deliberately behind the body (-Z). The solver
          // makes the knee bend backward while the ankle follows the foot
          // target; no independent calf direction can pull the leg upward.
          if (leftTarget) {
            const hip = new THREE.Vector3();
            bones.lThigh?.getWorldPosition(hip);
            solveTwoBoneIK(
              bones.lThigh,
              bones.lCalf,
              bones.lFoot,
              leftTarget,
              hip.clone().add(new THREE.Vector3(0, 0, -1)),
              12,
              dt,
            );
          }
          if (rightTarget) {
            const hip = new THREE.Vector3();
            bones.rThigh?.getWorldPosition(hip);
            solveTwoBoneIK(
              bones.rThigh,
              bones.rCalf,
              bones.rFoot,
              rightTarget,
              hip.clone().add(new THREE.Vector3(0, 0, -1)),
              12,
              dt,
            );
          }

          // Small, anatomically plausible pelvic and arm counter-motion.
          addRotation(bones.hips, 'y', Math.sin(phase) * 0.035, 7, dt);
          addRotation(bones.hips, 'z', Math.sin(phase + Math.PI / 2) * 0.025, 7, dt);
          addRotation(bones.spine, 'z', Math.sin(phase) * 0.012, 7, dt);
          addRotation(bones.spine1, 'z', Math.sin(phase) * 0.008, 7, dt);

          const leftShoulder = new THREE.Vector3();
          const rightShoulder = new THREE.Vector3();
          bones.lShoulder?.getWorldPosition(leftShoulder);
          bones.rShoulder?.getWorldPosition(rightShoulder);
          solveTwoBoneIK(
            bones.lArm,
            bones.lFore,
            bones.lHand,
            leftShoulder.clone().add(new THREE.Vector3(-0.03, -0.12, -0.08 * rightSwing)),
            leftShoulder.clone().add(new THREE.Vector3(0, 0, 1)),
            7,
            dt,
          );
          solveTwoBoneIK(
            bones.rArm,
            bones.rFore,
            bones.rHand,
            rightShoulder.clone().add(new THREE.Vector3(0.03, -0.12, -0.08 * leftSwing)),
            rightShoulder.clone().add(new THREE.Vector3(0, 0, 1)),
            7,
            dt,
          );
        }

        else if (gesture === 'bend') {
          // Forward bend is distributed progressively through the spine.
          poseChain(
            [
              { bone: bones.spine, direction: new THREE.Vector3(0, 0.96, 0.42) },
              { bone: bones.spine1, direction: new THREE.Vector3(0, 0.91, 0.55) },
              { bone: bones.spine2, direction: new THREE.Vector3(0, 0.86, 0.63) },
            ],
            7,
            dt,
          );
        }

        else if (gesture === 'back-bend') {
          poseChain(
            [
              { bone: bones.spine, direction: new THREE.Vector3(0, 0.98, -0.30) },
              { bone: bones.spine1, direction: new THREE.Vector3(0, 0.94, -0.42) },
              { bone: bones.spine2, direction: new THREE.Vector3(0, 0.90, -0.48) },
            ],
            6,
            dt,
          );
        }

        else if (gesture === 'crouch') {
          poseChain(
            [
              { bone: bones.lThigh, direction: new THREE.Vector3(0, -0.70, 0.72) },
              { bone: bones.rThigh, direction: new THREE.Vector3(0, -0.70, 0.72) },
              { bone: bones.lCalf, direction: new THREE.Vector3(0, -0.72, -0.69) },
              { bone: bones.rCalf, direction: new THREE.Vector3(0, -0.72, -0.69) },
            ],
            8,
            dt,
          );
          poseChain(
            [
              { bone: bones.spine, direction: new THREE.Vector3(0, 0.98, 0.08) },
              { bone: bones.spine1, direction: new THREE.Vector3(0, 0.96, 0.12) },
            ],
            7,
            dt,
          );
        }

        else if (gesture === 'jump') {
          const t = THREE.MathUtils.clamp((now - gestureStarted) / 900, 0, 1);
          const arc = Math.sin(Math.PI * t);
          const crouch = t < 0.24 ? t / 0.24 : t > 0.76 ? (1 - t) / 0.24 : 0;

          poseChain(
            [
              { bone: bones.lThigh, direction: new THREE.Vector3(-0.04, -0.88 + 0.20 * crouch, 0.46) },
              { bone: bones.rThigh, direction: new THREE.Vector3(0.04, -0.88 + 0.20 * crouch, 0.46) },
              { bone: bones.lCalf, direction: new THREE.Vector3(0.03, -0.96 + 1.30 * crouch, 0.30) },
              { bone: bones.rCalf, direction: new THREE.Vector3(-0.03, -0.96 + 1.30 * crouch, 0.30) },
            ],
            10,
            dt,
          );
          addRotation(bones.hips, 'x', -0.10 * crouch, 10, dt);
          addRotation(bones.lFoot, 'x', -0.24 * crouch, 10, dt);
          addRotation(bones.rFoot, 'x', -0.24 * crouch, 10, dt);
          addRotation(bones.lArm, 'z', -0.28 * arc, 10, dt);
          addRotation(bones.rArm, 'z', 0.28 * arc, 10, dt);
          root.position.y = arc * 0.22;
        }

        /*
         * FULL BODY
         */
        else if (gesture === 'sit' || gesture === 'sit-chair') {
          const elapsed = now - gestureStarted;
          const chairMode = gesture === 'sit-chair';
          const t = THREE.MathUtils.clamp(elapsed / (chairMode ? 3600 : 2600), 0, 1);
          const smooth = (x: number) => x * x * (3 - 2 * x);

          if (chairMode && furniture) {
            const chair = furniture.getObjectByName('AURA_CHAIR');
            if (chair) {
              const chairWorld = new THREE.Vector3();
              chair.getWorldPosition(chairWorld);
              const approach = smooth(THREE.MathUtils.clamp(elapsed / 1400, 0, 1));
              const localTarget = new THREE.Vector3(chairWorld.x + 0.36, root.position.y, chairWorld.z + 0.18);
              root.position.x = THREE.MathUtils.lerp(root.position.x, localTarget.x, 1 - Math.exp(-5 * dt) * (1 - approach));
              root.position.z = THREE.MathUtils.lerp(root.position.z, localTarget.z, 1 - Math.exp(-5 * dt) * (1 - approach));
            }
          }

          // Stand -> controlled descent: hip/knee flexion first, then the
          // trunk follows. This keeps the knees behind the thighs rather
          // than pushing the shins forward.
          const sitAmount = smooth(t);
          const hip = new THREE.Vector3();
          bones.lThigh?.getWorldPosition(hip);
          const seatY = (avatarFrame?.height ?? 1) * 0.43;
          const footY = restWorldPositions.get(bones.lFoot!)?.y ?? 0;
          const rootDrop = THREE.MathUtils.clamp((seatY - footY) * 0.16, 0.06, (avatarFrame?.height ?? 1) * 0.10);
          root.position.y = -rootDrop * sitAmount;

          const leftFoot = restWorldPositions.get(bones.lFoot!);
          const rightFoot = restWorldPositions.get(bones.rFoot!);
          if (leftFoot && rightFoot) {
            const kneeBack = new THREE.Vector3(0, 0, -0.28 * (avatarFrame?.height ?? 1));
            const leftTarget = leftFoot.clone().add(new THREE.Vector3(0, 0.08, 0.12 * (1 - sitAmount)));
            const rightTarget = rightFoot.clone().add(new THREE.Vector3(0, 0.08, 0.12 * (1 - sitAmount)));

            const leftHip = new THREE.Vector3();
            const rightHip = new THREE.Vector3();
            bones.lThigh?.getWorldPosition(leftHip);
            bones.rThigh?.getWorldPosition(rightHip);
            solveTwoBoneIK(bones.lThigh, bones.lCalf, bones.lFoot, leftTarget, leftHip.clone().add(kneeBack), 8, dt);
            solveTwoBoneIK(bones.rThigh, bones.rCalf, bones.rFoot, rightTarget, rightHip.clone().add(kneeBack), 8, dt);
          }

          // Human sitting is a coupled hip-knee-trunk action, not just a
          // rotated spine. The trunk leans forward during descent and settles
          // near upright once seated; the pelvis is allowed a small tilt.
          const lean = chairMode
            ? THREE.MathUtils.lerp(0.18, 0.035, sitAmount)
            : THREE.MathUtils.lerp(0.22, 0.04, sitAmount);

          poseChain(
            [
              { bone: bones.spine, direction: new THREE.Vector3(0, Math.cos(lean), Math.sin(lean)) },
              { bone: bones.spine1, direction: new THREE.Vector3(0, Math.cos(lean * 0.82), Math.sin(lean * 0.82)) },
              { bone: bones.spine2, direction: new THREE.Vector3(0, Math.cos(lean * 0.68), Math.sin(lean * 0.68)) },
            ],
            6,
            dt,
          );
          addRotation(bones.hips, 'x', -0.08 * sitAmount, 6, dt);
          restoreBone(bones.lFoot, 8, dt);
          restoreBone(bones.rFoot, 8, dt);
        }

        else if (gesture === 'stand') {
          restoreLowerBody(bones, 4.5, dt);
          restoreBone(bones.spine, 4, dt);
          root.position.y = THREE.MathUtils.damp(root.position.y, 0, 5, dt);
        }

        else if (
          gesture === 'full-body'
        ) {
          addRotation(
            bones.spine,
            'x',
            Math.sin(
              time * 1.2,
            ) *
              0.025,
            6,
            dt,
          );

          addRotation(
            bones.spine1,
            'x',
            Math.sin(
              time * 1.2,
            ) *
              0.018,
            6,
            dt,
          );

          addRotation(
            bones.head,
            'y',
            Math.sin(
              time * 0.9,
            ) *
              0.035,
            5,
            dt,
          );

          addRotation(
            bones.lArm,
            'z',
            Math.sin(
              time * 1.5,
            ) *
              0.05,
            5,
            dt,
          );

          addRotation(
            bones.rArm,
            'z',
            -Math.sin(
              time * 1.5,
            ) *
              0.05,
            5,
            dt,
          );
        }

      }

      if (!nativeMotion && gesture !== 'idle') {
        const durations: Record<string, number> = {
          wave: 1800,
          point: 1600,
          present: 1800,
          handshake: 2000,
          nod: 1200,
          shrug: 1400,
          laugh: 1800,
          smile: 1800,
          eyes: 1400,
          'full-body': 2200,
          'look-left': 1400,
          'look-right': 1400,
          'look-up': 1400,
          'look-down': 1400,
          'left-arm-up': 1600,
          'right-arm-up': 1600,
          'arms-up': 1600,
          'cross-arms': 1800,
          fingers: 1400,
          'chin-touch': 1800,
          clothes: 1800,
          sit: 2600,
          'sit-chair': 3600,
          'read-book': 5200,
          'write-notepad': 6200,
          'cross-sit': 4200,
          'hold-chair': 3000,
          stand: 2600,
          walk: 3000,
          run: 3000,
          jump: 1200,
          bend: 2200,
          crouch: 2200,
          'back-bend': 2200,
        };

        const duration = durations[gesture] ?? 0;
        if (duration > 0 && now - gestureStarted > duration) {
          gesture = 'idle';
          gestureStarted = now;
          nativeMotion = playNative(
            [/idle/, /stand/, /breath/, /rest/, /neutral/],
            true,
            true,
          );
        }
      }

      renderer.render(
        scene,
        camera,
      );

      if (targetMouth > 0) {
        targetMouth *=
          Math.pow(0.2, dt);
      } else {
        targetMouth = 0;
      }
    });

    return () => {
      disposed = true;

      resizeObserver.disconnect();

      renderer.setAnimationLoop(null);

      if (mixer && model) {
        mixer.stopAllAction();
        mixer.uncacheRoot(model);
      }

      if (furniture) {
        furniture.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((material) => material.dispose());
          }
        });
        scene.remove(furniture);
        furniture = null;
        bookObject = null;
        notepadObject = null;
        penObject = null;
      }

      if (model) {
        model.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;

          object.geometry.dispose();

          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];

          materials.forEach((material) => material.dispose());
        });

        root.remove(model);
      }

      activeAction = null;
      nativeMotion = false;
      mixer = null;
      model = null;

      renderer.dispose();

      if (
        mount.contains(
          renderer.domElement,
        )
      ) {
        mount.removeChild(
          renderer.domElement,
        );
      }

      apiRef.current = null;
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 560,
        overflow: 'hidden',
      }}
    />
  );
}