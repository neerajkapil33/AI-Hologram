import * as THREE from 'three';

type ExpressionOptions = { isSpeaking?: () => boolean };
export type MicroExpressionEngine = {
  update: (timestamp?: number) => void;
  triggerInsightSmileExpression: (activeState: boolean) => void;
  bindAvatarSkeletonJoints: () => { headBones: THREE.Object3D[]; neckBones: THREE.Object3D[] };
  dispose: () => void;
};

type ExpressionTarget = {
  mesh: THREE.Mesh;
  blinkLeft: number[];
  blinkRight: number[];
  brow: number[];
  smile: number[];
};

const MORPH_ALIASES: Record<'blinkLeft' | 'blinkRight' | 'brow' | 'smile', string[]> = {
  blinkLeft: ['eyeblinkleft', 'blinkleft', 'blink_l', 'eyecloseleft', 'lefteyeclose', 'left_eye_close'],
  blinkRight: ['eyeblinkright', 'blinkright', 'blink_r', 'eyecloseright', 'righteyeclose', 'right_eye_close'],
  brow: ['browdownleft', 'browdownright', 'browlowerl', 'browlowerr', 'browlowerleft', 'browlowerright', 'browdepress'],
  smile: ['mouthsmile', 'smile', 'mouthsmilel', 'mouthsmiler', 'mouthsmileleft', 'mouthsmileright'],
};

const normalize = (name: string) => name.replace(/[^a-z0-9]/gi, '').toLowerCase();
const matchesAlias = (name: string, aliases: string[]) => {
  const value = normalize(name);
  return aliases.some((alias) => {
    const a = normalize(alias);
    return value === a || value.includes(a) || a.includes(value);
  });
};

const collectMorphs = (mesh: THREE.Mesh, aliases: string[]) => {
  if (!mesh.morphTargetDictionary) return [];
  return Object.entries(mesh.morphTargetDictionary)
    .filter(([name]) => matchesAlias(name, aliases))
    .map(([, index]) => index);
};

export default function createMicroExpressionEngine(avatarRoot: THREE.Object3D, options: ExpressionOptions = {}): MicroExpressionEngine {
  const isSpeaking = options.isSpeaking ?? (() => false);
  let blinkTimer: number | null = null;
  let browTimer: number | null = null;
  let blinkFrame: number | null = null;
  let browFrame: number | null = null;
  let smileFrame: number | null = null;
  let disposed = false;
  let blinkState = 0;
  let browState = 0;
  let smileState = 0;
  let smileTarget = 0;

  const headBones: THREE.Object3D[] = [];
  const neckBones: THREE.Object3D[] = [];
  const boneBases = new Map<THREE.Object3D, THREE.Euler>();
  const targets: ExpressionTarget[] = [];

  avatarRoot.traverse((node) => {
    if (node instanceof THREE.Bone) {
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

  const setMorphs = (mesh: THREE.Mesh, indices: number[], value: number, alpha: number) => {
    if (!indices.length || !mesh.morphTargetInfluences) return;
    indices.forEach((index) => {
      const current = mesh.morphTargetInfluences?.[index] ?? 0;
      if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(current, value, alpha);
    });
  };

  const update = (timestamp = performance.now()) => {
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
        if (!base) return;
        bone.rotation.x = THREE.MathUtils.lerp(bone.rotation.x, base.x, 0.12);
        bone.rotation.y = THREE.MathUtils.lerp(bone.rotation.y, base.y, 0.12);
        bone.rotation.z = THREE.MathUtils.lerp(bone.rotation.z, base.z, 0.12);
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
      blinkState = progress < 0.5 ? progress * 2 : progress <= 1 ? 2 - progress * 2 : 0;
      if (progress <= 1) blinkFrame = requestAnimationFrame(step);
      else blinkFrame = null;
    };
    if (blinkFrame !== null) cancelAnimationFrame(blinkFrame);
    blinkFrame = requestAnimationFrame(step);
  };

  const queueBlink = () => {
    if (disposed) return;
    blinkTimer = window.setTimeout(() => { executeBlink(); queueBlink(); }, 2200 + Math.random() * 3800);
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
          else { browState = target; browFrame = null; }
        };
        drift();
      }
      scheduleBrowDrift();
    }, 4200 + Math.random() * 3000);
  };

  const triggerInsightSmileExpression = (activeState: boolean) => {
    smileTarget = activeState ? 0.28 : 0;
    if (smileFrame !== null) cancelAnimationFrame(smileFrame);
    const step = () => {
      if (disposed) return;
      smileState = THREE.MathUtils.lerp(smileState, smileTarget, 0.08);
      if (Math.abs(smileState - smileTarget) > 0.003) smileFrame = requestAnimationFrame(step);
      else { smileState = smileTarget; smileFrame = null; }
    };
    smileFrame = requestAnimationFrame(step);
  };

  queueBlink();
  scheduleBrowDrift();

  return {
    update,
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
