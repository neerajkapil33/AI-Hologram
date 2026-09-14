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
type Bones = {
  head: Group; neck: Group; spine: Group; shoulders: Group;
  lArm: Group; rArm: Group; lFore: Group; rFore: Group;
  lHand: Group; rHand: Group; lThigh: Group; rThigh: Group;
  lCalf: Group; rCalf: Group; jaw: Group; lEye: Group; rEye: Group;
};
type Morph = { mesh: THREE.Mesh; index: number };

const SRC = `${import.meta.env.BASE_URL}profile/avatar.fbx`;
const norm = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase();
const isLeft = (n: string) => /left|lft/.test(n) || /(^|armature)l(arm|forearm|hand|thigh|calf|leg|eye)/.test(n);
const isRight = (n: string) => /right|rgt/.test(n) || /(^|armature)r(arm|forearm|hand|thigh|calf|leg|eye)/.test(n);
const emptyBones = (): Bones => ({
  head: [], neck: [], spine: [], shoulders: [], lArm: [], rArm: [], lFore: [], rFore: [],
  lHand: [], rHand: [], lThigh: [], rThigh: [], lCalf: [], rCalf: [], jaw: [], lEye: [], rEye: [],
});

function detectBones(root: THREE.Object3D) {
  const b = emptyBones();
  root.traverse((o) => {
    if (!(o instanceof THREE.Bone)) return;
    const n = norm(o.name);
    if (/jaw|mandible|lowerface/.test(n)) b.jaw.push(o);
    else if (/head/.test(n) && !/end/.test(n)) b.head.push(o);
    else if (/neck/.test(n)) b.neck.push(o);
    else if (/spine|chest|abdomen|pelvis|hips/.test(n)) b.spine.push(o);
    else if (/shoulder|clavicle/.test(n)) b.shoulders.push(o);
    else if (/eyelid|lid/.test(n)) return;
    else if (/eye/.test(n)) isLeft(n) ? b.lEye.push(o) : isRight(n) && b.rEye.push(o);
    else if (/upperarm|arm/.test(n)) isLeft(n) ? b.lArm.push(o) : isRight(n) && b.rArm.push(o);
    else if (/forearm|lowerarm|elbow/.test(n)) isLeft(n) ? b.lFore.push(o) : isRight(n) && b.rFore.push(o);
    else if (/hand|wrist/.test(n)) isLeft(n) ? b.lHand.push(o) : isRight(n) && b.rHand.push(o);
    else if (/thigh|upleg/.test(n)) isLeft(n) ? b.lThigh.push(o) : isRight(n) && b.rThigh.push(o);
    else if (/calf|lowerleg|shin/.test(n)) isLeft(n) ? b.lCalf.push(o) : isRight(n) && b.rCalf.push(o);
  });
  return b;
}

const MOUTH_NAMES = /mouth|jaw|viseme|phoneme|lip|tongue|aa|ae|ah|ao|aw|eh|er|ih|iy|oh|ow|oy|uh|uw/i;
const BLINK_NAMES = /blink|eyelid|eyeclose|closeeye/i;

