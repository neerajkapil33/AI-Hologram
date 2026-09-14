import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import createMicroExpressionEngine, { type MicroExpressionEngine } from './idle-behavior';

export type AvatarCommand =
  | { type: 'expression'; value: string }
  | { type: 'viseme'; value: string; weight?: number }
  | { type: 'gesture'; value: string }
  | { type: 'performance'; value: any };

type AvatarApi = { command: (cmd: AvatarCommand) => void };
type Props = { onStatus?: (status: string) => void; onApi?: (api: AvatarApi) => void };
type BoneGroup = THREE.Object3D[];
type Bones = { head: BoneGroup; neck: BoneGroup; spine: BoneGroup; lArm: BoneGroup; rArm: BoneGroup; lFore: BoneGroup; rFore: BoneGroup; lHand: BoneGroup; rHand: BoneGroup; lThigh: BoneGroup; rThigh: BoneGroup; lCalf: BoneGroup; rCalf: BoneGroup; jaw: BoneGroup; lEye: BoneGroup; rEye: BoneGroup; lLid: BoneGroup; rLid: BoneGroup };
type Morph = { mesh: THREE.Mesh; index: number; name: string };

const SRC = `${import.meta.env.BASE_URL}profile/avatar.fbx`;
const norm = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase();
const side = (n: string, left: boolean) => left ? /left|lft|(^|armature)l(arm|forearm|hand|thigh|calf|leg|eye|lid)/.test(n) : /right|rgt|(^|armature)r(arm|forearm|hand|thigh|calf|leg|eye|lid)/.test(n);
const emptyBones = (): Bones => ({ head: [], neck: [], spine: [], lArm: [], rArm: [], lFore: [], rFore: [], lHand: [], rHand: [], lThigh: [], rThigh: [], lCalf: [], rCalf: [], jaw: [], lEye: [], rEye: [], lLid: [], rLid: [] });

function detectBones(root: THREE.Object3D): Bones {
  const b = emptyBones();
  root.traverse((o) => {
    if (!(o instanceof THREE.Bone)) return;
    const n = norm(o.name);
    if (/jaw|mandible|lowerface/.test(n)) b.jaw.push(o);
    else if (/eyelid|lid|upperlid|lowerlid/.test(n)) side(n, true) ? b.lLid.push(o) : side(n, false) && b.rLid.push(o);
    else if (/head/.test(n) && !/end/.test(n)) b.head.push(o);
    else if (/neck/.test(n)) b.neck.push(o);
    else if (/spine|chest|abdomen|pelvis|hips/.test(n)) b.spine.push(o);
    else if (/upperarm|arm/.test(n)) side(n, true) ? b.lArm.push(o) : side(n, false) && b.rArm.push(o);
    else if (/forearm|lowerarm|elbow/.test(n)) side(n, true) ? b.lFore.push(o) : side(n, false) && b.rFore.push(o);
    else if (/hand|wrist/.test(n)) side(n, true) ? b.lHand.push(o) : side(n, false) && b.rHand.push(o);
    else if (/thigh|upleg/.test(n)) side(n, true) ? b.lThigh.push(o) : side(n, false) && b.rThigh.push(o);
    else if (/calf|lowerleg|shin/.test(n)) side(n, true) ? b.lCalf.push(o) : side(n, false) && b.rCalf.push(o);
    else if (/eye/.test(n)) side(n, true) ? b.lEye.push(o) : side(n, false) && b.rEye.push(o);
  });
  return b;
}

const mouthPattern = /mouth|viseme|phoneme|lip|tongue|jaw|aa|ae|ah|ao|aw|eh|er|ih|iy|oh|ow|oy|uh|uw/i;
const blinkPattern = /blink|eyelid|eyeclose|closeeye|lidclose/i;
const smilePattern = /smile|happy|grin/i;

