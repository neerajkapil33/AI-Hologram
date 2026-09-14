import * as THREE from 'three';

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const aliases = {
  hand: ['hand', 'handr', 'righthand', 'mixamorigrighthand', 'hand_r'],
  forearm: ['forearm', 'lowerarm', 'rightforearm', 'mixamorigrightforearm', 'forearm_r'],
  upperArm: ['upperarm', 'rightarm', 'mixamorigrightarm', 'upperarm_r'],
  shoulder: ['shoulder', 'rightshoulder', 'mixamorigrightshoulder', 'shoulder_r'],
  rightThigh: ['rightupleg', 'rightthigh', 'mixamorigrightupleg', 'thigh_r', 'rightleg'],
  leftThigh: ['leftupleg', 'leftthigh', 'mixamorigleftupleg', 'thigh_l', 'leftleg'],
  rightShin: ['rightleg', 'rightlowerleg', 'rightshin', 'mixamorigrightleg', 'shin_r'],
  leftShin: ['leftleg', 'leftlowerleg', 'leftshin', 'mixamorigleftleg', 'shin_l'],
  spine: ['spine', 'spine1', 'spine2', 'chest', 'upperchest', 'mixamorigspine2'],
};

type BoneState = { position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3 };

const findBone = (root: THREE.Object3D, names: string[]): THREE.Bone | null => {
  const wanted = names.map(normalize);
  let result: THREE.Bone | null = null;
  root.traverse(node => {
    if (result || !(node as THREE.Bone).isBone) return;
    const name = normalize(node.name);
    if (wanted.some(alias => name === alias || name.includes(alias))) result = node as THREE.Bone;
  });
  return result;
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
          avatarRoot.scale.setScalar(1);
        }
        return;
      }

      if (startedAt < 0) startedAt = time;
      const elapsed = time - startedAt;
      const walkProgress = THREE.MathUtils.clamp(elapsed / 1.8, 0, 1);
      const approach = THREE.MathUtils.smootherstep(walkProgress, 0, 1);
      const bowProgress = THREE.MathUtils.clamp((elapsed - 1.75) / 0.62, 0, 1);
      const bow = Math.sin(Math.PI * bowProgress);
      const handshakeProgress = THREE.MathUtils.clamp((elapsed - 2.28) / 0.72, 0, 1);
      const reach = THREE.MathUtils.smootherstep(handshakeProgress, 0, 1);
      const handshake = elapsed > 3 ? Math.min((elapsed - 3) / 0.9, 1) : 0;

      if (avatarRoot) {
        avatarRoot.position.copy(baseRootPosition);
        avatarRoot.position.z += THREE.MathUtils.lerp(0, 0.52, approach);
        avatarRoot.position.y += Math.sin(Math.PI * approach) * 0.008;
        avatarRoot.rotation.copy(baseRootRotation);
        avatarRoot.rotation.x -= bow * 0.13;
        avatarRoot.scale.setScalar(1);
      }

      bones.forEach(restoreBone);

      // Natural walking gait while the real rig moves toward the viewer.
      const gait = Math.sin(elapsed * 9.0) * approach;
      if (rightThigh) rightThigh.rotation.x += gait * 0.34;
      if (leftThigh) leftThigh.rotation.x -= gait * 0.34;
      if (rightShin) rightShin.rotation.x += Math.max(0, -gait) * 0.28;
      if (leftShin) leftShin.rotation.x += Math.max(0, gait) * 0.28;
      if (shoulder) shoulder.rotation.z -= gait * 0.035;

      // A small torso bow, then return upright before the handshake.
      if (spine) {
        spine.rotation.x -= bow * 0.12;
      }

      if (hand && forearm && upperArm) {
        const hb = base.get(hand)!;
        const fb = base.get(forearm)!;
        const ub = base.get(upperArm)!;

        // Keep the arm relaxed during the walk, then bring the real right arm forward.
        upperArm.position.copy(ub.position);
        upperArm.rotation.copy(ub.rotation);
        upperArm.rotation.z -= reach * 0.22;
        upperArm.rotation.y -= reach * 0.10;
        forearm.position.copy(fb.position);
        forearm.rotation.copy(fb.rotation);
        forearm.rotation.z -= reach * 0.13;
        forearm.rotation.x -= reach * 0.10;
        forearm.position.z += reach * 0.10;

        hand.position.copy(hb.position);
        hand.rotation.copy(hb.rotation);
        hand.position.z += reach * 0.42;
        hand.position.y += reach * 0.045;
        hand.rotation.z -= reach * 0.12;
        hand.rotation.y += reach * 0.08;

        // Handshake = controlled forward/back pump, never a side-to-side wave.
        const pump = handshake * Math.sin((elapsed - 3) * 9.0) * 0.045;
        hand.position.z += pump;
        forearm.position.z += pump * 0.45;
      }
    },
    dispose() {
      bones.forEach(restoreBone);
      if (avatarRoot) {
        avatarRoot.position.copy(baseRootPosition);
        avatarRoot.rotation.copy(baseRootRotation);
        avatarRoot.scale.setScalar(1);
      }
    },
  };
};
