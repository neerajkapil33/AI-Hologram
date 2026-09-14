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
  lLid: Group; rLid: Group; lFingers: Group; rFingers: Group;
};
type Morph = { mesh: THREE.Mesh; index: number; name: string };

const SRC = `${import.meta.env.BASE_URL}profile/avatar.fbx`;
const norm = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase();
const isLeft = (n: string) => /left|lft/.test(n) || /(^|armature)l(arm|forearm|hand|thigh|calf|leg|eye|lid)/.test(n);
const isRight = (n: string) => /right|rgt/.test(n) || /(^|armature)r(arm|forearm|hand|thigh|calf|leg|eye|lid)/.test(n);
const emptyBones = (): Bones => ({
  head: [], neck: [], spine: [], shoulders: [], lArm: [], rArm: [], lFore: [], rFore: [],
  lHand: [], rHand: [], lThigh: [], rThigh: [], lCalf: [], rCalf: [], jaw: [], lEye: [], rEye: [],
  lLid: [], rLid: [], lFingers: [], rFingers: [],
});

function detectBones(root: THREE.Object3D) {
  const b = emptyBones();
  root.traverse((o) => {
    if (!(o instanceof THREE.Bone)) return;
    const n = norm(o.name);
    if (/jaw|mandible|lowerface/.test(n)) b.jaw.push(o);
    else if (/eyelid|lid|upperlid|lowerlid/.test(n)) isLeft(n) ? b.lLid.push(o) : isRight(n) && b.rLid.push(o);
    else if (/head/.test(n) && !/end/.test(n)) b.head.push(o);
    else if (/neck/.test(n)) b.neck.push(o);
    else if (/spine|chest|abdomen|pelvis|hips/.test(n)) b.spine.push(o);
    else if (/shoulder|clavicle/.test(n)) b.shoulders.push(o);
    else if (/eye/.test(n)) isLeft(n) ? b.lEye.push(o) : isRight(n) && b.rEye.push(o);
    else if (/upperarm|arm/.test(n)) isLeft(n) ? b.lArm.push(o) : isRight(n) && b.rArm.push(o);
    else if (/forearm|lowerarm|elbow/.test(n)) isLeft(n) ? b.lFore.push(o) : isRight(n) && b.rFore.push(o);
    else if (/hand|wrist/.test(n)) isLeft(n) ? b.lHand.push(o) : isRight(n) && b.rHand.push(o);
    else if (/thumb|index|middle|ring|pinky|finger/.test(n)) isLeft(n) ? b.lFingers.push(o) : isRight(n) && b.rFingers.push(o);
    else if (/thigh|upleg/.test(n)) isLeft(n) ? b.lThigh.push(o) : isRight(n) && b.rThigh.push(o);
    else if (/calf|lowerleg|shin/.test(n)) isLeft(n) ? b.lCalf.push(o) : isRight(n) && b.rCalf.push(o);
  });
  return b;
}

