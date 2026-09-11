import * as THREE from 'three';

type ExpressionOptions = { isSpeaking?: () => boolean };
export type MicroExpressionEngine = {
  update: (timestamp?: number, speechAmplitude?: number) => void;
  triggerInsightSmileExpression: (activeState: boolean) => void;
  bindAvatarSkeletonJoints: () => { headBones: THREE.Object3D[]; neckBones: THREE.Object3D[] };
  dispose: () => void;
};

type ExpressionTarget = { mesh: THREE.Mesh; blinkLeft: number[]; blinkRight: number[]; brow: number[]; smile: number[] };
const MORPH_ALIASES: Record<'blinkLeft' | 'blinkRight' | 'brow' | 'smile', string[]> = {
  blinkLeft: ['eyeblinkleft', 'blinkleft', 'blink_l', 'eyecloseleft', 'lefteyeclose', 'left_eye_close'],
  blinkRight: ['eyeblinkright', 'blinkright', 'blink_r', 'eyecloseright', 'righteyeclose', 'right_eye_close'],
  brow: ['browdownleft', 'browdownright', 'browlowerl', 'browlowerr', 'browlowerleft', 'browlowerright', 'browdepress'],
  smile: ['mouthsmile', 'smile', 'mouthsmilel', 'mouthsmiler', 'mouthsmileleft', 'mouthsmileright'],
};
const normalize = (name: string) => name.replace(/[^a-z0-9]/gi, '').toLowerCase();
const matchesAlias = (name: string, aliases: string[]) => { const value = normalize(name); return aliases.some((alias) => { const a = normalize(alias); return value === a || value.includes(a) || a.includes(value); }); };
const collectMorphs = (mesh: THREE.Mesh, aliases: string[]) => !mesh.morphTargetDictionary ? [] : Object.entries(mesh.morphTargetDictionary).filter(([name]) => matchesAlias(name, aliases)).map(([, index]) => index);
const findBone = (bones: THREE.Object3D[], aliases: string[]) => bones.find((bone) => aliases.includes(normalize(bone.name)));

