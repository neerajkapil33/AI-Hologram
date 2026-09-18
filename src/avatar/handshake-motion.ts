import * as THREE from 'three';

type Bone = THREE.Object3D;

function findBone(
  root: THREE.Object3D,
  patterns: RegExp[]
): Bone | null {
  let hit: Bone | null = null;

  root.traverse((object) => {
    if (hit !== null) return;

    const name = object.name.toLowerCase();

    if (patterns.some((pattern) => pattern.test(name))) {
      hit = object;
    }
  });

  return hit;
}

export function createHandshakeMotion(root: THREE.Object3D) {
  const shoulder: Bone | null = findBone(root, [
    /right.*shoulder|shoulder.*right|mixamorig:rightshoulder|rightshoulder/i,
  ]);

  const upper: Bone | null = findBone(root, [
    /right.*arm|arm.*right|rightupperarm|right.*upperarm/i,
  ]);

  const fore: Bone | null = findBone(root, [
    /right.*forearm|forearm.*right|rightlowerarm|right.*lowerarm|rightelbow/i,
  ]);

  const hand: Bone | null = findBone(root, [
    /right.*hand|hand.*right|righthand/i,
  ]);

  let active = false;
  let started = 0;

  const base = new Map<Bone, { x: number; y: number; z: number }>();

  const bones: Array<Bone | null> = [shoulder, upper, fore, hand];

  bones.forEach((bone) => {
    if (bone !== null) {
      base.set(bone, {
        x: bone.rotation.x,
        y: bone.rotation.y,
        z: bone.rotation.z,
      });
    }
  });

  const restore = (bone: Bone | null) => {
    if (bone === null) return;

    const value = base.get(bone);

    if (!value) return;

    bone.rotation.x = THREE.MathUtils.damp(
      bone.rotation.x,
      value.x,
      7,
      0.016
    );

    bone.rotation.y = THREE.MathUtils.damp(
      bone.rotation.y,
      value.y,
      7,
      0.016
    );

    bone.rotation.z = THREE.MathUtils.damp(
      bone.rotation.z,
      value.z,
      7,
      0.016
    );
  };

  return {
    start() {
      active = true;
      started = performance.now() / 1000;
    },

    stop() {
      active = false;
    },

    update(time: number) {
      if (!active) {
        restore(shoulder);
        restore(upper);
        restore(fore);
        restore(hand);
        return;
      }

      const t = time - started;

      const reach = THREE.MathUtils.smoothstep(
        Math.min(t / 0.9, 1),
        0,
        1
      );

      const shake =
        t < 1.15
          ? 0
          : Math.sin((t - 1.15) * 18) *
            0.10 *
            Math.min((t - 1.15) / 0.25, 1) *
            Math.max(0, 1 - (t - 2.5) / 0.7);

      if (shoulder !== null) {
        const value = base.get(shoulder);

        if (value) {
          shoulder.rotation.y = value.y - 0.10 * reach;
          shoulder.rotation.z = value.z - 0.08 * reach;
        }
      }

      if (upper !== null) {
        const value = base.get(upper);

        if (value) {
          upper.rotation.x = value.x - 0.35 * reach;
          upper.rotation.y = value.y - 0.20 * reach;
          upper.rotation.z = value.z - 0.32 * reach;
        }
      }

      if (fore !== null) {
        const value = base.get(fore);

        if (value) {
          fore.rotation.x = value.x + 0.72 * reach + shake;
          fore.rotation.y = value.y - 0.18 * reach;
        }
      }

      if (hand !== null) {
        const value = base.get(hand);

        if (value) {
          hand.rotation.x = value.x - 0.15 * reach - shake * 0.7;
          hand.rotation.z = value.z - 0.22 * reach;
        }
      }

      if (t > 3.15) {
        active = false;
      }
    },
  };
}