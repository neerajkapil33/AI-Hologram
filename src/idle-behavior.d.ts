import type * as THREE from 'three';

type MicroExpressionEngine = {
  update: () => void;
  dispose: () => void;
};

declare const createMicroExpressionEngine: (
  avatarRoot: THREE.Object3D,
  options?: { isSpeaking?: () => boolean },
) => MicroExpressionEngine;

export default createMicroExpressionEngine;
export { MicroExpressionEngine };
