import * as THREE from 'three';

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const aliases = {
  hand: ['hand', 'handr', 'righthand', 'mixamorigrighthand', 'hand_r'],
  forearm: ['forearm', 'lowerarm', 'rightforearm', 'mixamorigrightforearm', 'forearm_r'],
  upperArm: ['upperarm', 'arm', 'rightarm', 'mixamorigrightarm', 'upperarm_r'],
  shoulder: ['shoulder', 'rightshoulder', 'mixamorigrightshoulder', 'shoulder_r'],
};

const findBone = (root: THREE.Object3D, names: string[]) => {
  const wanted = names.map(normalize);
  let result: THREE.Object3D | null = null;
  root.traverse((node) => {
    if (result || !((node as THREE.Bone).isBone || node.name)) return;
    const n = normalize(node.name);
    if (wanted.some((alias) => n === alias || n.includes(alias))) result = node;
  });
  return result as THREE.Bone | null;
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
  const bones = [shoulder, upperArm, forearm, hand].filter(Boolean) as THREE.Bone[];
  const base = bones.map((bone) => ({
    bone,
    position: bone.position.clone(),
    rotation: bone.rotation.clone(),
    scale: bone.scale.clone(),
  }));

  return {
    hasRig: Boolean(hand && forearm && upperArm),
    update(amount, time) {
      if (!hand || !forearm || !upperArm) return;
      const eased = THREE.MathUtils.smoothstep(amount, 0, 1);
      const reach = eased * (0.38 + 0.05 * Math.sin(time * 2.1));
      const lift = eased * (0.055 + 0.018 * Math.sin(time * 2.7));
      upperArm.rotation.z = THREE.MathUtils.lerp(upperArm.rotation.z, -0.18 * eased, 0.16);
      upperArm.rotation.y = THREE.MathUtils.lerp(upperArm.rotation.y, -0.08 * eased, 0.16);
      forearm.rotation.z = THREE.MathUtils.lerp(forearm.rotation.z, -0.12 * eased, 0.18);
      forearm.rotation.x = THREE.MathUtils.lerp(forearm.rotation.x, -0.08 * eased, 0.18);
      hand.rotation.z = THREE.MathUtils.lerp(hand.rotation.z, -0.2 * eased + Math.sin(time * 4.2) * 0.035 * eased, 0.22);
      hand.position.z = base.find((entry) => entry.bone === hand)!.position.z + reach;
      hand.position.y = base.find((entry) => entry.bone === hand)!.position.y + lift;
      forearm.position.z = base.find((entry) => entry.bone === forearm)!.position.z + reach * 0.28;
    },
    dispose() {
      base.forEach(({ bone, position, rotation, scale }) => {
        bone.position.copy(position);
        bone.rotation.copy(rotation);
        bone.scale.copy(scale);
      });
    },
  };
};
