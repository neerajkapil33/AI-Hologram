/**
 * ADVANCED DYNAMIC AVATAR IDLE & EXPRESSION ENGINE
 * Native Vite/Three.js module for organic blinking, eyebrow drift,
 * gaze/head-neck micro-drift, and positive insight expressions.
 */

import * as THREE from 'three';

const EXPRESSION_MAP = {
  blinkLeft: ['eyeBlinkLeft', 'Blink_Left', 'blink_L', 'mb_lab_eye_blink_L', 'shapes.left_eye_close'],
  blinkRight: ['eyeBlinkRight', 'Blink_Right', 'blink_R', 'mb_lab_eye_blink_R', 'shapes.right_eye_close'],
  browSneer: ['browDownLeft', 'browDownRight', 'Brow_Lower_L', 'Brow_Lower_R', 'mb_lab_brow_depress'],
  smileShape: ['mouthSmile', 'Smile', 'mouth_Smile', 'Mouth_Smile_L', 'Mouth_Smile_R', 'mb_lab_mouth_smile'],
};

const normalizeMorphName = (name) => name.replace(/[\s_-]+/g, '').toLowerCase();

const findMorphIndex = (mesh, keyType) => {
  if (!mesh.morphTargetDictionary) return null;
  const alternatives = [keyType, ...(EXPRESSION_MAP[keyType] ?? [])].map(normalizeMorphName);
  const entry = Object.entries(mesh.morphTargetDictionary).find(([name]) => alternatives.includes(normalizeMorphName(name)));
  return entry ? entry[1] : null;
};

export function createMicroExpressionEngine(avatarRoot, { isSpeaking = () => false } = {}) {
  let blinkTimer = null;
  let browTimer = null;
  let blinkFrame = null;
  let browFrame = null;
  let smileFrame = null;
  let disposed = false;
  let blinkState = 0;
  let browState = 0;
  let smileState = 0;
  let smileTarget = 0;

  let headBone = null;
  let neckBone = null;
  const headBase = new THREE.Euler();
  const neckBase = new THREE.Euler();

  const targets = [];
  avatarRoot.traverse((node) => {
    if (node.isBone) {
      const name = node.name.toLowerCase();
      // Prefer exact anatomical joints over similarly named helper bones.
      if (!headBone && (name === 'head' || name.endsWith('_head') || name.includes('head'))) headBone = node;
      if (!neckBone && (name === 'neck' || name.endsWith('_neck') || name.includes('neck'))) neckBone = node;
    }
    if (!(node instanceof THREE.Mesh) || !node.morphTargetDictionary || !node.morphTargetInfluences) return;
    targets.push({
      mesh: node,
      blinkLeft: findMorphIndex(node, 'blinkLeft'),
      blinkRight: findMorphIndex(node, 'blinkRight'),
      brow: findMorphIndex(node, 'browSneer'),
      smile: findMorphIndex(node, 'smileShape'),
    });
  });

  if (headBone) headBase.copy(headBone.rotation);
  if (neckBone) neckBase.copy(neckBone.rotation);

  const setMorph = (mesh, index, value, alpha) => {
    if (index === null || index === undefined || !mesh.morphTargetInfluences) return;
    const current = mesh.morphTargetInfluences[index] ?? 0;
    mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(current, value, alpha);
  };

  const apply = (timestamp = performance.now()) => {
    if (disposed) return;
    const speaking = isSpeaking();

    // Keep the existing skeleton pose as the reference and add only tiny idle drift.
    if (!speaking) {
      const t = timestamp * 0.0008;
      const headY = Math.sin(t) * 0.04;
      const headX = Math.cos(t * 0.5) * 0.02;
      if (headBone) {
        headBone.rotation.y = THREE.MathUtils.lerp(headBone.rotation.y, headBase.y + headY, 0.05);
        headBone.rotation.x = THREE.MathUtils.lerp(headBone.rotation.x, headBase.x + headX, 0.05);
      }
      if (neckBone) neckBone.rotation.y = THREE.MathUtils.lerp(neckBone.rotation.y, neckBase.y + headY * 0.4, 0.05);
    } else {
      if (headBone) {
        headBone.rotation.y = THREE.MathUtils.lerp(headBone.rotation.y, headBase.y, 0.1);
        headBone.rotation.x = THREE.MathUtils.lerp(headBone.rotation.x, headBase.x, 0.1);
      }
      if (neckBone) neckBone.rotation.y = THREE.MathUtils.lerp(neckBone.rotation.y, neckBase.y, 0.1);
    }

    targets.forEach(({ mesh, blinkLeft, blinkRight, brow, smile }) => {
      setMorph(mesh, blinkLeft, blinkState, 0.42);
      setMorph(mesh, blinkRight, blinkState, 0.42);
      if (!speaking) setMorph(mesh, brow, browState, 0.1);
      setMorph(mesh, smile, smileState, 0.08);
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
          else {
            browState = target;
            browFrame = null;
          }
        };
        drift();
      }
      scheduleBrowDrift();
    }, 4000 + Math.random() * 3000);
  };

  const triggerInsightSmileExpression = (activeState) => {
    smileTarget = activeState ? 0.28 : 0;
    if (smileFrame !== null) cancelAnimationFrame(smileFrame);
    const step = () => {
      if (disposed) return;
      smileState = THREE.MathUtils.lerp(smileState, smileTarget, 0.08);
      if (Math.abs(smileState - smileTarget) > 0.003) smileFrame = requestAnimationFrame(step);
      else {
        smileState = smileTarget;
        smileFrame = null;
      }
    };
    smileFrame = requestAnimationFrame(step);
  };

  queueBlink();
  scheduleBrowDrift();

  return {
    update: apply,
    triggerInsightSmileExpression,
    bindAvatarSkeletonJoints: () => ({ headBone, neckBone }),
    dispose: () => {
      disposed = true;
      if (blinkTimer !== null) window.clearTimeout(blinkTimer);
      if (browTimer !== null) window.clearTimeout(browTimer);
      if (blinkFrame !== null) cancelAnimationFrame(blinkFrame);
      if (browFrame !== null) cancelAnimationFrame(browFrame);
      if (smileFrame !== null) cancelAnimationFrame(smileFrame);
      targets.forEach(({ mesh, blinkLeft, blinkRight, brow, smile }) => {
        setMorph(mesh, blinkLeft, 0, 1);
        setMorph(mesh, blinkRight, 0, 1);
        setMorph(mesh, brow, 0, 1);
        setMorph(mesh, smile, 0, 1);
      });
      if (headBone) headBone.rotation.copy(headBase);
      if (neckBone) neckBone.rotation.copy(neckBase);
    },
  };
}

export default createMicroExpressionEngine;
