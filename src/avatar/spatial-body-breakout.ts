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
  let result: THREE.Bone | null = null;
  root.traverse((node) => {
    if (result || !(node as THREE.Bone).isBone) return;
    const n = normalize(node.name);
    if (wanted.some((alias) => n === alias || n.includes(alias))) result = node as THREE.Bone;
  });
  return result;
};

export type SpatialBodyBreakout = {
  update: (amount: number, time: number) => void;
  dispose: () => void;
  hasRig: boolean;
};

const addDepthBoundary = (stage: THREE.Object3D) => {
  const existing = stage.getObjectByName('__SPATIAL_SCREEN_DEPTH_BOUNDARY__');
  if (existing) return existing as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  const material = new THREE.MeshBasicMaterial({ color: 0x000000, colorWrite: false, depthWrite: true, depthTest: true, side: THREE.DoubleSide });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.45), material);
  plane.name = '__SPATIAL_SCREEN_DEPTH_BOUNDARY__';
  plane.position.set(0, 1.05, 0.30);
  plane.renderOrder = 1;
  stage.add(plane);
  return plane;
};

export const createSpatialBodyBreakout = (root: THREE.Object3D): SpatialBodyBreakout => {
  const hand = findBone(root, aliases.hand);
  const forearm = findBone(root, aliases.forearm);
  const upperArm = findBone(root, aliases.upperArm);
  const shoulder = findBone(root, aliases.shoulder);
  const bones: THREE.Bone[] = [shoulder, upperArm, forearm, hand].filter((bone): bone is THREE.Bone => bone !== null);
  const base = new Map(bones.map((bone) => [bone, {
    position: bone.position.clone(),
    rotation: bone.rotation.clone(),
    scale: bone.scale.clone(),
  }]));

  const avatarRoot = root.parent;
  const stage = avatarRoot?.parent;
  const mask = stage ? addDepthBoundary(stage) : null;
  const baseRootPosition = avatarRoot?.position.clone() ?? new THREE.Vector3();

  return {
    hasRig: Boolean(hand && forearm && upperArm),
    update(amount, time) {
      if (!hand || !forearm || !upperArm) return;
      const eased = THREE.MathUtils.smoothstep(amount, 0, 1);
      const reach = eased * (0.42 + 0.035 * Math.sin(time * 2.1));
      const lift = eased * (0.07 + 0.018 * Math.sin(time * 2.7));
      const handBase = base.get(hand)!;
      const forearmBase = base.get(forearm)!;
      const upperArmBase = base.get(upperArm)!;

      if (avatarRoot) avatarRoot.position.z = baseRootPosition.z + THREE.MathUtils.lerp(0, 0.16, eased);
      if (mask) mask.material.depthWrite = eased > 0.01;

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
      if (shoulder) shoulder.rotation.z = base.get(shoulder)!.rotation.z + THREE.MathUtils.lerp(0, -0.055, eased);
    },
    dispose() {
      base.forEach(({ position, rotation, scale }, bone) => {
        bone.position.copy(position);
        bone.rotation.copy(rotation);
        bone.scale.copy(scale);
      });
      if (avatarRoot) avatarRoot.position.copy(baseRootPosition);
      if (mask) {
        mask.parent?.remove(mask);
        mask.geometry.dispose();
        mask.material.dispose();
      }
    },
  };
};
