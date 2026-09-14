import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

export type AvatarCommand =
  | { type: 'expression'; value: string }
  | { type: 'viseme'; value: string; weight?: number }
  | { type: 'gesture'; value: string }
  | { type: 'performance'; value: any };

type Props = { onStatus?: (status: string) => void; onApi?: (api: { command: (cmd: AvatarCommand) => void }) => void };
type BoneMap = Record<string, THREE.Bone[]>;
type Morph = { mesh: THREE.Mesh; index: number; name: string };

const SRC = `${import.meta.env.BASE_URL}rerun-avatar.fbx`;
const norm = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase();

function findBones(root: THREE.Object3D): BoneMap {
  const b: BoneMap = { head: [], neck: [], spine: [], lArm: [], rArm: [], lFore: [], rFore: [], lHand: [], rHand: [], lThigh: [], rThigh: [], lCalf: [], rCalf: [], jaw: [], lEye: [], rEye: [] };
  const left = (s: string) => /left|lft|(^|armature)l(arm|forearm|hand|thigh|calf|leg|eye)/.test(s);
  const right = (s: string) => /right|rgt|(^|armature)r(arm|forearm|hand|thigh|calf|leg|eye)/.test(s);
  root.traverse((o) => {
    if (!(o instanceof THREE.Bone)) return;
    const x = norm(o.name);
    if (/jaw|mandible|lowerface/.test(x)) b.jaw.push(o);
    else if (/forearm|lowerarm|elbow/.test(x)) left(x) ? b.lFore.push(o) : right(x) && b.rFore.push(o);
    else if (/upperarm|shoulder|arm/.test(x)) left(x) ? b.lArm.push(o) : right(x) && b.rArm.push(o);
    else if (/hand|wrist/.test(x)) left(x) ? b.lHand.push(o) : right(x) && b.rHand.push(o);
    else if (/thigh|upleg/.test(x)) left(x) ? b.lThigh.push(o) : right(x) && b.rThigh.push(o);
    else if (/calf|lowerleg|shin|knee/.test(x)) left(x) ? b.lCalf.push(o) : right(x) && b.rCalf.push(o);
    else if (/eye/.test(x)) left(x) ? b.lEye.push(o) : right(x) && b.rEye.push(o);
    else if (/head/.test(x) && !/end/.test(x)) b.head.push(o);
    else if (/neck/.test(x)) b.neck.push(o);
    else if (/spine|chest|abdomen|pelvis|hips/.test(x)) b.spine.push(o);
  });
  return b;
}

