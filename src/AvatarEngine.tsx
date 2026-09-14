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
type Group = THREE.Object3D[];
type Bones = { head: Group; neck: Group; spine: Group; shoulders: Group; lArm: Group; rArm: Group; lFore: Group; rFore: Group; lHand: Group; rHand: Group; lThigh: Group; rThigh: Group; lCalf: Group; rCalf: Group };
type Morph = { mesh: THREE.Mesh; index: number };

const SRC = `${import.meta.env.BASE_URL}profile/avatar.fbx`;
const norm = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase();
const side = (n: string, s: 'l' | 'r') => s === 'l' ? /left|lft/.test(n) || n.startsWith('l') : /right|rgt/.test(n) || n.startsWith('r');
const emptyBones = (): Bones => ({ head: [], neck: [], spine: [], shoulders: [], lArm: [], rArm: [], lFore: [], rFore: [], lHand: [], rHand: [], lThigh: [], rThigh: [], lCalf: [], rCalf: [] });

function detectBones(root: THREE.Object3D) {
  const b = emptyBones();
  root.traverse((o) => {
    if (!(o instanceof THREE.Bone)) return;
    const n = norm(o.name);
    if (/head/.test(n) && !/end/.test(n)) b.head.push(o);
    else if (/neck/.test(n)) b.neck.push(o);
    else if (/spine|chest|abdomen|pelvis|hips/.test(n)) b.spine.push(o);
    else if (/shoulder|clavicle/.test(n)) b.shoulders.push(o);
    else if (/upperarm|arm/.test(n)) side(n, 'l') ? b.lArm.push(o) : side(n, 'r') && b.rArm.push(o);
    else if (/forearm|lowerarm|elbow/.test(n)) side(n, 'l') ? b.lFore.push(o) : side(n, 'r') && b.rFore.push(o);
    else if (/hand|wrist/.test(n)) side(n, 'l') ? b.lHand.push(o) : side(n, 'r') && b.rHand.push(o);
    else if (/thigh|upleg/.test(n)) side(n, 'l') ? b.lThigh.push(o) : side(n, 'r') && b.rThigh.push(o);
    else if (/calf|lowerleg|shin/.test(n)) side(n, 'l') ? b.lCalf.push(o) : side(n, 'r') && b.rCalf.push(o);
  });
  return b;
}