const MOUTH_NAMES = /mouth|viseme|phoneme|lip|tongue|jaw|aa|ae|ah|ao|aw|eh|er|ih|iy|oh|ow|oy|uh|uw/i;
const BLINK_NAMES = /blink|eyelid|eyeclose|closeeye|lidclose/i;
const SMILE_NAMES = /smile|happy|mouthsmile|grin/i;
const FROWN_NAMES = /frown|sad|mouthsad/i;

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
    let speaking = false;
    let mouthLevel = 0;
    let targetMouth = 0;
    let lastAudioAt = 0;
    let disposed = false;
    let walkDirection = 0;
    let expression = 'neutral';

    const actions = new Map<string, THREE.AnimationAction>();
    const morphs: Morph[] = [];
    const blinkMorphs: Morph[] = [];
    const smileMorphs: Morph[] = [];
    const frownMorphs: Morph[] = [];
    const additive = new Map<THREE.Object3D, THREE.Euler>();

    const addOffset = (o: THREE.Object3D, x = 0, y = 0, z = 0, weight = 1, smoothing = 0.18) => {
      const previous = additive.get(o) ?? new THREE.Euler();
      const target = new THREE.Euler(x * weight, y * weight, z * weight);
      previous.x = THREE.MathUtils.damp(previous.x, target.x, 9, smoothing);
      previous.y = THREE.MathUtils.damp(previous.y, target.y, 9, smoothing);
      previous.z = THREE.MathUtils.damp(previous.z, target.z, 9, smoothing);
      additive.set(o, previous);
      // Important: this is applied ON TOP of the native FBX pose after mixer.update().
      o.rotation.x += previous.x;
      o.rotation.y += previous.y;
      o.rotation.z += previous.z;
    };

    const applyAdditive = () => {
      additive.forEach((offset, object) => {
        object.rotation.x += offset.x;
        object.rotation.y += offset.y;
        object.rotation.z += offset.z;
      });
    };

    const setMorphs = (items: Morph[], value: number, alpha = 0.28) => {
      const v = THREE.MathUtils.clamp(value, 0, 1);
      items.forEach(({ mesh, index }) => {
        if (!mesh.morphTargetInfluences) return;
        mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(mesh.morphTargetInfluences[index] ?? 0, v, alpha);
      });
    };

    const setMouth = (value: number, alpha = 0.3) => {
      const v = THREE.MathUtils.clamp(value, 0, 1);
      // Keep mouth shapes expressive rather than forcing every morph to the same value.
      morphs.forEach(({ mesh, index, name }) => {
        if (!mesh.morphTargetInfluences) return;
        const n = norm(name);
        const shape = /jaw|open|aa|ah|ao|oh|uh/.test(n) ? v : /lip|mouth|viseme|phoneme/.test(n) ? v * 0.72 : v * 0.45;
        mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(mesh.morphTargetInfluences[index] ?? 0, shape, alpha);
      });
      bones?.jaw.forEach((bone) => addOffset(bone, -0.30 * v, 0, 0, 1, 0.12));
    };

    const setBlink = (value: number) => {
      setMorphs(blinkMorphs, value, 0.55);
      bones?.lLid.forEach((b) => addOffset(b, value * 0.18, 0, 0, 1, 0.08));
      bones?.rLid.forEach((b) => addOffset(b, value * 0.18, 0, 0, 1, 0.08));
    };

    const findAction = (patterns: RegExp[]) => [...actions.entries()].find(([name]) => patterns.some((p) => p.test(name)))?.[1] ?? null;

    const stopAction = (action: THREE.AnimationAction | null) => {
      if (!action) return;
      action.fadeOut(0.2);
    };

    const playAction = (action: THREE.AnimationAction | null, loop: THREE.AnimationActionLoopStyles = THREE.LoopOnce) => {
      if (!action || action === activeAction) return;
      action.reset();
      action.enabled = true;
      action.setEffectiveWeight(1);
      action.setEffectiveTimeScale(1);
      action.setLoop(loop, loop === THREE.LoopOnce ? 1 : Infinity);
      action.clampWhenFinished = loop === THREE.LoopOnce;
      if (activeAction) activeAction.crossFadeTo(action, 0.32, true);
      action.play();
      activeAction = action;
    };

    const playGestureClip = (patterns: RegExp[], fallback: string, duration = 1400) => {
      const clip = findAction(patterns);
      if (clip) {
        const loop = THREE.LoopOnce;
        playAction(clip, loop);
        const clipDuration = Math.max(0.6, clip.getClip().duration * 1000);
        gestureStarted = performance.now();
        gestureUntil = gestureStarted + Math.max(duration, clipDuration);
        mode = fallback;
        return true;
      }
      return false;
    };

    const startGesture = (name: string, duration = 1400) => {
      mode = name;
      gestureStarted = performance.now();
      gestureUntil = gestureStarted + duration;
    };

    const motion = (now: number, dt: number) => {
      if (!bones) return;
      const t = now * 0.001;
      const active = now < gestureUntil;
      const progress = active ? THREE.MathUtils.clamp((now - gestureStarted) / Math.max(gestureUntil - gestureStarted, 1), 0, 1) : 1;
      const pulse = active ? Math.sin(progress * Math.PI) : 0;

      // These are deliberately small additive offsets. Native FBX animation owns the body pose.
      const breath = Math.sin(t * 1.45) * 0.018;
      const sway = Math.sin(t * 0.52) * 0.022 + Math.sin(t * 0.21) * 0.009;
      const attentionX = Math.sin(t * 0.71) * 0.035;
      const attentionY = Math.sin(t * 0.43) * 0.055;

      bones.spine.forEach((b, i) => addOffset(b, breath * (0.8 - i * 0.08), sway * (0.65 + i * 0.05), Math.sin(t * 0.62 + i) * 0.006));
      bones.shoulders.forEach((b, i) => addOffset(b, breath * 0.35, 0, Math.sin(t * 1.05 + i) * 0.008));
      bones.neck.forEach((b) => addOffset(b, attentionX * 0.25, attentionY * 0.25, 0));
      bones.head.forEach((b) => addOffset(b, attentionX, attentionY, Math.sin(t * 0.57) * 0.012));

      // Eyes lead the head: tiny saccades plus a slow conversational gaze.
      const gazeX = Math.sin(t * 0.77) * 0.105 + Math.sin(t * 2.7) * 0.018;
      const gazeY = Math.sin(t * 0.48) * 0.052 + Math.sin(t * 3.1) * 0.012;
      bones.lEye.forEach((b) => addOffset(b, -gazeY, gazeX, 0));
      bones.rEye.forEach((b) => addOffset(b, -gazeY, gazeX, 0));

      if (speaking) {
        const fallback = now - lastAudioAt > 220 ? 0.10 + (Math.sin(t * 10.2) * 0.5 + 0.5) * 0.18 : targetMouth;
        mouthLevel = THREE.MathUtils.damp(mouthLevel, Math.max(targetMouth, fallback), 16, dt);
        setMouth(mouthLevel, 0.34);
        bones.head.forEach((b) => addOffset(b, Math.sin(t * 1.7) * 0.018, Math.sin(t * 1.13) * 0.026, 0));
      } else {
        mouthLevel = THREE.MathUtils.damp(mouthLevel, 0, 12, dt);
        setMouth(mouthLevel, 0.24);
      }

      if (expression === 'smile' || expression === 'happy') {
        setMorphs(smileMorphs, 0.7, 0.12);
        bones.head.forEach((b) => addOffset(b, -0.018, 0, 0.012));
      } else if (expression === 'sad') {
        setMorphs(frownMorphs, 0.55, 0.12);
      } else {
        setMorphs(smileMorphs, 0, 0.08);
        setMorphs(frownMorphs, 0, 0.08);
      }

      // Fallback body gestures are only used when a native FBX gesture clip is unavailable.
      if (mode === 'wave' && !activeAction?.getClip().name.toLowerCase().includes('wave')) {
        bones.rArm.forEach((b) => addOffset(b, -0.78 * pulse, -0.10 * pulse, -0.42 * pulse));
        bones.rFore.forEach((b) => addOffset(b, -0.58 * pulse, 0, 0.16 * pulse));
        bones.rHand.forEach((b) => addOffset(b, 0, Math.sin(t * 8.2) * 0.30 * pulse, Math.sin(t * 8.2) * 0.10 * pulse));
        bones.rFingers.forEach((b, i) => addOffset(b, 0, 0, (i % 2 ? 0.08 : -0.08) * pulse));
      } else if (mode === 'point' && !activeAction?.getClip().name.toLowerCase().includes('point')) {
        bones.rArm.forEach((b) => addOffset(b, -0.58 * pulse, -0.18 * pulse, -0.30 * pulse));
        bones.rFore.forEach((b) => addOffset(b, -0.72 * pulse, 0, 0.08 * pulse));
        bones.rFingers.forEach((b) => addOffset(b, -0.10 * pulse, 0, 0, iSafe(bones.rFingers.indexOf(b))));
      } else if (mode === 'present' || mode === 'open-hand') {
        bones.rArm.forEach((b) => addOffset(b, -0.42 * pulse, -0.22 * pulse, -0.26 * pulse));
        bones.lArm.forEach((b) => addOffset(b, -0.42 * pulse, 0.22 * pulse, 0.26 * pulse));
        bones.rFore.forEach((b) => addOffset(b, -0.24 * pulse, 0, 0));
        bones.lFore.forEach((b) => addOffset(b, -0.24 * pulse, 0, 0));
        bones.rFingers.forEach((b) => addOffset(b, 0, 0, 0.10 * pulse));
        bones.lFingers.forEach((b) => addOffset(b, 0, 0, -0.10 * pulse));
      } else if (mode === 'handshake') {
        bones.rArm.forEach((b) => addOffset(b, -0.58 * pulse, -0.16 * pulse, -0.32 * pulse));
        bones.rFore.forEach((b) => addOffset(b, -0.56 * pulse + Math.sin(t * 9) * 0.05 * pulse, 0, 0.08 * pulse));
        bones.rHand.forEach((b) => addOffset(b, Math.sin(t * 9) * 0.04 * pulse, 0, 0));
      } else if (mode === 'nod') {
        const nod = Math.sin(progress * Math.PI * 4) * 0.12 * pulse;
        bones.head.forEach((b) => addOffset(b, nod, 0, 0));
        bones.neck.forEach((b) => addOffset(b, nod * 0.35, 0, 0));
      } else if (mode === 'shrug') {
        const shrug = Math.sin(progress * Math.PI) * 0.11;
        bones.shoulders.forEach((b, i) => addOffset(b, -shrug, 0, (i % 2 ? -1 : 1) * shrug * 0.18));
      } else if (mode === 'laugh') {
        const laugh = Math.sin(t * 8) * 0.045 * pulse;
        bones.head.forEach((b) => addOffset(b, laugh, 0, Math.sin(t * 7) * 0.025 * pulse));
        setMouth(0.78, 0.18);
      } else if (mode === 'talk') {
        bones.lArm.forEach((b) => addOffset(b, Math.sin(t * 2.0) * 0.035, 0, 0.018));
        bones.rArm.forEach((b) => addOffset(b, Math.sin(t * 2.0 + Math.PI) * 0.035, 0, -0.018));
      }

      if (mode === 'walk' || mode === 'full-body') {
        // Native walk clip controls the limbs. Root translation supplies actual forward/back travel.
        const travel = walkDirection * dt * 0.52;
        root.position.z += travel;
        const bob = Math.sin(t * 5.2) * 0.008;
        bones.head.forEach((b) => addOffset(b, bob, 0, 0));
      }

      if (!active && mode !== 'idle' && mode !== 'walk' && mode !== 'full-body' && !speaking) {
        mode = 'idle';
        if (idleAction) playAction(idleAction, THREE.LoopRepeat);
      }
    };

    // Helper kept tiny so gesture finger offsets remain deterministic.
    const iSafe = (i: number) => i % 3 === 0 ? 0.9 : 0.35;

    const command = (cmd: AvatarCommand) => {
      if (cmd.type === 'performance') {
        if (typeof cmd.value?.speaking === 'boolean') speaking = cmd.value.speaking;
        const e = String(cmd.value?.emotion ?? '').toLowerCase();
        if (/happy|positive|excited|warm|success|confident/.test(e)) expression = 'happy';
        if (/sad|negative/.test(e)) expression = 'sad';
        micro?.triggerInsightSmileExpression(/happy|positive|excited|warm|success|confident/.test(e));
        return;
      }

      if (cmd.type === 'expression') {
        const v = cmd.value.toLowerCase();
        if (v.includes('speaking')) {
          speaking = true;
          mode = 'talk';
          gestureUntil = performance.now() + 900000;
        }
        if (/smile|happy|warm|positive|success|confident/.test(v)) {
          expression = 'smile';
          micro?.triggerInsightSmileExpression(true);
        } else if (/sad|frown|negative/.test(v)) expression = 'sad';
        if (/neutral|rest|stop/.test(v)) {
          speaking = false;
          expression = 'neutral';
          micro?.triggerInsightSmileExpression(false);
          startGesture('idle', 1);
          if (idleAction) playAction(idleAction, THREE.LoopRepeat);
        }
        return;
      }

      if (cmd.type === 'viseme') {
        const raw = Number(cmd.weight ?? 0);
        targetMouth = /silence|close|rest/i.test(cmd.value) ? 0 : THREE.MathUtils.clamp(raw, 0, 1);
        lastAudioAt = performance.now();
        return;
      }

      const v = cmd.value.toLowerCase().trim();
      if (v === 'rotate') {
        rotation += Math.PI * 0.35;
        return;
      }
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
      if (v === 'spatial') {
        rotation += Math.PI * 0.35;
        startGesture('full-body', 1700);
        return;
      }
      if (v === 'idle') {
        speaking = false;
        walkDirection = 0;
        startGesture('idle', 1);
        if (idleAction) playAction(idleAction, THREE.LoopRepeat);
        return;
      }

      if (v === 'walk-forward' || v === 'walk forward') {
        walkDirection = -1;
        const clip = findAction([/walk|locomotion|forward/]);
        if (clip) playAction(clip, THREE.LoopRepeat);
        startGesture('walk', 900000);
        return;
      }
      if (v === 'walk-backward' || v === 'walk backward' || v === 'walk-back') {
        walkDirection = 1;
        const clip = findAction([/walk|locomotion|backward|back/]);
        if (clip) {
          playAction(clip, THREE.LoopRepeat);
          clip.setEffectiveTimeScale(-1);
        }
        startGesture('walk', 900000);
        return;
      }

      let usedNative = false;
      if (v.includes('wave')) usedNative = playGestureClip([/wave|greet|salute/], 'wave', 1400);
      else if (v.includes('handshake')) usedNative = playGestureClip([/handshake|shake|greeting/], 'handshake', 1700);
      else if (v.includes('point')) usedNative = playGestureClip([/point|indicate/], 'point', 1300);
      else if (v.includes('nod')) usedNative = playGestureClip([/nod|yes/], 'nod', 1000);
      else if (v.includes('shrug')) usedNative = playGestureClip([/shrug/], 'shrug', 1000);
      else if (v.includes('laugh')) usedNative = playGestureClip([/laugh|laughing/], 'laugh', 1400);
      else if (v.includes('talk')) usedNative = playGestureClip([/talk|speak|conversation/], 'talk', 900000);

      if (v.includes('wave')) startGesture('wave', usedNative ? 1500 : 1300);
      else if (v.includes('point')) startGesture('point', usedNative ? 1400 : 1200);
      else if (v.includes('present') || v.includes('open-hand')) startGesture('present', 1200);
      else if (v.includes('handshake')) startGesture('handshake', usedNative ? 1800 : 1600);
      else if (v.includes('nod')) startGesture('nod', usedNative ? 1200 : 1000);
      else if (v.includes('shrug')) startGesture('shrug', usedNative ? 1200 : 1000);
      else if (v.includes('laugh')) startGesture('laugh', usedNative ? 1500 : 1300);
      else if (v.includes('smile') || v.includes('happy')) { expression = 'smile'; startGesture('smile', 1200); }
      else if (v.includes('eyes')) startGesture('eyes', 1600);
      else if (v.includes('talk')) { speaking = true; startGesture('talk', 900000); }
      else if (v.includes('full-body')) startGesture('full-body', 5000);
      else if (v.includes('walk')) { walkDirection = -1; startGesture('walk', 900000); }
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
              const item = { mesh: o, index, name };
              if (MOUTH_NAMES.test(name)) morphs.push(item);
              if (BLINK_NAMES.test(name)) blinkMorphs.push(item);
              if (SMILE_NAMES.test(name)) smileMorphs.push(item);
              if (FROWN_NAMES.test(name)) frownMorphs.push(item);
            });
          }
        }
      });

      bones = detectBones(loaded);
      micro = createMicroExpressionEngine(loaded, { isSpeaking: () => speaking });
      mixer = new THREE.AnimationMixer(loaded);
      loaded.animations.forEach((clip) => actions.set(norm(clip.name), mixer!.clipAction(clip)));
      idleAction = findAction([/idle|stand|breath|rest|neutral/]);
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

      const nativeNames = [...actions.keys()].join(', ');
      statusRef.current?.(`3D AVATAR READY • ${bones.head.length ? 'HEAD' : 'BODY'} • ${morphs.length ? 'LIPS' : bones.jaw.length ? 'JAW' : 'MOUTH'} • ${bones.lEye.length || blinkMorphs.length ? 'EYES' : 'NO EYE RIG'} • ${nativeNames ? `${actions.size} FBX ANIMS` : 'PROCEDURAL MOTION'}`);
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
        const p = (performance.now() - start) / 155;
        if (p <= 1) {
          setBlink(p < 0.45 ? p / 0.45 : 1 - (p - 0.45) / 0.55);
          requestAnimationFrame(step);
        } else {
          setBlink(0);
          blinkTimer = window.setTimeout(blink, 2200 + Math.random() * 3800);
        }
      };
      requestAnimationFrame(step);
    };
    blinkTimer = window.setTimeout(blink, 1700);

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const now = performance.now();
      mixer?.update(dt);
      // Reset per-frame additive accumulator, then calculate a fresh layer on top of the FBX pose.
      additive.clear();
      motion(now, dt);
      applyAdditive();
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