export default function AvatarEngine({ onStatus, onApi }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef(onStatus);
  const apiRef = useRef(onApi);
  useEffect(() => { statusRef.current = onStatus; apiRef.current = onApi; }, [onApi, onStatus]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    mount.style.cssText = 'position:relative;width:100%;height:100%;min-height:560px;overflow:hidden';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0, 0);
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;z-index:2;pointer-events:none';
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xd9f5ff, 0x10141b, 2.6));
    const key = new THREE.DirectionalLight(0xffffff, 3.2); key.position.set(3, 6, 5); scene.add(key);
    const fill = new THREE.DirectionalLight(0x9beeff, 1.8); fill.position.set(-4, 3, 4); scene.add(fill);

    const root = new THREE.Group(); scene.add(root);
    const loader = new FBXLoader();
    let model: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let activeAction: THREE.AnimationAction | null = null;
    let bones: BoneMap | null = null;
    let disposed = false;
    let gesture = 'idle';
    let gestureStarted = performance.now();
    let gestureDuration = 1200;
    let speaking = false;
    let targetMouth = 0;
    let mouth = 0;
    let targetRotation = 0;
    let expression = 'neutral';
    const morphs: Morph[] = [];
    const blinkMorphs: Morph[] = [];

    const setStatus = (s: string) => statusRef.current?.(s);
    const move = (group: THREE.Bone[], value: number, axis: 'x'|'y'|'z', speed = 14, dt = 1/60) => group.forEach((bone) => {
      if (axis === 'x') bone.rotation.x = THREE.MathUtils.damp(bone.rotation.x, value, speed, dt);
      if (axis === 'y') bone.rotation.y = THREE.MathUtils.damp(bone.rotation.y, value, speed, dt);
      if (axis === 'z') bone.rotation.z = THREE.MathUtils.damp(bone.rotation.z, value, speed, dt);
    });
    const setMorph = (items: Morph[], value: number, alpha = 0.35) => items.forEach(({ mesh, index }) => {
      if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(mesh.morphTargetInfluences[index] ?? 0, value, alpha);
    });

    const playNative = (patterns: RegExp[], loop: boolean, fallbackFirst = false) => {
      if (!mixer || !model) return false;
      const clip = model.animations.find((c) => patterns.some((p) => p.test(norm(c.name)))) ?? (fallbackFirst ? model.animations[0] : undefined);
      if (!clip) return false;
      const action = mixer.clipAction(clip);
      action.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
      action.clampWhenFinished = !loop;
      if (activeAction && activeAction !== action) activeAction.crossFadeTo(action, 0.2, true);
      action.play();
      activeAction = action;
      return true;
    };

    const runGesture = (raw: string) => {
      const v = raw.toLowerCase().replace(/_/g, '-');
      if (v === 'rotate') { targetRotation += Math.PI * 0.55; setStatus('3D AVATAR • ROTATING'); return; }
      if (v.includes('wave')) gesture = 'wave';
      else if (v.includes('point')) gesture = 'point';
      else if (v.includes('present') || v.includes('open-hand')) gesture = 'present';
      else if (v.includes('handshake')) gesture = 'handshake';
      else if (v.includes('nod')) gesture = 'nod';
      else if (v.includes('shrug')) gesture = 'shrug';
      else if (v.includes('laugh')) gesture = 'laugh';
      else if (v.includes('smile') || v.includes('happy')) gesture = 'smile';
      else if (v.includes('eyes')) gesture = 'eyes';
      else if (v.includes('walk')) gesture = 'walk';
      else gesture = 'idle';
      gestureStarted = performance.now();
      gestureDuration = gesture === 'walk' ? 900000 : gesture === 'handshake' ? 1800 : 1300;
      if (gesture === 'wave') playNative([/wave|greet|salute/], false);
      if (gesture === 'walk') playNative([/walk|locomotion|run/], true);
      if (gesture === 'handshake') playNative([/handshake|shake/], false);
      if (gesture === 'idle') playNative([/idle|stand|breath|rest|neutral/], true, true);
      setStatus(`3D AVATAR • ${gesture.toUpperCase()}`);
    };

    const command = (cmd: AvatarCommand) => {
      if (cmd.type === 'performance') {
        if (typeof cmd.value?.speaking === 'boolean') speaking = cmd.value.speaking;
        if (typeof cmd.value?.gesture === 'string') runGesture(cmd.value.gesture);
        if (typeof cmd.value?.emotion === 'string') expression = cmd.value.emotion.toLowerCase();
        return;
      }
      if (cmd.type === 'viseme') { targetMouth = /silence|close|rest/i.test(cmd.value) ? 0 : THREE.MathUtils.clamp(Number(cmd.weight ?? 0), 0, 1); return; }
      if (cmd.type === 'expression') {
        const v = cmd.value.toLowerCase();
        if (/speaking|talk/.test(v)) speaking = true;
        if (/neutral|rest|stop/.test(v)) { speaking = false; expression = 'neutral'; playNative([/idle|stand|breath|rest|neutral/], true, true); }
        if (/smile|happy|warm|positive|confident/.test(v)) expression = 'smile';
        if (/sad/.test(v)) expression = 'sad';
        return;
      }
      runGesture(cmd.value);
    };
    apiRef.current = { command };
    onApi?.({ command });

    loader.load(SRC, (loaded) => {
      if (disposed) return;
      model = loaded;
      root.add(loaded);
      loaded.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        o.frustumCulled = false;
        if (o.morphTargetDictionary && o.morphTargetInfluences) Object.entries(o.morphTargetDictionary).forEach(([name, index]) => {
          const item = { mesh: o, index, name };
          const x = norm(name);
          if (/mouth|viseme|phoneme|lip|tongue|jaw|aa|ah|ao|oh|uh/.test(x)) morphs.push(item);
          if (/blink|eyelid|eyeclose|closeeye|lidclose/.test(x)) blinkMorphs.push(item);
        });
      });
      bones = findBones(loaded);
      mixer = new THREE.AnimationMixer(loaded);
      loaded.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(loaded);
      const center = box.getCenter(new THREE.Vector3());
      const height = Math.max(box.getSize(new THREE.Vector3()).y, 1);
      loaded.position.set(-center.x, -box.min.y, -center.z);
      loaded.updateMatrixWorld(true);
      const finalHeight = Math.max(new THREE.Box3().setFromObject(loaded).getSize(new THREE.Vector3()).y, height);
      camera.position.set(0, finalHeight * 0.50, finalHeight * 1.78);
      camera.lookAt(0, finalHeight * 0.50, 0);
      camera.near = Math.max(0.01, finalHeight / 1000);
      camera.far = Math.max(100, finalHeight * 10);
      camera.updateProjectionMatrix();
      const nativeStarted = playNative([/idle|stand|breath|rest|neutral/], true, true);
      setStatus(`RERUN AVATAR READY • FULL BODY • ${loaded.animations.length} FBX CLIP${loaded.animations.length === 1 ? '' : 'S'} • ${nativeStarted ? 'NATIVE MOTION PLAYING' : 'NO NATIVE CLIP'}`);
    }, undefined, (err) => setStatus(`RERUN AVATAR LOAD ERROR • ${err instanceof Error ? err.message : 'CHECK rerun-avatar.fbx'}`));

    const resize = () => { const w = Math.max(1, mount.clientWidth), h = Math.max(1, mount.clientHeight); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(mount);
    let nextBlink = performance.now() + 2200;
    let blinkUntil = 0;
    const clock = new THREE.Clock();

    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.033);
      const now = performance.now();
      const t = now * 0.001;
      mixer?.update(dt);
      root.rotation.y = THREE.MathUtils.damp(root.rotation.y, targetRotation, 8, dt);
      if (now >= nextBlink && now > blinkUntil) { blinkUntil = now + 150; nextBlink = now + 2800 + Math.random() * 2800; }
      setMorph(blinkMorphs, now < blinkUntil ? 1 : 0, 0.55);
      mouth = THREE.MathUtils.damp(mouth, speaking ? Math.max(targetMouth, 0.16 + Math.abs(Math.sin(t * 8)) * 0.14) : targetMouth, 20, dt);
      setMorph(morphs, mouth, 0.48);
      if (bones?.jaw) move(bones.jaw, -mouth * 0.20, 'x', 18, dt);

      const elapsed = now - gestureStarted;
      const p = THREE.MathUtils.clamp(elapsed / gestureDuration, 0, 1);
      const wave = Math.sin(elapsed * 0.010);
      if (bones) {
        if (gesture === 'wave') {
          move(bones.rArm, -0.95, 'z', 18, dt); move(bones.rFore, -0.25 + wave * 0.38, 'y', 20, dt); move(bones.rHand, wave * 0.30, 'z', 20, dt);
        } else if (gesture === 'point') {
          move(bones.rArm, -0.58, 'z', 18, dt); move(bones.rFore, -0.72, 'x', 18, dt); move(bones.rHand, 0.18, 'z', 18, dt);
        } else if (gesture === 'present') {
          move(bones.lArm, -0.55, 'z', 16, dt); move(bones.rArm, 0.55, 'z', 16, dt); move(bones.lFore, -0.25, 'x', 16, dt); move(bones.rFore, -0.25, 'x', 16, dt);
        } else if (gesture === 'handshake') {
          move(bones.rArm, -0.70, 'z', 18, dt); move(bones.rFore, -0.85 + Math.sin(elapsed * 0.014) * 0.18, 'x', 20, dt);
        } else if (gesture === 'nod') {
          move(bones.head, Math.sin(elapsed * 0.012) * 0.22 * (p < 1 ? 1 : 0), 'x', 20, dt);
        } else if (gesture === 'shrug') {
          move(bones.lArm, -0.18, 'z', 16, dt); move(bones.rArm, 0.18, 'z', 16, dt);
        } else if (gesture === 'laugh') {
          move(bones.head, Math.sin(elapsed * 0.018) * 0.08, 'x', 12, dt); setMorph(morphs, 0.55 + Math.sin(elapsed * 0.015) * 0.18, 0.25);
        } else if (gesture === 'smile' || expression === 'smile') {
          setMorph(morphs, Math.max(mouth, 0.14), 0.18);
        } else if (gesture === 'eyes') {
          move(bones.lEye, Math.sin(t * 1.4) * 0.08, 'y', 10, dt); move(bones.rEye, Math.sin(t * 1.4) * 0.08, 'y', 10, dt);
        } else if (speaking) {
          move(bones.head, Math.sin(t * 2.2) * 0.025, 'y', 5, dt); move(bones.lArm, Math.sin(t * 2.4) * 0.04, 'z', 5, dt); move(bones.rArm, -Math.sin(t * 2.4) * 0.04, 'z', 5, dt);
        }
      }
      renderer.render(scene, camera);
      if (targetMouth > 0) targetMouth *= Math.pow(0.2, dt); else targetMouth = 0;
    });

    return () => { disposed = true; ro.disconnect(); renderer.setAnimationLoop(null); renderer.dispose(); if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement); apiRef.current = undefined; };
  }, []);

  return <div ref={mountRef} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 560, overflow: 'hidden' }} />;
}
