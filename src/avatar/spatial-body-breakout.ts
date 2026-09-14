import * as THREE from 'three';

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const aliases = {
  hand: ['hand', 'handr', 'righthand', 'mixamorigrighthand', 'hand_r'],
  forearm: ['forearm', 'lowerarm', 'rightforearm', 'mixamorigrightforearm', 'forearm_r'],
  upperArm: ['upperarm', 'arm', 'rightarm', 'mixamorigrightarm', 'upperarm_r'],
  shoulder: ['shoulder', 'rightshoulder', 'mixamorigrightshoulder', 'shoulder_r'],
};

type BoneState = { position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3 };

const findBone = (root: THREE.Object3D, names: string[]): THREE.Bone | null => {
  const wanted = names.map(normalize);
  let result: THREE.Bone | null = null;
  root.traverse((node) => {
    if (result || !(node as THREE.Bone).isBone) return;
    const name = normalize(node.name);
    if (wanted.some((alias) => name === alias || name.includes(alias))) result = node as THREE.Bone;
  });
  return result;
};

export type SpatialBodyBreakout = {
  update: (amount: number, time: number) => void;
  dispose: () => void;
  hasRig: boolean;
};

export const createSpatialBodyBreakout = (root: THREE.Object3D): SpatialBodyBreakout => {
  const hand: THREE.Bone | null = findBone(root, aliases.hand);
  const forearm: THREE.Bone | null = findBone(root, aliases.forearm);
  const upperArm: THREE.Bone | null = findBone(root, aliases.upperArm);
  const shoulder: THREE.Bone | null = findBone(root, aliases.shoulder);

  const bones: THREE.Bone[] = [];
  if (shoulder) bones.push(shoulder);
  if (upperArm) bones.push(upperArm);
  if (forearm) bones.push(forearm);
  if (hand) bones.push(hand);

  const base = new Map<THREE.Bone, BoneState>();
  bones.forEach((bone) => base.set(bone, {
    position: bone.position.clone(),
    rotation: bone.rotation.clone(),
    scale: bone.scale.clone(),
  }));

  return {
    hasRig: hand !== null && forearm !== null && upperArm !== null,
    update(amount, time) {
      if (hand === null || forearm === null || upperArm === null) return;
      const eased = THREE.MathUtils.smoothstep(amount, 0, 1);
      const reach = eased * (0.42 + 0.035 * Math.sin(time * 2.1));
      const lift = eased * (0.07 + 0.018 * Math.sin(time * 2.7));
      const handBase = base.get(hand);
      const forearmBase = base.get(forearm);
      const upperArmBase = base.get(upperArm);
      if (!handBase || !forearmBase || !upperArmBase) return;

      // Do not use a full-screen depth plane here. A depth plane occluded the
      // entire upper half of the avatar, making the head/chest disappear.
      // The screen boundary is now represented by the visual breach layer,
      // while the rigged hand/arm provides the real 3D depth movement.
      upperArm.rotation.z = upperArmBase.rotation.z + THREE.MathUtils.lerp(0, -0.22, eased);
      upperArm.rotation.y = upperArmBase.rotation.y + THREE.MathUtils.lerp(0, -0.10, eased);
      forearm.rotation.z = forearmBase.rotation.z + THREE.MathUtils.lerp(0, -0.14, eased);
      forearm.rotation.x = forearmBase.rotation.x + THREE.MathUtils.lerp(0, -0.10, eased);
      hand.rotation.z = handBase.rotation.z + THREE.MathUtils.lerp(0, -0.18, eased) + Math.sin(time * 4.2) * 0.03 * eased;
      hand.position.copy(handBase.position);
      hand.position.z += reach;
      hand.position.y += lift;
      forearm.position.copy(forearmBase.position);
      forearm.position.z += reach * 0.25;
      if (shoulder) {
        const shoulderBase = base.get(shoulder);
        if (shoulderBase) shoulder.rotation.z = shoulderBase.rotation.z + THREE.MathUtils.lerp(0, -0.055, eased);
      }
    },
    dispose() {
      base.forEach(({ position, rotation, scale }, bone) => {
        bone.position.copy(position);
        bone.rotation.copy(rotation);
        bone.scale.copy(scale);
      });
    },
  };
};