export default function createMicroExpressionEngine(avatarRoot: THREE.Object3D, options: ExpressionOptions = {}): MicroExpressionEngine {
  const isSpeaking = options.isSpeaking ?? (() => false);
  let blinkTimer: number | null = null, browTimer: number | null = null, blinkFrame: number | null = null, browFrame: number | null = null, smileFrame: number | null = null;
  let disposed = false, blinkState = 0, browState = 0, smileState = 0, smileTarget = 0;
  let lastTimestamp = performance.now();
  const headBones: THREE.Object3D[] = [], neckBones: THREE.Object3D[] = [], allBones: THREE.Object3D[] = [];
  const boneBases = new Map<THREE.Object3D, THREE.Euler>();
  const targets: ExpressionTarget[] = [];
  avatarRoot.traverse((node) => {
    if (node instanceof THREE.Bone) { allBones.push(node); const name = normalize(node.name); if (name.includes('head') && !name.includes('end')) headBones.push(node); else if (name.includes('neck')) neckBones.push(node); }
    if (node instanceof THREE.Mesh && node.morphTargetDictionary && node.morphTargetInfluences) targets.push({ mesh: node, blinkLeft: collectMorphs(node, MORPH_ALIASES.blinkLeft), blinkRight: collectMorphs(node, MORPH_ALIASES.blinkRight), brow: collectMorphs(node, MORPH_ALIASES.brow), smile: collectMorphs(node, MORPH_ALIASES.smile) });
  });
  [...headBones, ...neckBones].forEach((bone) => boneBases.set(bone, bone.rotation.clone()));
  const spine0 = findBone(allBones, ['spine']);
  const spine1 = findBone(allBones, ['spine1']);
  const spine2 = findBone(allBones, ['spine2', 'chest']);
  const hips = findBone(allBones, ['hips', 'hip']);
  [spine0, spine1, spine2, hips].filter(Boolean).forEach((bone) => boneBases.set(bone!, bone!.rotation.clone()));
  const hipBasePosition = hips?.position.clone() ?? null;

  const setMorphs = (mesh: THREE.Mesh, indices: number[], value: number, alpha: number) => { if (!indices.length || !mesh.morphTargetInfluences) return; indices.forEach((index) => { mesh.morphTargetInfluences![index] = THREE.MathUtils.lerp(mesh.morphTargetInfluences![index] ?? 0, value, alpha); }); };
  const update = (timestamp = performance.now(), speechAmplitude = 0) => {
    if (disposed) return;
    const dt = Math.min(0.05, Math.max(0, (timestamp - lastTimestamp) / 1000)); lastTimestamp = timestamp;
    const speaking = isSpeaking();
    const amplitude = THREE.MathUtils.clamp(speechAmplitude, 0, 1);
    const speechMotion = THREE.MathUtils.lerp(0, amplitude, 0.1);
    const elapsed = timestamp / 1000;
    if (!speaking) {
      const t = timestamp * 0.0008, headY = Math.sin(t) * 0.045, headX = Math.cos(t * 0.53) * 0.022;
      headBones.forEach((bone) => { const base = boneBases.get(bone); if (base) { bone.rotation.y = THREE.MathUtils.lerp(bone.rotation.y, base.y + headY, 0.06); bone.rotation.x = THREE.MathUtils.lerp(bone.rotation.x, base.x + headX, 0.06); } });
      neckBones.forEach((bone) => { const base = boneBases.get(bone); if (base) bone.rotation.y = THREE.MathUtils.lerp(bone.rotation.y, base.y + headY * 0.42, 0.06); });
    } else [...headBones, ...neckBones].forEach((bone) => { const base = boneBases.get(bone); if (base) { bone.rotation.x = THREE.MathUtils.lerp(bone.rotation.x, base.x, 0.12); bone.rotation.y = THREE.MathUtils.lerp(bone.rotation.y, base.y, 0.12); bone.rotation.z = THREE.MathUtils.lerp(bone.rotation.z, base.z, 0.12); } });
    const breathDamping = speaking ? 0.42 : 1;
    const breathPhase = elapsed * 1.5;
    [{ bone: spine0, amount: 0.006, phase: 0 }, { bone: spine1, amount: 0.008, phase: 0.2 }, { bone: spine2, amount: 0.012, phase: 0.4 }].forEach(({ bone, amount, phase }) => { if (!bone) return; const base = boneBases.get(bone); if (base) { const offset = Math.sin(breathPhase + phase) * amount * breathDamping; bone.rotation.x = THREE.MathUtils.lerp(bone.rotation.x, base.x - offset, 0.08); } });
    if (hips && hipBasePosition) { const target = amplitude > 0.05 ? amplitude : 0; const sway = Math.sin(elapsed * 2.5) * 0.02 * target; const lift = Math.cos(elapsed * 1.25) * 0.01 * target; hips.position.x = THREE.MathUtils.lerp(hips.position.x, hipBasePosition.x + sway, 0.1); hips.position.y = THREE.MathUtils.lerp(hips.position.y, hipBasePosition.y + lift, 0.1); }
    if (spine2) { const base = boneBases.get(spine2); if (base) { const accentPitch = Math.abs(Math.sin(elapsed * 3.75)) * 0.03 * speechMotion; const accentYaw = Math.cos(elapsed * 2.5) * 0.02 * speechMotion; spine2.rotation.x = THREE.MathUtils.lerp(spine2.rotation.x, base.x + accentPitch, 0.1); spine2.rotation.y = THREE.MathUtils.lerp(spine2.rotation.y, base.y + accentYaw, 0.1); } }
    targets.forEach(({ mesh, blinkLeft, blinkRight, brow, smile }) => { setMorphs(mesh, blinkLeft, blinkState, 0.55); setMorphs(mesh, blinkRight, blinkState, 0.55); if (!speaking) setMorphs(mesh, brow, browState, 0.12); setMorphs(mesh, smile, smileState, 0.1); });
    void dt;
  };
  const executeBlink = () => { if (disposed) return; const started = performance.now(), duration = 180; const step = () => { if (disposed) return; const progress = (performance.now() - started) / duration; blinkState = progress < 0.5 ? progress * 2 : progress <= 1 ? 2 - progress * 2 : 0; if (progress <= 1) blinkFrame = requestAnimationFrame(step); else blinkFrame = null; }; if (blinkFrame !== null) cancelAnimationFrame(blinkFrame); blinkFrame = requestAnimationFrame(step); };
  const queueBlink = () => { if (!disposed) blinkTimer = window.setTimeout(() => { executeBlink(); queueBlink(); }, 2200 + Math.random() * 3800); };
  const scheduleBrowDrift = () => { if (!disposed) browTimer = window.setTimeout(() => { if (!isSpeaking() && targets.some((item) => item.brow.length)) { const target = Math.random() * 0.12; const drift = () => { if (disposed || isSpeaking()) return; browState = THREE.MathUtils.lerp(browState, target, 0.08); if (Math.abs(browState - target) > 0.003) browFrame = requestAnimationFrame(drift); else { browState = target; browFrame = null; } }; drift(); } scheduleBrowDrift(); }, 4200 + Math.random() * 3000); };
  const triggerInsightSmileExpression = (activeState: boolean) => { smileTarget = activeState ? 0.28 : 0; if (smileFrame !== null) cancelAnimationFrame(smileFrame); const step = () => { if (disposed) return; smileState = THREE.MathUtils.lerp(smileState, smileTarget, 0.08); if (Math.abs(smileState - smileTarget) > 0.003) smileFrame = requestAnimationFrame(step); else { smileState = smileTarget; smileFrame = null; } }; smileFrame = requestAnimationFrame(step); };
  queueBlink(); scheduleBrowDrift();
  return { update, triggerInsightSmileExpression, bindAvatarSkeletonJoints: () => ({ headBones, neckBones }), dispose: () => { disposed = true; if (blinkTimer !== null) clearTimeout(blinkTimer); if (browTimer !== null) clearTimeout(browTimer); if (blinkFrame !== null) cancelAnimationFrame(blinkFrame); if (browFrame !== null) cancelAnimationFrame(browFrame); if (smileFrame !== null) cancelAnimationFrame(smileFrame); targets.forEach(({ mesh, blinkLeft, blinkRight, brow, smile }) => { setMorphs(mesh, blinkLeft, 0, 1); setMorphs(mesh, blinkRight, 0, 1); setMorphs(mesh, brow, 0, 1); setMorphs(mesh, smile, 0, 1); }); [...headBones, ...neckBones].forEach((bone) => { const base = boneBases.get(bone); if (base) bone.rotation.copy(base); }); if (hipBasePosition && hips) hips.position.copy(hipBasePosition); } };
}
