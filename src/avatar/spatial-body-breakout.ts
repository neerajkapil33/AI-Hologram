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

type Controller = {
  root: THREE.Object3D;
  stage: THREE.Object3D;
  hand: THREE.Bone | null;
  forearm: THREE.Bone | null;
  upperArm: THREE.Bone | null;
  shoulder: THREE.Bone | null;
  base: Map<THREE.Bone, { position: THREE.Vector3; rotation: THREE.Euler; scale: THREE.Vector3 }>;
  mask: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  amount: number;
};

const controllers: Controller[] = [];

const addDepthBoundary = (stage: THREE.Object3D) => {
  const existing = stage.getObjectByName('__SPATIAL_SCREEN_DEPTH_BOUNDARY__');
  if (existing) return existing as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  const material = new THREE.MeshBasicMaterial({
    color: 0x000000,
    colorWrite: false,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.45), material);
  plane.name = '__SPATIAL_SCREEN_DEPTH_BOUNDARY__';
  plane.position.set(0, 1.05, 0.30);
  plane.renderOrder = 1;
  stage.add(plane);
  return plane;
};

const register = (model: THREE.Object3D) => {
  if (controllers.some((item) => item.root === model.parent)) return;
  const root = model.parent;
  if (!root) return;
  const stage = root.parent;
  if (!stage) return;
  const hand = findBone(model, aliases.hand);
  const forearm = findBone(model, aliases.forearm);
  const upperArm = findBone(model, aliases.upperArm);
  const shoulder = findBone(model, aliases.shoulder);
  if (!hand || !forearm || !upperArm) return;
  const bones = [shoulder, upperArm, forearm, hand].filter(Boolean) as THREE.Bone[];
  const base = new Map(bones.map((bone) => [bone, {
    position: bone.position.clone(),
    rotation: bone.rotation.clone(),
    scale: bone.scale.clone(),
  }]));
  const mask = addDepthBoundary(stage);
  controllers.push({ root, stage, hand, forearm, upperArm, shoulder, base, mask, amount: 0 });
};

const updateController = (controller: Controller, amount: number, time: number) => {
  controller.amount = THREE.MathUtils.damp(controller.amount, amount, 5.5, 1 / 60);
  const eased = THREE.MathUtils.smoothstep(controller.amount, 0, 1);
  const { root, hand, forearm, upperArm, shoulder, base } = controller;
  if (!hand || !forearm || !upperArm) return;

  // Keep the torso behind the virtual display while the hand crosses it.
  root.position.z = THREE.MathUtils.lerp(root.position.z, THREE.MathUtils.lerp(0, 0.16, eased), 0.24);

  const reach = eased * (0.42 + 0.035 * Math.sin(time * 2.1));
  const lift = eased * (0.07 + 0.018 * Math.sin(time * 2.7));
  const handBase = base.get(hand)!;
  const forearmBase = base.get(forearm)!;
  const upperBase = base.get(upperArm)!;

  upperArm.rotation.z = upperBase.rotation.z + THREE.MathUtils.lerp(0, -0.22, eased);
  upperArm.rotation.y = upperBase.rotation.y + THREE.MathUtils.lerp(0, -0.10, eased);
  forearm.rotation.z = forearmBase.rotation.z + THREE.MathUtils.lerp(0, -0.14, eased);
  forearm.rotation.x = forearmBase.rotation.x + THREE.MathUtils.lerp(0, -0.10, eased);
  hand.rotation.z = handBase.rotation.z + THREE.MathUtils.lerp(0, -0.18, eased) + Math.sin(time * 4.2) * 0.03 * eased;
  hand.position.copy(handBase.position);
  hand.position.z += reach;
  hand.position.y += lift;
  forearm.position.copy(forearmBase.position);
  forearm.position.z += reach * 0.25;

  if (shoulder) {
    const shoulderBase = base.get(shoulder)!;
    shoulder.rotation.z = shoulderBase.rotation.z + THREE.MathUtils.lerp(0, -0.055, eased);
  }
};

const restore = (controller: Controller) => {
  controller.base.forEach(({ position, rotation, scale }, bone) => {
    bone.position.copy(position);
    bone.rotation.copy(rotation);
    bone.scale.copy(scale);
  });
};

let spatialAmount = 0;
let spatialTarget = 0;

window.addEventListener('neeraj:spatial-breakout', (event) => {
  spatialTarget = Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active) ? 1 : 0;
  if (!spatialTarget) controllers.forEach(restore);
});

// Register the loaded avatar without requiring a second model loader. The existing
// AvatarEngine adds the GLTF model to avatarRoot; this hook observes that Three.js add.
const originalAdd = THREE.Object3D.prototype.add;
THREE.Object3D.prototype.add = function (...objects: THREE.Object3D[]) {
  const result = originalAdd.apply(this, objects);
  objects.forEach((object) => {
    if (object !== this && object.traverse) register(object);
  });
  return result;
};

// AnimationMixer updates animation tracks first; apply the breakout pose immediately
// afterwards so idle/walk animation cannot overwrite the hand crossing.
const originalMixerUpdate = THREE.AnimationMixer.prototype.update;
THREE.AnimationMixer.prototype.update = function (delta: number) {
  const result = originalMixerUpdate.call(this, delta);
  spatialAmount = THREE.MathUtils.damp(spatialAmount, spatialTarget, 4.5, Math.min(Math.abs(delta), 0.05));
  const time = performance.now() / 1000;
  controllers.forEach((controller) => updateController(controller, spatialAmount, time));
  return result;
};

export const spatialBodyBreakout = { get amount() { return spatialAmount; } };
