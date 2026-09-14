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
  const wanted = names.map(normalize); const bones: THREE.Bone[] = [];
  root.traverse(node => { if ((node as THREE.Bone).isBone) bones.push(node as THREE.Bone); });
  for (const alias of wanted) { const exact = bones.find(bone => normalize(bone.name) === alias); if (exact) return exact; }
  for (const alias of wanted) { const partial = bones.find(bone => { const name = normalize(bone.name); return name.includes(alias) || alias.includes(name); }); if (partial) return partial; }
  return null;
};
export type SpatialBodyBreakout = { update: (amount: number, time: number) => void; dispose: () => void; hasRig: boolean };

export const createSpatialBodyBreakout = (root: THREE.Object3D): SpatialBodyBreakout => {
  const hand = findBone(root, aliases.hand), forearm = findBone(root, aliases.forearm), upperArm = findBone(root, aliases.upperArm), shoulder = findBone(root, aliases.shoulder);
  const rightThigh = findBone(root, aliases.rightThigh), leftThigh = findBone(root, aliases.leftThigh), rightShin = findBone(root, aliases.rightShin), leftShin = findBone(root, aliases.leftShin), spine = findBone(root, aliases.spine);
  const bones = [shoulder, upperArm, forearm, hand, rightThigh, leftThigh, rightShin, leftShin, spine].filter((bone): bone is THREE.Bone => bone !== null);
  const base = new Map<THREE.Bone, BoneState>();
  bones.forEach(bone => base.set(bone, { position: bone.position.clone(), rotation: bone.rotation.clone(), scale: bone.scale.clone() }));
  const avatarRoot = root.parent;
  const baseRootPosition = avatarRoot?.position.clone() ?? new THREE.Vector3();
  const baseRootRotation = avatarRoot?.rotation.clone() ?? new THREE.Euler();
  const baseRootScale = avatarRoot?.scale.clone() ?? new THREE.Vector3(1, 1, 1);
  let startedAt = -1;
  const restoreBone = (bone: THREE.Bone | null) => { if (!bone) return; const state = base.get(bone); if (!state) return; bone.position.copy(state.position); bone.rotation.copy(state.rotation); bone.scale.copy(state.scale); };

  return {
    hasRig: hand !== null && forearm !== null && upperArm !== null,
    update(amount, time) {
      if (amount < 0.01) {
        startedAt = -1; bones.forEach(restoreBone);
        if (avatarRoot) { avatarRoot.position.copy(baseRootPosition); avatarRoot.rotation.copy(baseRootRotation); avatarRoot.scale.copy(baseRootScale); }
        return;
      }
      if (startedAt < 0) startedAt = time;
      const elapsed = time - startedAt;
      if (avatarRoot) {
        avatarRoot.position.copy(baseRootPosition);
        avatarRoot.position.z += THREE.MathUtils.smootherstep(THREE.MathUtils.clamp(elapsed / 1.9, 0, 1), 0, 1) * 0.88;
        avatarRoot.rotation.copy(baseRootRotation);
        avatarRoot.scale.set(baseRootScale.x * 1.2, baseRootScale.y * 1.2, baseRootScale.z * 1.2);
      }
      bones.forEach(restoreBone);

      // Walk cycle on the actual leg rig while the full avatar moves forward.
      const walk = THREE.MathUtils.smootherstep(THREE.MathUtils.clamp(elapsed / 1.9, 0, 1), 0, 1);
      const gait = Math.sin(elapsed * 9.2) * walk;
      if (rightThigh) rightThigh.rotation.x += gait * 0.42;
      if (leftThigh) leftThigh.rotation.x -= gait * 0.42;
      if (rightShin) rightShin.rotation.x += Math.max(0, -gait) * 0.30;
      if (leftShin) leftShin.rotation.x += Math.max(0, gait) * 0.30;
      if (shoulder) shoulder.rotation.z -= gait * 0.035;

      // Bow after reaching the front.
      const bow = Math.sin(Math.PI * THREE.MathUtils.clamp((elapsed - 1.95) / 0.72, 0, 1));
      if (spine) spine.rotation.x += bow * 0.18;
      if (avatarRoot) avatarRoot.rotation.x += bow * 0.04;

      // Real rigged right-arm reach toward the camera.
      const reach = THREE.MathUtils.smootherstep(THREE.MathUtils.clamp((elapsed - 2.62) / 0.82, 0, 1), 0, 1);
      if (shoulder) shoulder.rotation.x -= reach * 0.14;
      if (upperArm) { upperArm.rotation.copy(base.get(upperArm)!.rotation); upperArm.rotation.z -= reach * 0.25; upperArm.rotation.y -= reach * 0.12; upperArm.rotation.x -= reach * 0.10; }
      if (forearm) { forearm.rotation.copy(base.get(forearm)!.rotation); forearm.rotation.x -= reach * 0.28; forearm.rotation.z -= reach * 0.10; }
      if (hand) { hand.position.copy(base.get(hand)!.position); hand.position.z += reach * 0.38; hand.position.y += reach * 0.04; hand.rotation.copy(base.get(hand)!.rotation); hand.rotation.x -= reach * 0.05; }

      // Forward/back handshake pump — never a side-to-side wave.
      const pump = elapsed > 3.48 ? Math.sin((elapsed - 3.48) * 10) * 0.055 : 0;
      if (hand) hand.position.z += pump;
      if (forearm) forearm.rotation.x -= pump * 0.55;
    },
    dispose() { bones.forEach(restoreBone); if (avatarRoot) { avatarRoot.position.copy(baseRootPosition); avatarRoot.rotation.copy(baseRootRotation); avatarRoot.scale.copy(baseRootScale); } },
  };
};
