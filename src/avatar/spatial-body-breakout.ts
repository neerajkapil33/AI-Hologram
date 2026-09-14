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
  bones.forEach((bone) => base.set(bone, { position: bone.position.clone(), rotation: bone.rotation.clone(), scale: bone.scale.clone() }));
  const avatarRoot = root.parent;
  const baseRootPosition = avatarRoot?.position.clone() ?? new THREE.Vector3();

  return {
    hasRig: hand !== null && forearm !== null && upperArm !== null,
    update(amount, time) {
      const eased = THREE.MathUtils.smoothstep(amount, 0, 1);
      if (avatarRoot) {
        avatarRoot.position.copy(baseRootPosition);
        avatarRoot.scale.setScalar(1);
      }
      if (hand === null || forearm === null || upperArm === null) return;
      const handBase = base.get(hand);
      const forearmBase = base.get(forearm);
      const upperArmBase = base.get(upperArm);
      if (!handBase || !forearmBase || !upperArmBase) return;

      // Push the real rigged hand clearly toward the viewer while keeping
      // the complete avatar at its original camera framing and size.
      const reach = eased * (0.46 + 0.012 * Math.sin(time * 2.1));
      const lift = eased * (0.055 + 0.008 * Math.sin(time * 2.7));
      upperArm.position.copy(upperArmBase.position);
      upperArm.rotation.copy(upperArmBase.rotation);
      upperArm.rotation.z += THREE.MathUtils.lerp(0, -0.22, eased);
      upperArm.rotation.y += THREE.MathUtils.lerp(0, -0.08, eased);
      forearm.position.copy(forearmBase.position);
      forearm.rotation.copy(forearmBase.rotation);
      forearm.rotation.z += THREE.MathUtils.lerp(0, -0.12, eased);
      forearm.rotation.x += THREE.MathUtils.lerp(0, -0.10, eased);
      forearm.position.z += reach * 0.18;
      hand.position.copy(handBase.position);
      hand.rotation.copy(handBase.rotation);
      hand.rotation.z += THREE.MathUtils.lerp(0, -0.14, eased) + Math.sin(time * 4.2) * 0.018 * eased;
      hand.rotation.y += THREE.MathUtils.lerp(0, 0.10, eased);
      hand.position.z += reach;
      hand.position.y += lift;
      if (shoulder) {
        const shoulderBase = base.get(shoulder);
        if (shoulderBase) {
          shoulder.position.copy(shoulderBase.position);
          shoulder.rotation.copy(shoulderBase.rotation);
          shoulder.rotation.z += THREE.MathUtils.lerp(0, -0.045, eased);
        }
      }
    },
    dispose() {
      base.forEach(({ position, rotation, scale }, bone) => {
        bone.position.copy(position);
        bone.rotation.copy(rotation);
        bone.scale.copy(scale);
      });
      if (avatarRoot) avatarRoot.position.copy(baseRootPosition);
    },
  };
};
