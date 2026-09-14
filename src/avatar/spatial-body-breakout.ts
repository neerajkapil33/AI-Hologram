import * as THREE from 'three';

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const aliases = {
  hand: ['mixamorigrighthand', 'righthand', 'handr', 'hand_r', 'hand'],
  forearm: ['mixamorigrightforearm', 'rightforearm', 'lowerarm_r', 'forearm_r', 'forearm', 'lowerarm'],
  upperArm: ['mixamorigrightarm', 'rightupperarm', 'rightarm', 'upperarm_r', 'upperarm'],
  shoulder: ['mixamorigrightshoulder', 'rightshoulder', 'shoulder_r', 'shoulder'],
  rightThigh: ['mixamorigrightupleg', 'rightupleg', 'rightupperleg', 'rightthigh', 'thigh_r'],
  leftThigh: ['mixamorigleftupleg', 'leftupleg', 'leftupperleg', 'leftthigh', 'thigh_l'],
  rightShin: ['mixamorigrightleg', 'rightlowerleg', 'rightshin', 'shin_r', 'rightleg'],
  leftShin: ['mixamorigleftleg', 'leftlowerleg', 'leftshin', 'shin_l', 'leftleg'],
  spine: ['mixamorigspine2', 'mixamorigspine1', 'mixamorigspine', 'upperchest', 'chest', 'spine2', 'spine1', 'spine'],
};

type BoneState = { position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3 };

const findBone = (root: THREE.Object3D, names: string[]): THREE.Bone | null => {
  const wanted = names.map(normalize);
  const bones: THREE.Bone[] = [];
  root.traverse(node => {
    if ((node as THREE.Bone).isBone) bones.push(node as THREE.Bone);
  });
  for (const alias of wanted) {
    const exact = bones.find(bone => normalize(bone.name) === alias);
    if (exact) return exact;
  }
  for (const alias of wanted) {
    const partial = bones.find(bone => {
      const name = normalize(bone.name);
      return name.includes(alias) || alias.includes(name);
    });
    if (partial) return partial;
  }
  return null;
};

export type SpatialBodyBreakout = {
  update: (amount: number, time: number) => void;
  dispose: () => void;
  hasRig: boolean;
};