export default function AvatarEngine({ onStatus, onApi }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef(onStatus); const apiRef = useRef(onApi);
  useEffect(() => { statusRef.current = onStatus; apiRef.current = onApi; }, [onApi, onStatus]);

  useEffect(() => {
    const mount = mountRef.current; if (!mount) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    const layer = document.createElement('div'); layer.style.cssText = 'position:absolute;inset:0;z-index:2;pointer-events:none'; mount.appendChild(layer); layer.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xb9ecff, 0x07111d, 2.2)); const key = new THREE.DirectionalLight(0xffffff, 2.5); key.position.set(3, 6, 5); scene.add(key); const fill = new THREE.DirectionalLight(0x9beeff, 1.3); fill.position.set(-3, 3, 4); scene.add(fill);
    const root = new THREE.Group(); scene.add(root); const loader = new FBXLoader();
    let model: THREE.Object3D | null = null; let mixer: THREE.AnimationMixer | null = null; let micro: MicroExpressionEngine | null = null; let bones: Bones | null = null;
    let active: THREE.AnimationAction | null = null; let mode = 'idle'; let strength = 0; let started = 0; let rotation = 0; let spin = 0; let speaking = false;
    const bases = new Map<THREE.Object3D, THREE.Euler>(); const actions = new Map<string, THREE.AnimationAction>(); const morphs: Morph[] = [];

    const rotate = (o: THREE.Object3D, x: number, y: number, z: number, amount: number) => { const base = bases.get(o); if (!base) return; o.rotation.x = THREE.MathUtils.lerp(o.rotation.x, base.x + x * amount, .20); o.rotation.y = THREE.MathUtils.lerp(o.rotation.y, base.y + y * amount, .20); o.rotation.z = THREE.MathUtils.lerp(o.rotation.z, base.z + z * amount, .20); };
    const setMouth = (v: number, a = .25) => morphs.forEach(({ mesh, index }) => { if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(mesh.morphTargetInfluences[index] ?? 0, v, a); });
    const findAction = (rx: RegExp[]) => [...actions.entries()].find(([n]) => rx.some((r) => r.test(n)))?.[1] ?? null;
    const play = (a: THREE.AnimationAction | null) => { if (!a || a === active) return; a.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play(); active?.crossFadeTo(a, .2, true); active = a; };

    const motion = (now: number, dt: number) => {
      if (!bones) return; const t = now / 1000; const breathing = Math.sin(t * 1.5) * .02;
      bones.spine.forEach((b, i) => rotate(b, breathing + Math.sin(t * 1.2 + i) * .01, Math.sin(t * .6) * .018, 0, 1));
      bones.shoulders.forEach((b, i) => rotate(b, 0, 0, Math.sin(t * 1.5 + i) * .025, 1));
      const continuous = /walk|full/.test(mode) ? strength : 0;
      bones.lArm.forEach(b => rotate(b, Math.sin(t * 2) * .28 * continuous, 0, -.06 * continuous, 1)); bones.rArm.forEach(b => rotate(b, Math.sin(t * 2 + Math.PI) * .28 * continuous, 0, .06 * continuous, 1));
      bones.lThigh.forEach(b => rotate(b, Math.sin(t * 2 + Math.PI) * .25 * continuous, 0, 0, 1)); bones.rThigh.forEach(b => rotate(b, Math.sin(t * 2) * .25 * continuous, 0, 0, 1));
      bones.lCalf.forEach(b => rotate(b, Math.max(0, Math.sin(t * 2 + Math.PI)) * .18 * continuous, 0, 0, 1)); bones.rCalf.forEach(b => rotate(b, Math.max(0, Math.sin(t * 2)) * .18 * continuous, 0, 0, 1));
      const pulse = /walk|full/.test(mode) ? strength : strength * Math.max(0, Math.sin(Math.min(1, (now - started) / 1200) * Math.PI));
      if (mode === 'wave') { bones.rArm.forEach(b => rotate(b, -.95, .15, -.55, pulse)); bones.rFore.forEach(b => rotate(b, -.70, 0, .20, pulse)); bones.rHand.forEach(b => rotate(b, 0, Math.sin(t * 8) * .5, .12, pulse)); }
      if (mode === 'point') { bones.rArm.forEach(b => rotate(b, -.48, -.18, -.34, pulse)); bones.rFore.forEach(b => rotate(b, -1.05, 0, .05, pulse)); }
      if (mode === 'present') { bones.rArm.forEach(b => rotate(b, -.38, -.34, -.30, pulse)); bones.lArm.forEach(b => rotate(b, -.38, .34, .30, pulse)); bones.rFore.forEach(b => rotate(b, -.3, 0, 0, pulse)); bones.lFore.forEach(b => rotate(b, -.3, 0, 0, pulse)); }
      if (mode === 'handshake') { bones.rArm.forEach(b => rotate(b, -.62, -.15, -.45, pulse)); bones.rFore.forEach(b => rotate(b, -.80, 0, .15 + Math.sin(t * 10) * .10, pulse)); bones.rHand.forEach(b => rotate(b, Math.sin(t * 10) * .08, 0, 0, pulse)); }
      if (mode === 'nod') { bones.head.forEach(b => rotate(b, Math.sin(t * 5) * .22, 0, 0, pulse)); bones.neck.forEach(b => rotate(b, Math.sin(t * 5) * .09, 0, 0, pulse)); }
      if (mode === 'shrug') bones.shoulders.forEach(b => rotate(b, Math.sin(t * 6) * .12, 0, Math.sin(t * 6) * .16, pulse));
      if (mode === 'laugh') { bones.head.forEach(b => rotate(b, Math.sin(t * 8) * .08, 0, Math.sin(t * 9) * .05, pulse)); bones.spine.forEach(b => rotate(b, Math.sin(t * 8) * .04, 0, 0, pulse)); setMouth(.75, .12); }
      if (mode === 'smile' || mode === 'happy') { bones.head.forEach(b => rotate(b, -.05, 0, 0, pulse)); }
      if (mode === 'eyes') bones.head.forEach(b => rotate(b, Math.sin(t * 3) * .06, Math.sin(t * 4) * .11, 0, pulse));
      if (strength > 0 && !/walk|full/.test(mode)) { strength = Math.max(0, strength - dt * .00045); if (strength === 0) mode = 'idle'; }
    };

    const command = (cmd: AvatarCommand) => {
      if (cmd.type === 'performance') { if (typeof cmd.value?.speaking === 'boolean') speaking = cmd.value.speaking; if (/happy|positive|excited|warm|success|confident/i.test(String(cmd.value?.emotion ?? ''))) micro?.triggerInsightSmileExpression(true); return; }
      if (cmd.type === 'expression') { const v = cmd.value.toLowerCase(); if (/smile|happy|warm|positive|success|confident/.test(v)) micro?.triggerInsightSmileExpression(true); if (/neutral|rest|stop/.test(v)) micro?.triggerInsightSmileExpression(false); return; }
      if (cmd.type === 'viseme') { setMouth(/silence|close|rest/i.test(cmd.value) ? 0 : Math.min(Number(cmd.weight ?? 0), .95), .35); return; }
      const v = cmd.value.toLowerCase(); started = performance.now();
      if (v === 'rotate') { spin = spin ? 0 : 1.8; return; }
      if (v === 'clothes') { model?.traverse(o => { if (o instanceof THREE.Mesh && o.material) { const mats = Array.isArray(o.material) ? o.material : [o.material]; mats.forEach(m => { if (m) { m.color.offsetHSL(.07, 0, 0); m.needsUpdate = true; } }); } }); return; }
      if (v === 'spatial') { rotation += Math.PI * .35; mode = 'full-body'; strength = 1; return; }
      if (v === 'smile' || v === 'laugh' || v === 'happy') micro?.triggerInsightSmileExpression(true);
      mode = /wave/.test(v) ? 'wave' : /point/.test(v) ? 'point' : /present|open-hand/.test(v) ? 'present' : /handshake/.test(v) ? 'handshake' : /nod/.test(v) ? 'nod' : /shrug/.test(v) ? 'shrug' : /walk/.test(v) ? 'walk' : /full-body/.test(v) ? 'full-body' : /laugh/.test(v) ? 'laugh' : /smile/.test(v) ? 'smile' : /happy/.test(v) ? 'happy' : /eyes/.test(v) ? 'eyes' : 'idle';
      strength = mode === 'idle' ? 0 : 1;
      if (/walk|full-body/.test(v)) play(findAction([/walk/i, /run/i, /move/i, /full/i])); else play(findAction([/gesture/i, /wave/i, /talk/i, /idle/i, /stand/i]));
    };

    statusRef.current?.('LOADING • NEERAJ FBX AVATAR');
    loader.load(SRC, (fbx) => {
      model = fbx; model.traverse(o => { if (o instanceof THREE.Mesh) { o.visible = true; o.frustumCulled = false; o.renderOrder = 2; } }); root.add(model);
      model.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(model); const center = box.getCenter(new THREE.Vector3()); const size = box.getSize(new THREE.Vector3()); const h = Math.max(size.y, .001); model.position.set(-center.x, -box.min.y, -center.z); camera.position.set(0, h * .46, Math.max(2, h * .60 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))); camera.lookAt(0, h * .46, 0);
      bones = detectBones(model); Object.values(bones).flat().forEach(b => bases.set(b, b.rotation.clone()));
      model.traverse(o => { if (!(o instanceof THREE.Mesh) || !o.morphTargetDictionary || !o.morphTargetInfluences) return; Object.entries(o.morphTargetDictionary).forEach(([n, index]) => { const x = norm(n); if (/mouthopen|jawopen|jawdrop|visemeaa|visemeo/.test(x)) morphs.push({ mesh: o, index }); }); });
      micro = createMicroExpressionEngine(model, { isSpeaking: () => speaking });
      mixer = fbx.animations?.length ? new THREE.AnimationMixer(model) : null; fbx.animations?.forEach(c => actions.set(c.name.toLowerCase(), mixer!.clipAction(c))); play(findAction([/idle/i, /stand/i, /breath/i, /rest/i]));
      apiRef.current?.({ command }); const groups = Object.values(bones).filter(g => g.length).length; statusRef.current?.(`ONLINE • ${groups} BODY GROUPS • AVATAR CONTROLS READY`);
    }, undefined, (e) => { console.error(e); statusRef.current?.('3D MODEL LOAD ERROR • CHECK /profile/avatar.fbx'); });

    const resize = () => { const w = Math.max(1, mount.clientWidth || 640), h = Math.max(1, mount.clientHeight || 640); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }; resize(); const ro = new ResizeObserver(resize); ro.observe(mount); const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => { const dt = Math.min(clock.getDelta(), .05), now = performance.now(), t = now / 1000; if (spin) rotation += spin * dt; root.rotation.y = THREE.MathUtils.damp(root.rotation.y, rotation + Math.sin(t * .22) * .02, 5, dt); mixer?.update(dt); motion(now, dt); if (speaking) setMouth(.45 + Math.max(0, Math.sin(t * 13)) * .4, .3); else setMouth(0, .1); micro?.update(now); renderer.render(scene, camera); });
    return () => { renderer.setAnimationLoop(null); ro.disconnect(); micro?.dispose(); mixer?.stopAllAction(); renderer.dispose(); layer.remove(); };
  }, []);
  return <div ref={mountRef} className="relative w-full h-full min-h-[500px]" />;
}
