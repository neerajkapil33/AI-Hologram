/**
 * DYNAMIC AVATAR MICRO-EXPRESSION ENGINE
 * Native Vite/Three.js module for organic idle blinking and eyebrow drift.
 *
 * This is intentionally a module instead of a global script so it can share
 * the exact loaded GLTF scene with AvatarEngine without window globals.
 */

import * as THREE from 'three';

const EXPRESSION_MAP = {
  blinkLeft: ['eyeBlinkLeft', 'Blink_Left', 'blink_L', 'mb_lab_eye_blink_L', 'shapes.left_eye_close'],
  blinkRight: ['eyeBlinkRight', 'Blink_Right', 'blink_R', 'mb_lab_eye_blink_R', 'shapes.right_eye_close'],
  browSneer: ['browDownLeft', 'browDownRight', 'Brow_Lower_L', 'Brow_Lower_R', 'mb_lab_brow_depress'],
};

const normalizeMorphName = (name) => name.replace(/[\s_-]+/g, '').toLowerCase();

const findMorphIndex = (mesh, keyType) => {
  if (!mesh.morphTargetDictionary) return null;
  const alternatives = [keyType, ...(EXPRESSION_MAP[keyType] ?? [])].map(normalizeMorphName);
  const entry = Object.entries(mesh.morphTargetDictionary).find(([name]) => alternatives.includes(normalizeMorphName(name)));
  return entry ? entry[1] : null;
};

/**
 * Mount micro-expressions onto an already-loaded avatar root.
 * Returns a dispose function that cancels all timers/animation frames.
 */
export function createMicroExpressionEngine(avatarRoot, { isSpeaking = () => false } = {}) {
  let blinkTimer = null;
  let browTimer = null;
  let browFrame = null;
  let blinkFrame = null;
  let blinkState = 0;
  let browState = 0;
  let disposed = false;

  const targets = [];
  avatarRoot.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || !node.morphTargetDictionary || !node.morphTargetInfluences) return;
    targets.push({
      mesh: node,
      blinkLeft: findMorphIndex(node, 'blinkLeft'),
      blinkRight: findMorphIndex(node, 'blinkRight'),
      brow: findMorphIndex(node, 'browSneer'),
    });
  });

  const setMorph = (mesh, index, value, alpha) => {
    if (index === null || index === undefined || !mesh.morphTargetInfluences) return;
    const current = mesh.morphTargetInfluences[index] ?? 0;
    mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(current, value, alpha);
  };

  const apply = () => {
    if (disposed) return;
    const speaking = isSpeaking();
    targets.forEach(({ mesh, blinkLeft, blinkRight, brow }) => {
      setMorph(mesh, blinkLeft, blinkState, 0.42);
      setMorph(mesh, blinkRight, blinkState, 0.42);
      if (!speaking) setMorph(mesh, brow, browState, 0.1);
    });
  };

  const executeBlink = () => {
    if (disposed) return;
    const started = performance.now();
    const duration = 160;
    const step = () => {
      if (disposed) return;
      const progress = (performance.now() - started) / duration;
      if (progress < 0.5) blinkState = progress * 2;
      else if (progress <= 1) blinkState = 2 - progress * 2;
      else {
        blinkState = 0;
        blinkFrame = null;
        return;
      }
      blinkFrame = requestAnimationFrame(step);
    };
    if (blinkFrame !== null) cancelAnimationFrame(blinkFrame);
    blinkFrame = requestAnimationFrame(step);
  };

  const queueBlink = () => {
    if (disposed) return;
    blinkTimer = window.setTimeout(() => {
      executeBlink();
      queueBlink();
    }, 2000 + Math.random() * 4000);
  };

  const scheduleBrowDrift = () => {
    if (disposed) return;
    browTimer = window.setTimeout(() => {
      if (!isSpeaking()) {
        const target = Math.random() * 0.12;
        const drift = () => {
          if (disposed || isSpeaking()) return;
          browState = THREE.MathUtils.lerp(browState, target, 0.08);
          if (Math.abs(browState - target) > 0.003) browFrame = requestAnimationFrame(drift);
          else browState = target;
        };
        drift();
      }
      scheduleBrowDrift();
    }, 4000 + Math.random() * 3000);
  };

  queueBlink();
  scheduleBrowDrift();

  return {
    update: apply,
    dispose: () => {
      disposed = true;
      if (blinkTimer !== null) window.clearTimeout(blinkTimer);
      if (browTimer !== null) window.clearTimeout(browTimer);
      if (blinkFrame !== null) cancelAnimationFrame(blinkFrame);
      if (browFrame !== null) cancelAnimationFrame(browFrame);
      targets.forEach(({ mesh, blinkLeft, blinkRight, brow }) => {
        setMorph(mesh, blinkLeft, 0, 1);
        setMorph(mesh, blinkRight, 0, 1);
        setMorph(mesh, brow, 0, 1);
      });
    },
  };
}

export default createMicroExpressionEngine;