export default function AvatarEngine({ onStatus, onApi }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef(onStatus);
  const apiRef = useRef(onApi);

  useEffect(() => {
    statusRef.current = onStatus;
    apiRef.current = onApi;
  }, [onApi, onStatus]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0, 0);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:2;pointer-events:none';

    scene.add(new THREE.HemisphereLight(0xc7efff, 0x07111d, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(3, 6, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9beeff, 1.5);
    fill.position.set(-3, 3, 4);
    scene.add(fill);

    const root = new THREE.Group();
    scene.add(root);
    const loader = new FBXLoader();
    let model: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let micro: MicroExpressionEngine | null = null;
    let bones: Bones | null = null;
    let activeAction: THREE.AnimationAction | null = null;
    let idleAction: THREE.AnimationAction | null = null;
    let mode = 'idle';
    let gestureUntil = 0;
    let gestureStarted = 0;
    let rotation = 0;
    let spin = 0;
    let speaking = false;
    let mouthLevel = 0;
    let lastAudioAt = 0;
    let disposed = false;

    const bases = new Map<THREE.Object3D, THREE.Euler>();
    const actions = new Map<string, THREE.AnimationAction>();
    const morphs: Morph[] = [];
    const blinkMorphs: Morph[] = [];

    const rotate = (o: THREE.Object3D, x = 0, y = 0, z = 0, amount = 1, smoothing = 0.16) => {
      const base = bases.get(o);
      if (!base) return;
      o.rotation.x = THREE.MathUtils.lerp(o.rotation.x, base.x + x * amount, smoothing);
      o.rotation.y = THREE.MathUtils.lerp(o.rotation.y, base.y + y * amount, smoothing);
      o.rotation.z = THREE.MathUtils.lerp(o.rotation.z, base.z + z * amount, smoothing);
    };

    const setMouth = (value: number, alpha = 0.35) => {
      const v = THREE.MathUtils.clamp(value, 0, 1);
      morphs.forEach(({ mesh, index }) => {
        if (mesh.morphTargetInfluences) {
          mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(mesh.morphTargetInfluences[index] ?? 0, v, alpha);
        }
      });
      if (bones?.jaw.length) {
        bones.jaw.forEach((bone) => rotate(bone, -0.34 * v, 0, 0, 1, 0.32));
      }
    };

    const setBlink = (value: number) => {
      blinkMorphs.forEach(({ mesh, index }) => {
        if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(mesh.morphTargetInfluences[index] ?? 0, value, 0.5);
      });
    };

    const findAction = (patterns: RegExp[]) => [...actions.entries()].find(([name]) => patterns.some((p) => p.test(name)))?.[1] ?? null;

    const playAction = (action: THREE.AnimationAction | null, loop = THREE.LoopOnce) => {
      if (!action || action === activeAction) return;
      action.reset();
      action.setEffectiveWeight(1);
      action.setEffectiveTimeScale(1);
      action.setLoop(loop, loop === THREE.LoopOnce ? 1 : Infinity);
      action.clampWhenFinished = loop === THREE.LoopOnce;
      action.play();
      if (activeAction) activeAction.crossFadeTo(action, 0.28, true);
      activeAction = action;
    };

    const startGesture = (name: string, duration = 1500) => {
      mode = name;
      gestureStarted = performance.now();
      gestureUntil = gestureStarted + duration;
    };

    const motion = (now: number, dt: number) => {
      if (!bones) return;
      const t = now * 0.001;
      const active = now < gestureUntil;
      const progress = active ? THREE.MathUtils.clamp((now - gestureStarted) / Math.max(gestureUntil - gestureStarted, 1), 0, 1) : 1;
      const gesture = active ? Math.sin(progress * Math.PI) : 0;

      // Human-like idle: breathing, weight shift, head attention and relaxed shoulders.
      const breath = Math.sin(t * 1.55) * 0.022;
      const sway = Math.sin(t * 0.55) * 0.035 + Math.sin(t * 0.23) * 0.014;
      bones.spine.forEach((b, i) => rotate(b, breath + Math.sin(t * 0.9 + i) * 0.008, sway * (i === 0 ? 0.7 : 1), Math.sin(t * 0.65 + i) * 0.012));
      bones.shoulders.forEach((b, i) => rotate(b, breath * 0.8, 0, Math.sin(t * 1.1 + i) * 0.018));
      bones.head.forEach((b) => rotate(b, Math.sin(t * 0.73) * 0.035, Math.sin(t * 0.49) * 0.055, Math.sin(t * 0.61) * 0.018));
      bones.neck.forEach((b) => rotate(b, Math.sin(t * 0.73) * 0.012, Math.sin(t * 0.49) * 0.018, 0));

      if (speaking) {
        // The audio callback supplies the real amplitude. If it is unavailable, keep a subtle speech rhythm.
        const fallback = now - lastAudioAt > 180 ? 0.12 + (Math.sin(t * 9.5) * 0.5 + 0.5) * 0.24 : mouthLevel;
        setMouth(Math.max(mouthLevel, fallback), 0.32);
        bones.head.forEach((b) => rotate(b, Math.sin(t * 1.7) * 0.045, Math.sin(t * 1.15) * 0.055, 0));
      } else {
        mouthLevel = THREE.MathUtils.damp(mouthLevel, 0, 10, dt);
        setMouth(mouthLevel, 0.25);
      }

      // Natural eye focus: the eyes move more than the whole head.
      const gazeX = Math.sin(t * 0.71) * 0.13 + Math.sin(t * 0.19) * 0.05;
      const gazeY = Math.sin(t * 0.47) * 0.06;
      bones.lEye.forEach((b) => rotate(b, -gazeY, gazeX, 0));
      bones.rEye.forEach((b) => rotate(b, -gazeY, gazeX, 0));

      const walking = mode === 'walk' || mode === 'full-body';
      if (walking) {
        const speed = 3.0;
        const phase = t * speed;
        const stride = 0.48;
        bones.lThigh.forEach((b) => rotate(b, Math.sin(phase) * stride, 0, 0));
        bones.rThigh.forEach((b) => rotate(b, Math.sin(phase + Math.PI) * stride, 0, 0));
        bones.lCalf.forEach((b) => rotate(b, Math.max(0, Math.sin(phase + Math.PI)) * 0.42, 0, 0));
        bones.rCalf.forEach((b) => rotate(b, Math.max(0, Math.sin(phase)) * 0.42, 0, 0));
        bones.lArm.forEach((b) => rotate(b, Math.sin(phase + Math.PI) * 0.36, 0, -0.05));
        bones.rArm.forEach((b) => rotate(b, Math.sin(phase) * 0.36, 0, 0.05));
        bones.lFore.forEach((b) => rotate(b, 0.18 + Math.max(0, Math.sin(phase)) * 0.20, 0, 0));
        bones.rFore.forEach((b) => rotate(b, 0.18 + Math.max(0, Math.sin(phase + Math.PI)) * 0.20, 0, 0));
        bones.spine.forEach((b, i) => rotate(b, Math.sin(phase) * 0.045, sway * 1.2, Math.sin(phase + i) * 0.025));
      }

      const p = gesture;
      if (mode === 'wave') {
        bones.rArm.forEach((b) => rotate(b, -1.05, -0.18, -0.62, p));
        bones.rFore.forEach((b) => rotate(b, -0.72, 0, 0.24, p));
        bones.rHand.forEach((b) => rotate(b, 0, Math.sin(t * 7.5) * 0.5, Math.sin(t * 7.5) * 0.18, p));
      } else if (mode === 'point') {
        bones.rArm.forEach((b) => rotate(b, -0.72, -0.28, -0.48, p));
        bones.rFore.forEach((b) => rotate(b, -1.0, 0, 0.08, p));
      } else if (mode === 'present' || mode === 'open-hand') {
        bones.rArm.forEach((b) => rotate(b, -0.56, -0.38, -0.38, p));
        bones.lArm.forEach((b) => rotate(b, -0.56, 0.38, 0.38, p));
        bones.rFore.forEach((b) => rotate(b, -0.35, 0, 0, p));
        bones.lFore.forEach((b) => rotate(b, -0.35, 0, 0, p));
      } else if (mode === 'handshake') {
        bones.rArm.forEach((b) => rotate(b, -0.82, -0.2, -0.52, p));
        bones.rFore.forEach((b) => rotate(b, -0.82 + Math.sin(t * 9) * 0.10, 0, 0.12, p));
        bones.rHand.forEach((b) => rotate(b, Math.sin(t * 9) * 0.08, 0, 0, p));
      } else if (mode === 'nod') {
        const nod = Math.sin(progress * Math.PI * 4) * 0.18 * p;
        bones.head.forEach((b) => rotate(b, nod, 0, 0, 1, 0.24));
        bones.neck.forEach((b) => rotate(b, nod * 0.38, 0, 0, 1, 0.24));
      } else if (mode === 'shrug') {
        const shrug = Math.sin(progress * Math.PI) * 0.20;
        bones.shoulders.forEach((b, i) => rotate(b, -shrug, 0, (i % 2 ? -1 : 1) * shrug * 0.25));
      } else if (mode === 'laugh') {
        const laugh = Math.sin(t * 8) * 0.08 * p;
        bones.head.forEach((b) => rotate(b, laugh, 0, Math.sin(t * 7) * 0.045 * p));
        bones.spine.forEach((b) => rotate(b, laugh * 0.55, 0, 0));
        setMouth(0.72, 0.18);
      } else if (mode === 'smile' || mode === 'happy') {
        bones.head.forEach((b) => rotate(b, -0.035 * p, 0, 0.025 * p));
      } else if (mode === 'eyes') {
        bones.head.forEach((b) => rotate(b, 0, Math.sin(t * 2.2) * 0.10, 0));
        bones.lEye.forEach((b) => rotate(b, 0, Math.sin(t * 4.5) * 0.28, 0));
        bones.rEye.forEach((b) => rotate(b, 0, Math.sin(t * 4.5) * 0.28, 0));
      } else if (mode === 'talk') {
        bones.lArm.forEach((b) => rotate(b, -0.12 + Math.sin(t * 2.1) * 0.08, 0, 0.04));
        bones.rArm.forEach((b) => rotate(b, -0.12 + Math.sin(t * 2.1 + Math.PI) * 0.08, 0, -0.04));
      }

      if (!active && mode !== 'idle' && !walking) {
        mode = 'idle';
        playAction(idleAction, THREE.LoopRepeat);
      }
    };

    const command = (cmd: AvatarCommand) => {
      if (cmd.type === 'performance') {
        if (typeof cmd.value?.speaking === 'boolean') speaking = cmd.value.speaking;
        if (/happy|positive|excited|warm|success|confident/i.test(String(cmd.value?.emotion ?? ''))) micro?.triggerInsightSmileExpression(true);
        return;
      }
      if (cmd.type === 'expression') {
        const v = cmd.value.toLowerCase();
        if (v.includes('speaking')) { speaking = true; startGesture('talk', 900000); }
        if (/smile|happy|warm|positive|success|confident/.test(v)) micro?.triggerInsightSmileExpression(true);
        if (/neutral|rest|stop/.test(v)) { speaking = false; micro?.triggerInsightSmileExpression(false); startGesture('idle', 1); }
        return;
      }
      if (cmd.type === 'viseme') {
        const raw = Number(cmd.weight ?? 0);
        mouthLevel = /silence|close|rest/i.test(cmd.value) ? 0 : THREE.MathUtils.clamp(raw, 0, 1);
        lastAudioAt = performance.now();
        return;
      }

      const v = cmd.value.toLowerCase();
      if (v === 'rotate') { spin = spin ? 0 : 0.55; return; }
      if (v === 'clothes') {
        model?.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            const material = m as THREE.MeshStandardMaterial;
            if (material.color) material.color.offsetHSL(0.055, 0, 0);
            material.needsUpdate = true;
          });
        });
        return;
      }
      if (v === 'spatial') { rotation += Math.PI * 0.35; startGesture('full-body', 1700); return; }
      if (v === 'idle') { startGesture('idle', 1); playAction(idleAction, THREE.LoopRepeat); return; }

      const clip = v.includes('wave') ? findAction([/wave|greet/])
        : v.includes('walk') ? findAction([/walk|locomotion/])
        : v.includes('handshake') ? findAction([/handshake|shake/])
        : v.includes('talk') ? findAction([/talk|speak|conversation/])
        : null;
      if (clip) playAction(clip, v.includes('walk') ? THREE.LoopRepeat : THREE.LoopOnce);

      if (v.includes('wave')) startGesture('wave');
      else if (v.includes('point')) startGesture('point');
      else if (v.includes('present') || v.includes('open-hand')) startGesture('present');
      else if (v.includes('handshake')) startGesture('handshake', 1700);
      else if (v.includes('nod')) startGesture('nod', 1100);
      else if (v.includes('shrug')) startGesture('shrug', 1000);
      else if (v.includes('laugh')) startGesture('laugh', 1500);
      else if (v.includes('smile') || v.includes('happy')) startGesture('smile', 1200);
      else if (v.includes('eyes')) startGesture('eyes', 1600);
      else if (v.includes('talk')) { speaking = true; startGesture('talk', 900000); }
      else if (v.includes('full-body')) startGesture('full-body', 5000);
      else if (v.includes('walk')) startGesture('walk', 900000);
    };

    apiRef.current = { command };

    loader.load(SRC, (loaded) => {
      if (disposed) return;
      model = loaded;
      loaded.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.frustumCulled = false;
          if (o.morphTargetDictionary && o.morphTargetInfluences) {
            Object.entries(o.morphTargetDictionary).forEach(([name, index]) => {
              const item = { mesh: o, index };
              if (MOUTH_NAMES.test(name)) morphs.push(item);
              if (BLINK_NAMES.test(name)) blinkMorphs.push(item);
            });
          }
        }
        if (o instanceof THREE.Bone) bases.set(o, o.rotation.clone());
      });

      bones = detectBones(loaded);
      micro = createMicroExpressionEngine(loaded, { isSpeaking: () => speaking });
      mixer = new THREE.AnimationMixer(loaded);
      loaded.animations.forEach((clip) => actions.set(norm(clip.name), mixer!.clipAction(clip)));
      idleAction = findAction([/idle|stand|breath|rest/]);
      if (idleAction) playAction(idleAction, THREE.LoopRepeat);

      loaded.scale.setScalar(1);
      root.add(loaded);
      loaded.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(loaded);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const height = Math.max(size.y, 0.001);
      loaded.position.set(-center.x, -box.min.y, -center.z);
      loaded.updateMatrixWorld(true);
      const distance = height * 0.62 / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
      camera.position.set(0, height * 0.46, Math.max(2, distance));
      camera.lookAt(0, height * 0.47, 0);
      statusRef.current?.(`3D AVATAR READY • ${bones.head.length ? 'HEAD' : 'BODY'} • ${morphs.length ? 'LIPS' : 'JAW'} • ${blinkMorphs.length ? 'EYES' : 'EYE BONES'}`);
    }, undefined, (error) => {
      if (!disposed) statusRef.current?.(`AVATAR LOAD ERROR • ${error instanceof Error ? error.message : 'CHECK avatar.fbx'}`);
    });

    const resize = () => {
      const w = Math.max(1, mount.clientWidth);
      const h = Math.max(1, mount.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let blinkTimer = 0;
    const blink = () => {
      if (disposed) return;
      const start = performance.now();
      const step = () => {
        const p = (performance.now() - start) / 150;
        if (p <= 1) {
          setBlink(p < 0.5 ? p * 2 : 2 - p * 2);
          requestAnimationFrame(step);
        } else setBlink(0);
      };
      requestAnimationFrame(step);
      blinkTimer = window.setTimeout(blink, 2300 + Math.random() * 3600);
    };
    blinkTimer = window.setTimeout(blink, 1800);

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const now = performance.now();
      if (spin) rotation += spin * dt;
      root.rotation.y = THREE.MathUtils.damp(root.rotation.y, rotation + Math.sin(now * 0.00025) * 0.018, 4.5, dt);
      mixer?.update(dt);
      motion(now, dt);
      micro?.update(now);
      renderer.render(scene, camera);
    });

    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      window.clearTimeout(blinkTimer);
      micro?.dispose();
      mixer?.stopAllAction();
      model?.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      apiRef.current = null;
    };
  }, []);

  return <div ref={mountRef} className="relative w-full h-full min-h-[500px]" />;
}