export const createSpatialBodyBreakout = (root: THREE.Object3D): SpatialBodyBreakout => {
  const hand = findBone(root, aliases.hand);
  const forearm = findBone(root, aliases.forearm);
  const upperArm = findBone(root, aliases.upperArm);
  const shoulder = findBone(root, aliases.shoulder);
  const rightThigh = findBone(root, aliases.rightThigh);
  const leftThigh = findBone(root, aliases.leftThigh);
  const rightShin = findBone(root, aliases.rightShin);
  const leftShin = findBone(root, aliases.leftShin);
  const spine = findBone(root, aliases.spine);

  const bones = [shoulder, upperArm, forearm, hand, rightThigh, leftThigh, rightShin, leftShin, spine].filter(
    (bone): bone is THREE.Bone => bone !== null,
  );
  const base = new Map<THREE.Bone, BoneState>();
  bones.forEach(bone => base.set(bone, {
    position: bone.position.clone(),
    rotation: bone.rotation.clone(),
    scale: bone.scale.clone(),
  }));

  const avatarRoot = root.parent;
  const baseRootPosition = avatarRoot?.position.clone() ?? new THREE.Vector3();
  const baseRootRotation = avatarRoot?.rotation.clone() ?? new THREE.Euler();
  const baseRootScale = avatarRoot?.scale.clone() ?? new THREE.Vector3(1, 1, 1);
  let startedAt = -1;

  const restoreBone = (bone: THREE.Bone | null) => {
    if (!bone) return;
    const state = base.get(bone);
    if (!state) return;
    bone.position.copy(state.position);
    bone.rotation.copy(state.rotation);
    bone.scale.copy(state.scale);
  };

  return {
    hasRig: hand !== null && forearm !== null && upperArm !== null,
    update(amount, time) {
      if (amount < 0.01) {
        startedAt = -1;
        bones.forEach(restoreBone);
        if (avatarRoot) {
          avatarRoot.position.copy(baseRootPosition);
          avatarRoot.rotation.copy(baseRootRotation);
          avatarRoot.scale.copy(baseRootScale);
        }
        return;
      }

      if (startedAt < 0) startedAt = time;
      const elapsed = time - startedAt;

      // Keep the original model framing and size. Spatial mode only changes
      // position/rig pose; it never normalizes or enlarges the avatar root.
      if (avatarRoot) {
        avatarRoot.position.copy(baseRootPosition);
        avatarRoot.scale.copy(baseRootScale);
        avatarRoot.rotation.copy(baseRootRotation);
      }
      bones.forEach(restoreBone);

      // Phase 1: walk toward the viewer. The whole rig advances while the
      // actual leg bones provide a visible alternating gait.
      const walk = THREE.MathUtils.smootherstep(THREE.MathUtils.clamp(elapsed / 1.9, 0, 1), 0, 1);
      const gait = Math.sin(elapsed * 9.2) * walk;
      if (avatarRoot) avatarRoot.position.z += THREE.MathUtils.lerp(0, 0.58, walk);
      if (rightThigh) rightThigh.rotation.x += gait * 0.30;
      if (leftThigh) leftThigh.rotation.x -= gait * 0.30;
      if (rightShin) rightShin.rotation.x += Math.max(0, -gait) * 0.22;
      if (leftShin) leftShin.rotation.x += Math.max(0, gait) * 0.22;
      if (shoulder) shoulder.rotation.z -= gait * 0.025;

      // Phase 2: stop, then bow politely from the torso toward the viewer.
      const bow = Math.sin(Math.PI * THREE.MathUtils.clamp((elapsed - 1.95) / 0.72, 0, 1));
      if (spine) spine.rotation.x += bow * 0.16;
      if (avatarRoot) avatarRoot.rotation.x += bow * 0.035;

      // Phase 3: return upright and extend the real right arm straight toward
      // the camera. All motion is applied to the existing skeleton.
      const reach = THREE.MathUtils.smootherstep(THREE.MathUtils.clamp((elapsed - 2.62) / 0.82, 0, 1), 0, 1);
      if (shoulder) shoulder.rotation.x -= reach * 0.12;
      if (upperArm) {
        upperArm.rotation.copy(base.get(upperArm)!.rotation);
        upperArm.rotation.z -= reach * 0.22;
        upperArm.rotation.y -= reach * 0.10;
        upperArm.rotation.x -= reach * 0.08;
      }
      if (forearm) {
        forearm.rotation.copy(base.get(forearm)!.rotation);
        forearm.rotation.x -= reach * 0.22;
        forearm.rotation.z -= reach * 0.08;
      }
      if (hand) {
        hand.position.copy(base.get(hand)!.position);
        // In a Mixamo-style rig, local +Z is the useful forward depth axis for
        // this avatar. The forearm/upper-arm rotations create the real reach;
        // this additional translation makes the hand visibly leave the torso.
        hand.position.z += reach * 0.34;
        hand.position.y += reach * 0.035;
        hand.rotation.copy(base.get(hand)!.rotation);
        hand.rotation.x -= reach * 0.04;
      }

      // Phase 4: handshake is a compact forward/back pump, never a lateral wave.
      const handshakeStart = 3.48;
      const handshake = elapsed > handshakeStart
        ? THREE.MathUtils.clamp((elapsed - handshakeStart) / 0.35, 0, 1)
        : 0;
      const pump = Math.sin((elapsed - handshakeStart) * 10) * 0.045 * handshake;
      if (hand) hand.position.z += pump;
      if (forearm) forearm.rotation.x -= pump * 0.55;
    },
    dispose() {
      bones.forEach(restoreBone);
      if (avatarRoot) {
        avatarRoot.position.copy(baseRootPosition);
        avatarRoot.rotation.copy(baseRootRotation);
        avatarRoot.scale.copy(baseRootScale);
      }
    },
  };
};
