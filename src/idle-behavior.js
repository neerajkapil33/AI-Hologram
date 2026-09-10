/**
 * ROBUST DYNAMIC AVATAR IDLE & EXPRESSION ENGINE
 * Works against the actual GLTF rig instead of assuming one exact
 * morph-target or bone naming convention.
 */

import * as THREE from 'three';

const MORPH_ALIASES = {
  blinkLeft: ['eyeblinkleft', 'blinkleft', 'blink_l', 'blinkleft', 'eyecloseleft', 'lefteyeclose', 'left_eye_close'],
  blinkRight: ['eyeblinkright', 'blinkright', 'blink_r', 'blinkright', 'eyecloseright', 'righteyeclose', 'right_eye_close'],
  brow: ['browdownleft', 'browdownright', 'browlowerl', 'browlowerr', 'browlowerleft', 'browlowerright', 'browdepress'],
  smile: ['mouthsmile', 'smile', 'mouthsmilel', 'mouthsmiler', 'mouthsmileleft', 'mouthsmileright', 'mouth_smile_l', 'mouth_smile_r'],
};

const normalize = (name = '') => name.replace(/[^a-z0-9]/gi, '').toLowerCase();

const matchesAlias = (name, aliases) => {
  const value = normalize(name);
  return aliases.some((alias) => {
    const a = normalize(alias);
    return value === a || value.includes(a) || a.includes(value);
  });
};

const collectMorphs = (mesh, aliases) => {
  if (!mesh.morphTargetDictionary) return [];
  return Object.entries(mesh.morphTargetDictionary)
    .filter(([name]) => matchesAlias(name, aliases))
    .map(([, index]) => index);
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

  const headBones = [];
  const neckBones = [];
  const boneBases = new Map();
  const targets = [];

  avatarRoot.traverse((node) => {
    if (node.isBone) {
      const name = normalize(node.name);
      if (name.includes('head') && !name.includes('end')) headBones.push(node);
      else if (name.includes('neck')) neckBones.push(node);
    }

    if (!(node instanceof THREE.Mesh) || !node.morphTargetDictionary || !node.morphTargetInfluences) return;
    targets.push({
      mesh: node,
      blinkLeft: collectMorphs(node, MORPH_ALIASES.blinkLeft),
      blinkRight: collectMorphs(node, MORPH_ALIASES.blinkRight),
      brow: collectMorphs(node, MORPH_ALIASES.brow),
      smile: collectMorphs(node, MORPH_ALIASES.smile),
    });
  });

  [...headBones, ...neckBones].forEach((bone) => boneBases.set(bone, bone.rotation.clone()));

  const setMorphs = (mesh, indices, value, alpha) => {
    if (!indices.length || !mesh.morphTargetInfluences) return;
    indices.forEach((index) => {
      const current = mesh.morphTargetInfluences[index] ?? 0;
      mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(current, value, alpha);
    });
  };

  const apply = (timestamp = performance.now()) => {
    if (disposed) return;
    const speaking = isSpeaking();

    if (!speaking) {
      const t = timestamp * 0.0008;
      const headY = Math.sin(t) * 0.045;
      const headX = Math.cos(t * 0.53) * 0.022;
      headBones.forEach((bone) => {
        const base = boneBases.get(bone);
        if (!base) return;
        bone.rotation.y = THREE.MathUtils.lerp(bone.rotation.y, base.y + headY, 0.06);
        bone.rotation.x = THREE.MathUtils.lerp(bone.rotation.x, base.x + headX, 0.06);
      });
      neckBones.forEach((bone) => {
        const base = boneBases.get(bone);
        if (!base) return;
        bone.rotation.y = THREE.MathUtils.lerp(bone.rotation.y, base.y + headY * 0.42, 0.06);
      });
    } else {
      [...headBones, ...neckBones].forEach((bone) => {
        const base = boneBases.get(bone);
        if (base) bone.rotation.lerp(base, 0.12);
      });
    }

    targets.forEach(({ mesh, blinkLeft, blinkRight, brow, smile }) => {
      setMorphs(mesh, blinkLeft, blinkState, 0.55);
      setMorphs(mesh, blinkRight, blinkState, 0.55);
      if (!speaking) setMorphs(mesh, brow, browState, 0.12);
      setMorphs(mesh, smile, smileState, 0.1);
    });
  };

  const executeBlink = () => {
    if (disposed) return;
    const started = performance.now();
    const duration = 180;
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
    }, 2200 + Math.random() * 3800);
  };

  const scheduleBrowDrift = () => {
    if (disposed) return;
    browTimer = window.setTimeout(() => {
      if (!isSpeaking() && targets.some((item) => item.brow.length)) {
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
    }, 4200 + Math.random() * 3000);
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
    bindAvatarSkeletonJoints: () => ({ headBones, neckBones }),
    dispose: () => {
      disposed = true;
      if (blinkTimer !== null) window.clearTimeout(blinkTimer);
      if (browTimer !== null) window.clearTimeout(browTimer);
      if (blinkFrame !== null) cancelAnimationFrame(blinkFrame);
      if (browFrame !== null) cancelAnimationFrame(browFrame);
      if (smileFrame !== null) cancelAnimationFrame(smileFrame);
      targets.forEach(({ mesh, blinkLeft, blinkRight, brow, smile }) => {
        setMorphs(mesh, blinkLeft, 0, 1);
        setMorphs(mesh, blinkRight, 0, 1);
        setMorphs(mesh, brow, 0, 1);
        setMorphs(mesh, smile, 0, 1);
      });
      [...headBones, ...neckBones].forEach((bone) => {
        const base = boneBases.get(bone);
        if (base) bone.rotation.copy(base);
      });
    },
  };
}

export default createMicroExpressionEngine;
