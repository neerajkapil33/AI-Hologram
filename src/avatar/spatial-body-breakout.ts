import * as THREE from 'three';

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const aliases = {
  hand: ['mixamorigrighthand', 'righthand', 'handr', 'hand_r', 'hand'],
  forearm: ['mixamorigrightforearm', 'rightforearm', 'lowerarm_r', 'forearm_r', 'forearm', 'lowerarm'],
  upperArm: ['mixamorigrightarm', 'rightupperarm', 'rightarm', 'upperarm_r', 'upperarm'],
  shoulder: ['mixamorigrigh tshoulder', 'mixamorigrightshoulder', 'rightshoulder', 'shoulder_r', 'shoulder'],
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
  root.traverse(node => { if ((node as THREE.Bone).isBone) bones.push(node as THREE.Bone); });
  for (const alias of wanted) {
    const exact = bones.find(bone => normalize(bone.name) === alias);
    if (exact) return exact;
  }
  for (const alias of wanted) {
    const partial = bones.find(bone => { const name = normalize(bone.name); return name.includes(alias) || alias.includes(name); });
    if (partial) return partial;
  }
  return null;
};

export type SpatialBodyBreakout = { update: (amount: number, time: number) => void; dispose: () => void; hasRig: boolean };

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
  const bones = [shoulder, upperArm, forearm, hand, rightThigh, leftThigh, rightShin, leftShin, spine].filter((bone): bone is THREE.Bone => bone !== null);
  const base = new Map<THREE.Bone, BoneState>();
  bones.forEach(bone => base.set(bone, { position: bone.position.clone(), rotation: bone.rotation.clone(), scale: bone.scale.clone() }));
  const avatarRoot = root.parent;
  const baseRootPosition = avatarRoot?.position.clone() ?? new THREE.Vector3();
  const baseRootRotation = avatarRoot?.rotation.clone() ?? new THREE.Euler();
  const baseRootScale = avatarRoot?.scale.clone() ?? new THREE.Vector3(1, 1, 1);

  const restoreBone = (bone: THREE.Bone | null) => {
    if (!bone) return;
    const state = base.get(bone);
    if (!state) return;
    bone.position.copy(state.position); bone.rotation.copy(state.rotation); bone.scale.copy(state.scale);
  };

  return {
    hasRig: hand !== null && forearm !== null && upperArm !== null,
    update(amount, time) {
      if (amount < 0.01) {
        bones.forEach(restoreBone);
        if (avatarRoot) { avatarRoot.position.copy(baseRootPosition); avatarRoot.rotation.copy(baseRootRotation); avatarRoot.scale.copy(baseRootScale); }
        return;
      }
      if (avatarRoot) {
        avatarRoot.position.copy(baseRootPosition);
        avatarRoot.rotation.copy(baseRootRotation);
        // Restore the original Spatial Breakout framing: the avatar grows only
        // during breakout and returns exactly to its normal size when inactive.
        avatarRoot.scale.set(baseRootScale.x * 1.2, baseRootScale.y * 1.2, baseRootScale.z * 1.2);
      }
      bones.forEach(restoreBone);

      // PHASE 1 — unmistakable full-body walk toward the viewer.
      const walk = THREE.MathUtils.smootherstep(THREE.MathUtils.clamp(time % 100000 / 100000, 0, 1), 0, 1);
      const elapsed = Math.max(0, time - (time - 4));
      const gait = Math.sin(elapsed * 9.2) * walk;
      if (avatarRoot) avatarRoot.position.z += THREE.MathUtils.lerp(0, 0.88, THREE.MathUtils.smootherstep(amount, 0, 1));
      if (rightThigh) rightThigh.rotation.x += gait * 0.42;
      if (leftThigh) leftThigh.rotation.x -= gait * 0.42;
      if (rightShin) rightShin.rotation.x += Math.max(0, -gait) * 0.30;
      if (leftShin) leftShin.rotation.x += Math.max(0, gait) * 0.30;
      if (shoulder) shoulder.rotation.z -= gait * 0.035;

      // PHASE 2 — bow forward.
      const bow = Math.sin(Math.PI * THREE.MathUtils.clamp((amount - 0.55) / 0.18, 0, 1));
      if (spine) spine.rotation.x += bow * 0.18;
      if (avatarRoot) avatarRoot.rotation.x += bow * 0.04;

      // PHASE 3 — extend the real right arm/hand toward the viewer.
      const reach = THREE.MathUtils.smootherstep(THREE.MathUtils.clamp((amount - 0.73) / 0.20, 0, 1), 0, 1);
      if (shoulder) shoulder.rotation.x -= reach * 0.14;
      if (upperArm) { upperArm.rotation.copy(base.get(upperArm)!.rotation); upperArm.rotation.z -= reach * 0.25; upperArm.rotation.y -= reach * 0.12; upperArm.rotation.x -= reach * 0.10; }
      if (forearm) { forearm.rotation.copy(base.get(forearm)!.rotation); forearm.rotation.x -= reach * 0.28; forearm.rotation.z -= reach * 0.10; }
      if (hand) { hand.position.copy(base.get(hand)!.position); hand.position.z += reach * 0.38; hand.position.y += reach * 0.04; hand.rotation.copy(base.get(hand)!.rotation); hand.rotation.x -= reach * 0.05; }

      // PHASE 4 — handshake pump, forward/back only; never a wave.
      const pump = amount > 0.91 ? Math.sin(time * 10) * 0.055 : 0;
      if (hand) hand.position.z += pump;
      if (forearm) forearm.rotation.x -= pump * 0.55;
    },
    dispose() {
      bones.forEach(restoreBone);
      if (avatarRoot) { avatarRoot.position.copy(baseRootPosition); avatarRoot.rotation.copy(baseRootRotation); avatarRoot.scale.copy(baseRootScale); }
    },
  };
};