export default function AvatarEngine({ onStatus, onApi }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef(onStatus);
  const apiRef = useRef(onApi);

  useEffect(() => { statusRef.current = onStatus; apiRef.current = onApi; }, [onApi, onStatus]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setClearColor(0, 0);
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:2;pointer-events:none';
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xc7efff, 0x10151d, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 3.0); key.position.set(3, 6, 5); scene.add(key);
    const fill = new THREE.DirectionalLight(0x9beeff, 1.6); fill.position.set(-3, 3, 4); scene.add(fill);

    const root = new THREE.Group(); scene.add(root);
    const loader = new FBXLoader();
    let model: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let micro: MicroExpressionEngine | null = null;
    let bones: Bones | null = null;
    let activeAction: THREE.AnimationAction | null = null;
    let idleAction: THREE.AnimationAction | null = null;
    let disposed = false;
    let speaking = false;
    let mouth = 0;
    let targetMouth = 0;
    let lastAudio = 0;
    let mode = 'idle';
    let gestureUntil = 0;
    let gestureStart = 0;
    let rotation = 0;
    let expression = 'neutral';

    const actions = new Map<string, THREE.AnimationAction>();
    const morphs: Morph[] = [], blinks: Morph[] = [], smiles: Morph[] = [];
    const offsets = new Map<THREE.Object3D, THREE.Euler>();

    const offset = (o: THREE.Object3D, x = 0, y = 0, z = 0, smooth = 7) => {
      const e = offsets.get(o) ?? new THREE.Euler();
      e.x = THREE.MathUtils.damp(e.x, x, smooth, 1 / 60);
      e.y = THREE.MathUtils.damp(e.y, y, smooth, 1 / 60);
      e.z = THREE.MathUtils.damp(e.z, z, smooth, 1 / 60);
      offsets.set(o, e);
    };

    const applyOffsets = () => offsets.forEach((e, o) => { o.rotation.x += e.x; o.rotation.y += e.y; o.rotation.z += e.z; });
    const setMorphs = (items: Morph[], value: number, alpha = 0.3) => items.forEach(({ mesh, index }) => { if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(mesh.morphTargetInfluences[index] ?? 0, value, alpha); });
    const setMouth = (v: number) => {
      const value = THREE.MathUtils.clamp(v, 0, 1);
      morphs.forEach(({ mesh, index, name }) => { if (mesh.morphTargetInfluences) { const n = norm(name); const w = /open|jaw|aa|ah|ao|oh|uh/.test(n) ? value : /lip|mouth|viseme|phoneme/.test(n) ? value * 0.7 : value * 0.35; mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(mesh.morphTargetInfluences[index] ?? 0, w, 0.35); } });
      bones?.jaw.forEach((b) => offset(b, -0.22 * value, 0, 0));
    };
    const findAction = (patterns: RegExp[]) => [...actions.entries()].find(([name]) => patterns.some((p) => p.test(name)))?.[1] ?? null;
    const play = (action: THREE.AnimationAction | null, loop: THREE.AnimationActionLoopStyles) => {
      if (!action || action === activeAction) return;
      action.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).setLoop(loop, loop === THREE.LoopOnce ? 1 : Infinity);
      action.clampWhenFinished = loop === THREE.LoopOnce;
      if (activeAction) activeAction.crossFadeTo(action, 0.3, true);
      action.play(); activeAction = action;
    };
    const start = (name: string, ms = 1400) => { mode = name; gestureStart = performance.now(); gestureUntil = gestureStart + ms; };

    const command = (cmd: AvatarCommand) => {
      if (cmd.type === 'performance') { if (typeof cmd.value?.speaking === 'boolean') speaking = cmd.value.speaking; return; }
      if (cmd.type === 'viseme') { targetMouth = /silence|close|rest/i.test(cmd.value) ? 0 : THREE.MathUtils.clamp(Number(cmd.weight ?? 0), 0, 1); lastAudio = performance.now(); return; }
      if (cmd.type === 'expression') { const v = cmd.value.toLowerCase(); speaking = /speaking|talk/.test(v) || speaking; if (/smile|happy|warm|positive|success|confident/.test(v)) expression = 'smile'; if (/sad/.test(v)) expression = 'sad'; if (/neutral|rest|stop/.test(v)) { speaking = false; expression = 'neutral'; start('idle', 1); } return; }
      const v = cmd.value.toLowerCase();
      if (v === 'rotate') { rotation += Math.PI * 0.55; return; }
      if (v === 'idle') { speaking = false; start('idle', 1); if (idleAction) play(idleAction, THREE.LoopRepeat); return; }
      const native = v.includes('wave') ? findAction([/wave|greet|salute/]) : v.includes('walk') ? findAction([/walk|locomotion/]) : v.includes('handshake') ? findAction([/handshake|shake/]) : v.includes('talk') ? findAction([/talk|speak|conversation/]) : null;
      if (native) play(native, v.includes('walk') ? THREE.LoopRepeat : THREE.LoopOnce);
      if (v.includes('wave')) start('wave'); else if (v.includes('point')) start('point'); else if (v.includes('present') || v.includes('open-hand')) start('present'); else if (v.includes('handshake')) start('handshake', 1700); else if (v.includes('nod')) start('nod', 1100); else if (v.includes('shrug')) start('shrug', 1000); else if (v.includes('laugh')) start('laugh', 1500); else if (v.includes('smile') || v.includes('happy')) { expression = 'smile'; start('smile', 1200); } else if (v.includes('eyes')) start('eyes', 1600); else if (v.includes('talk')) { speaking = true; start('talk', 900000); } else if (v.includes('walk')) start('walk', 900000);
    };
    apiRef.current = { command };

    loader.load(SRC, (loaded) => {
      if (disposed) return;
      model = loaded;
      // Add the model BEFORE any optional animation/micro-expression setup so a plugin failure cannot make the avatar disappear.
      root.add(loaded);
      loaded.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.frustumCulled = false;
          o.castShadow = true;
          if (o.morphTargetDictionary && o.morphTargetInfluences) Object.entries(o.morphTargetDictionary).forEach(([name, index]) => { const item = { mesh: o, index, name }; if (mouthPattern.test(name)) morphs.push(item); if (blinkPattern.test(name)) blinks.push(item); if (smilePattern.test(name)) smiles.push(item); });
        }
      });
      bones = detectBones(loaded);
      mixer = new THREE.AnimationMixer(loaded);
      loaded.animations.forEach((clip) => actions.set(norm(clip.name), mixer!.clipAction(clip)));
      idleAction = findAction([/idle|stand|breath|rest|neutral/]);
      if (idleAction) play(idleAction, THREE.LoopRepeat);

      // Micro expressions are optional. Never let a rig-specific exception hide the avatar.
      try { micro = createMicroExpressionEngine(loaded, { isSpeaking: () => speaking }); } catch { micro = null; }

      loaded.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(loaded);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const height = Math.max(size.y, 1);
      loaded.position.set(-center.x, -box.min.y, -center.z);
      loaded.updateMatrixWorld(true);
      const distance = Math.max(height * 1.15, 2.5);
      camera.position.set(0, height * 0.48, distance);
      camera.lookAt(0, height * 0.48, 0);
      camera.near = Math.max(0.01, height / 1000); camera.far = Math.max(100, height * 20); camera.updateProjectionMatrix();
      statusRef.current?.(`3D AVATAR READY • ${bones.head.length ? 'HEAD' : 'BODY'} • ${morphs.length ? 'LIPS' : bones.jaw.length ? 'JAW' : 'MOUTH'} • ${bones.lEye.length || blinks.length ? 'EYES' : 'NO EYE RIG'} • ${actions.size} FBX ANIMS`);
    }, undefined, (error) => { if (!disposed) statusRef.current?.(`AVATAR LOAD ERROR • ${error instanceof Error ? error.message : 'CHECK avatar.fbx'}`); });

    const resize = () => { const w = Math.max(1, mount.clientWidth), h = Math.max(1, mount.clientHeight); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    resize(); const ro = new ResizeObserver(resize); ro.observe(mount);

    let blinkTimer = 0;
    const blink = () => { if (disposed) return; const started = performance.now(); const step = () => { const p = (performance.now() - started) / 150; if (p <= 1) { const v = p < 0.5 ? p * 2 : 2 - p * 2; setMorphs(blinks, v, 0.6); bones?.lLid.forEach((b) => offset(b, v * 0.12, 0, 0)); bones?.rLid.forEach((b) => offset(b, v * 0.12, 0, 0)); requestAnimationFrame(step); } else { setMorphs(blinks, 0, 0.7); blinkTimer = window.setTimeout(blink, 2200 + Math.random() * 3600); } }; requestAnimationFrame(step); };
    blinkTimer = window.setTimeout(blink, 1800);

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.05), now = performance.now(), t = now * 0.001;
      if (rotation) root.rotation.y = THREE.MathUtils.damp(root.rotation.y, rotation, 5, dt);
      mixer?.update(dt);
      offsets.clear();
      if (bones) {
        const active = now < gestureUntil;
        const p = active ? Math.sin(THREE.MathUtils.clamp((now - gestureStart) / Math.max(gestureUntil - gestureStart, 1), 0, 1) * Math.PI) : 0;
        bones.spine.forEach((b, i) => offset(b, Math.sin(t * 1.4) * 0.012 * (i + 1), Math.sin(t * 0.5) * 0.014));
        bones.neck.forEach((b) => offset(b, Math.sin(t * 0.7) * 0.025, Math.sin(t * 0.45) * 0.035));
        bones.head.forEach((b) => offset(b, Math.sin(t * 0.72) * 0.035, Math.sin(t * 0.5) * 0.05, Math.sin(t * 0.6) * 0.012));
        const gx = Math.sin(t * 0.75) * 0.09 + Math.sin(t * 2.8) * 0.015, gy = Math.sin(t * 0.48) * 0.045;
        bones.lEye.forEach((b) => offset(b, -gy, gx)); bones.rEye.forEach((b) => offset(b, -gy, gx));
        if (speaking) { const fallback = now - lastAudio > 220 ? 0.12 + (Math.sin(t * 10) * 0.5 + 0.5) * 0.18 : targetMouth; mouth = THREE.MathUtils.damp(mouth, Math.max(targetMouth, fallback), 14, dt); setMouth(mouth); } else { mouth = THREE.MathUtils.damp(mouth, 0, 10, dt); setMouth(mouth); }
        if (expression === 'smile') setMorphs(smiles, 0.65, 0.12); else setMorphs(smiles, 0, 0.08);
        if (mode === 'wave') { bones.rArm.forEach((b) => offset(b, -0.75 * p, 0, -0.35 * p)); bones.rFore.forEach((b) => offset(b, -0.55 * p, 0, 0.2 * p)); bones.rHand.forEach((b) => offset(b, 0, Math.sin(t * 8) * 0.35 * p, 0)); }
        else if (mode === 'point') { bones.rArm.forEach((b) => offset(b, -0.6 * p, -0.2 * p, -0.35 * p)); bones.rFore.forEach((b) => offset(b, -0.9 * p, 0, 0)); }
        else if (mode === 'present') { bones.rArm.forEach((b) => offset(b, -0.5 * p, -0.25 * p, -0.25 * p)); bones.lArm.forEach((b) => offset(b, -0.5 * p, 0.25 * p, 0.25 * p)); }
        else if (mode === 'nod') bones.head.forEach((b) => offset(b, Math.sin((now - gestureStart) * 0.018) * 0.15 * p, 0, 0));
        else if (mode === 'shrug') bones.spine.forEach((b) => offset(b, -0.06 * p, 0, 0));
        else if (mode === 'laugh') bones.head.forEach((b) => offset(b, Math.sin(t * 8) * 0.05 * p, 0, 0));
        else if (mode === 'talk') { bones.lArm.forEach((b) => offset(b, Math.sin(t * 2.2) * 0.05, 0, 0)); bones.rArm.forEach((b) => offset(b, Math.sin(t * 2.2 + Math.PI) * 0.05, 0, 0)); }
        applyOffsets();
      }
      try { micro?.update(now); } catch { /* optional rig-specific micro animation */ }
      renderer.render(scene, camera);
    });

    return () => { disposed = true; renderer.setAnimationLoop(null); ro.disconnect(); window.clearTimeout(blinkTimer); try { micro?.dispose(); } catch {} mixer?.stopAllAction(); model?.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); const mats = Array.isArray(o.material) ? o.material : [o.material]; mats.forEach((m) => m.dispose()); } }); renderer.dispose(); renderer.domElement.remove(); apiRef.current = null; };
  }, []);

  return <div ref={mountRef} className="relative w-full h-full min-h-[500px]" />;
}
