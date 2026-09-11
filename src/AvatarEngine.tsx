import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import createMicroExpressionEngine, { type MicroExpressionEngine } from './idle-behavior';

export type AvatarCommand =
  | { type: 'expression'; value: string }
  | { type: 'viseme'; value: string; weight?: number }
  | { type: 'gesture'; value: string }
  | { type: 'performance'; value: any };
type AvatarApi = { command: (cmd: AvatarCommand) => void };
type Props = { onStatus?: (s: string) => void; onApi?: (api: AvatarApi) => void };
type MouthTarget = { mesh: THREE.Mesh; index: number };
type LoadedAvatar = { scene: THREE.Object3D; animations: THREE.AnimationClip[] };
const AVATAR_SOURCE = `${import.meta.env.BASE_URL}avatar/avatar.glb`;
const AVATAR_FALLBACK_SOURCE = `${import.meta.env.BASE_URL}profile/scene.gltf`;
const VISEME_MAP: Record<'mouthOpen' | 'jawOpen', string[]> = {
  mouthOpen: ['mouthOpen', 'mouth_open', 'Mouth_Open', 'openMouth', 'shapes.mouth_O', 'mb_lab_mouth_open', 'viseme_aa', 'viseme_AA', 'viseme_O_M'],
  jawOpen: ['jawOpen', 'jaw_open', 'Jaw_Open', 'jawDrop', 'Jaw_Lower', 'mb_lab_jaw_v', 'viseme_Jaw_Drop'],
};
const normalizeMorphName = (name: string) => name.replace(/[\s_.-]+/g, '').toLowerCase();
const morphMatches = (name: string, aliases: string[]) => { const value = normalizeMorphName(name); return aliases.some((alias) => { const a = normalizeMorphName(alias); return value === a || value.includes(a) || a.includes(value); }); };
const sharedLoads = new Map<string, Promise<LoadedAvatar>>();
const loadAvatarOnce = (url: string) => { const existing = sharedLoads.get(url); if (existing) return existing; const promise = new Promise<LoadedAvatar>((resolve, reject) => new GLTFLoader().load(url, (gltf) => resolve({ scene: gltf.scene, animations: gltf.animations ?? [] }), undefined, reject)); sharedLoads.set(url, promise); return promise; };

export default function AvatarEngine({ onStatus, onApi }: Props) {
  const mountRef = useRef<HTMLDivElement>(null); const statusRef = useRef(onStatus); const apiRef = useRef(onApi);
  useEffect(() => { statusRef.current = onStatus; apiRef.current = onApi; }, [onApi, onStatus]);

  // Authoritative rig handles and resting-pose caches requested for the production avatar.
  const jointHeadRef = useRef<THREE.Object3D | null>(null);
  const jointNeckRef = useRef<THREE.Object3D | null>(null);
  const jointChestRef = useRef<THREE.Object3D | null>(null);
  const jointHipsRef = useRef<THREE.Object3D | null>(null);
  const baseHipsPos = useRef(new THREE.Vector3());
  const baseChestRot = useRef(new THREE.Vector3());
  const baseSpineRot = useRef(new THREE.Vector3());

  useEffect(() => {
    const mount = mountRef.current; if (!mount) return;
    let disposed = false;
    const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2(0x020710, 0.035);
    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100); camera.position.set(0, 0.75, 2.35);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; renderer.setClearColor(0x000000, 0);
    const canvasContainer = document.createElement('div'); canvasContainer.className = 'absolute inset-0 z-0 w-full h-full'; canvasContainer.style.cssText = 'position:absolute;inset:0;z-index:0;width:100%;height:100%;'; mount.appendChild(canvasContainer); canvasContainer.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0x0f2042, 1.8)); const keyCyanLight = new THREE.DirectionalLight(0x8fe9ff, 2.45); keyCyanLight.position.set(3, 5, 3); scene.add(keyCyanLight); const fill = new THREE.DirectionalLight(0xffffff, 1.1); fill.position.set(-2, 2.5, 4); scene.add(fill);
    const stage = new THREE.Group(); scene.add(stage);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.28, 96), new THREE.MeshBasicMaterial({ color: 0x061722, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.01; stage.add(floor);
    const grid = new THREE.GridHelper(6, 24, 0x06b6d4, 0x111e36); grid.position.y = 0.015; const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]; gridMaterials.forEach((m) => { m.transparent = true; m.opacity = 0.12; }); stage.add(grid);
    const innerRing = new THREE.Mesh(new THREE.RingGeometry(0.82, 0.845, 128), new THREE.MeshBasicMaterial({ color: 0x45e6ff, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })); innerRing.rotation.x = -Math.PI / 2; innerRing.position.y = 0.025; stage.add(innerRing);
    const outerRing = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.065, 128), new THREE.MeshBasicMaterial({ color: 0x31cfff, transparent: true, opacity: 0.26, side: THREE.DoubleSide, depthWrite: false })); outerRing.rotation.x = -Math.PI / 2; outerRing.position.y = 0.028; stage.add(outerRing);
    const avatarRoot = new THREE.Group(); stage.add(avatarRoot);
    let model: THREE.Object3D | null = null; let mixer: THREE.AnimationMixer | null = null; let microExpressions: MicroExpressionEngine | null = null; const actions = new Map<string, THREE.AnimationAction>(); let activeAction: THREE.AnimationAction | null = null; let targetRotation = 0; let mouthTargets: MouthTarget[] = []; let jawTargets: MouthTarget[] = []; let speaking = false; let intensity = 0.2;

    const findTargetMorphs = (root: THREE.Object3D, standardKey: 'mouthOpen' | 'jawOpen') => { const aliases = VISEME_MAP[standardKey]; const targets: MouthTarget[] = []; root.traverse((obj) => { if (!(obj instanceof THREE.Mesh) || !obj.morphTargetDictionary || !obj.morphTargetInfluences) return; Object.entries(obj.morphTargetDictionary).forEach(([name, index]) => { if (morphMatches(name, aliases)) targets.push({ mesh: obj, index }); }); }); return targets; };
    const setTargets = (targets: MouthTarget[], weight: number, alpha = 0.22) => targets.forEach(({ mesh, index }) => { if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(mesh.morphTargetInfluences[index] ?? 0, weight, alpha); });
    const resetTargets = (targets: MouthTarget[]) => targets.forEach(({ mesh, index }) => { if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[index] = 0; });
    const frameModel = (root: THREE.Object3D) => { root.scale.setScalar(1); root.position.set(0, 0, 0); root.updateMatrixWorld(true); const rawBox = new THREE.Box3().setFromObject(root); const rawHeight = Math.max(rawBox.getSize(new THREE.Vector3()).y, 0.001); root.scale.setScalar(Math.min(1.48 / rawHeight, 1)); root.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(root); const center = box.getCenter(new THREE.Vector3()); const size = box.getSize(new THREE.Vector3()); root.position.set(-center.x, -box.min.y, -center.z); root.updateMatrixWorld(true); const distance = (size.y * 0.54) / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)); camera.position.set(0, size.y * 0.46, Math.max(2.05, distance * 1.16)); camera.lookAt(0, size.y * 0.46, 0); camera.updateProjectionMatrix(); };
    const findAction = (patterns: RegExp[]) => [...actions.entries()].find(([name]) => patterns.some((pattern) => pattern.test(name)))?.[1] ?? null;
    const crossfade = (action: THREE.AnimationAction | null, duration = 0.45) => { if (!action || action === activeAction) return; action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play(); activeAction?.crossFadeTo(action, duration, true); activeAction = action; };

    // Explicit behavior state machine from the implementation blueprint.
    let blinkTimeCounter = Math.random() * 4 + 2;
    let currentBlinkInfluence = 0;
    let blinkStatePhase = 0;
    let avatarMeshTarget: THREE.Object3D | null = null;
    let audioIntensity = 0.2;
    const runAvatarBehaviorPipeline = (elapsedSeconds: number, deltaSeconds: number, currentAudioIntensity: number) => {
      if (!avatarMeshTarget) return;
      const speakingStateActive = currentAudioIntensity > 0.05 || speaking;
      if (blinkStatePhase === 0) { blinkTimeCounter -= deltaSeconds; if (blinkTimeCounter <= 0) blinkStatePhase = 1; }
      else if (blinkStatePhase === 1) { currentBlinkInfluence += deltaSeconds * 14; if (currentBlinkInfluence >= 1) { currentBlinkInfluence = 1; blinkStatePhase = 2; } }
      else { currentBlinkInfluence -= deltaSeconds * 9; if (currentBlinkInfluence <= 0) { currentBlinkInfluence = 0; blinkStatePhase = 0; blinkTimeCounter = Math.random() * 4 + 2; } }
      const respirationSpeed = elapsedSeconds * 1.6;
      const breatheWeight = Math.sin(respirationSpeed) * (speakingStateActive ? 0.003 : 0.012);
      if (jointChestRef.current) jointChestRef.current.rotation.x = THREE.MathUtils.lerp(jointChestRef.current.rotation.x, baseChestRot.current.x - breatheWeight, 0.1);
      if (jointHeadRef.current && !speakingStateActive) { const driftTimeline = elapsedSeconds * 0.8; jointHeadRef.current.rotation.y = THREE.MathUtils.lerp(jointHeadRef.current.rotation.y, baseChestRot.current.y + Math.sin(driftTimeline) * 0.04, 0.1); jointHeadRef.current.rotation.x = THREE.MathUtils.lerp(jointHeadRef.current.rotation.x, baseChestRot.current.x + Math.cos(driftTimeline * 0.5) * 0.02, 0.1); }
      if (jointHipsRef.current && speakingStateActive) { const shiftScale = Math.sin(elapsedSeconds * 2) * 0.015 * currentAudioIntensity; jointHipsRef.current.position.x = baseHipsPos.current.x + shiftScale; } else if (jointHipsRef.current) jointHipsRef.current.position.x = THREE.MathUtils.lerp(jointHipsRef.current.position.x, baseHipsPos.current.x, 0.12);
      avatarMeshTarget.traverse((child) => {
        if (!(child instanceof THREE.Mesh) || !child.morphTargetInfluences || !child.morphTargetDictionary) return;
        const leftBlink = child.morphTargetDictionary['eyeBlinkLeft'] ?? child.morphTargetDictionary['EyeBlinkLeft'];
        const rightBlink = child.morphTargetDictionary['eyeBlinkRight'] ?? child.morphTargetDictionary['EyeBlinkRight'];
        const jawOpen = child.morphTargetDictionary['jawOpen'] ?? child.morphTargetDictionary['JawOpen'];
        const mouthOpen = child.morphTargetDictionary['mouthOpen'] ?? child.morphTargetDictionary['MouthOpen'];
        if (leftBlink !== undefined) child.morphTargetInfluences[leftBlink] = currentBlinkInfluence;
        if (rightBlink !== undefined) child.morphTargetInfluences[rightBlink] = currentBlinkInfluence;
        if (jawOpen !== undefined) child.morphTargetInfluences[jawOpen] = THREE.MathUtils.lerp(child.morphTargetInfluences[jawOpen], Math.min(currentAudioIntensity * 1.8, 0.85), 0.25);
        if (mouthOpen !== undefined && jawOpen === undefined) child.morphTargetInfluences[mouthOpen] = THREE.MathUtils.lerp(child.morphTargetInfluences[mouthOpen], Math.min(currentAudioIntensity, 0.85), 0.2);
      });
    };

    const prepareModel = (loaded: LoadedAvatar, source: string) => {
      if (disposed) return;
      model = loaded.scene; avatarMeshTarget = model;
      jointHeadRef.current = null; jointNeckRef.current = null; jointChestRef.current = null; jointHipsRef.current = null;
      const morphDiagnostics: string[] = [];
      model.traverse((obj: any) => {
        if (obj.isBone) {
          const boneName = String(obj.name || '').toLowerCase();
          if (boneName === 'head') jointHeadRef.current = obj;
          if (boneName === 'neck') jointNeckRef.current = obj;
          if (boneName === 'spine2') { jointChestRef.current = obj; baseChestRot.current.set(obj.rotation.x, obj.rotation.y, obj.rotation.z); }
          if (boneName === 'hips') { jointHipsRef.current = obj; baseHipsPos.current.set(obj.position.x, obj.position.y, obj.position.z); }
          if (boneName === 'spine') baseSpineRot.current.set(obj.rotation.x, obj.rotation.y, obj.rotation.z);
          console.info('[BONE DIAGNOSTIC] Bone:', obj.name);
        }
        if (!(obj instanceof THREE.Mesh)) return;
        obj.visible = true; obj.renderOrder = 2;
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material]; materials.forEach((material: any) => { if (material) { material.visible = true; material.needsUpdate = true; } });
        if (obj.morphTargetDictionary) { const keys = Object.keys(obj.morphTargetDictionary); morphDiagnostics.push(`${obj.name || 'unnamed'}: ${keys.join(', ')}`); console.info(`[MESH DIAGNOSTIC] Target keys found for ${obj.name || 'unnamed'}:`, keys); }
      });
      const getRigName = (joint: THREE.Object3D | null) => joint?.name;
      console.info('[AVATAR DIAGNOSTIC] Loaded source:', source, 'animations:', loaded.animations.map((clip) => clip.name));
      console.info('[RIG DIAGNOSTIC] head:', getRigName(jointHeadRef.current), 'neck:', getRigName(jointNeckRef.current), 'chest:', getRigName(jointChestRef.current), 'hips:', getRigName(jointHipsRef.current), 'spine baseline:', baseSpineRot.current.toArray());
      avatarRoot.add(model); frameModel(model); mouthTargets = findTargetMorphs(model, 'mouthOpen'); jawTargets = findTargetMorphs(model, 'jawOpen'); microExpressions = createMicroExpressionEngine(model, { isSpeaking: () => speaking });
      if (loaded.animations.length) { mixer = new THREE.AnimationMixer(model); loaded.animations.forEach((clip) => actions.set(clip.name.toLowerCase(), mixer!.clipAction(clip))); console.info('[ANIMATION DIAGNOSTIC] Clip names:', [...actions.keys()]); crossfade(findAction([/idle/i, /breath/i, /stand/i, /rest/i, /standing/i]) ?? [...actions.values()][0], 0); }
      const sourceLabel = source === AVATAR_SOURCE ? 'REAL NEERAJ 3D READY' : 'GLTF FALLBACK READY';
      statusRef.current?.(`ONLINE • ${sourceLabel}${loaded.animations.length ? ` • ${loaded.animations.length} ANIMATION${loaded.animations.length > 1 ? 'S' : ''}` : ''}${mouthTargets.length || jawTargets.length ? ' • FACIAL VISEMES READY' : ''} • ORGANIC BLINK + GAZE READY • BREATH + SPEAKING WEIGHT READY`);
      if (morphDiagnostics.length) console.info('[AVATAR DIAGNOSTIC] Morph meshes:', morphDiagnostics);
      const boundingBox = new THREE.Box3().setFromObject(model); const modelCenter = boundingBox.getCenter(new THREE.Vector3());
      model.position.x += model.position.x - modelCenter.x;
      console.info('[AVATAR DIAGNOSTIC] Bounds:', boundingBox.getSize(new THREE.Vector3()), 'center:', modelCenter, 'mouthTargets:', mouthTargets.length, 'jawTargets:', jawTargets.length);
    };

    statusRef.current?.('LOADING • REAL NEERAJ 3D MODEL');
    loadAvatarOnce(AVATAR_SOURCE).then((loaded) => prepareModel(loaded, AVATAR_SOURCE)).catch((error) => {
      if (disposed) return;
      console.error('Neeraj production GLB load error', error); statusRef.current?.('PRODUCTION GLB LOAD ERROR • TRYING GLTF SOURCE');
      loadAvatarOnce(AVATAR_FALLBACK_SOURCE).then((loaded) => prepareModel(loaded, AVATAR_FALLBACK_SOURCE)).catch((fallbackError) => { if (!disposed) { console.error('Neeraj GLTF fallback load error', fallbackError); statusRef.current?.('3D MODEL LOAD ERROR • CHECK /avatar/avatar.glb'); } });
    });

    const command = (cmd: AvatarCommand) => {
      if (cmd.type === 'performance') { intensity = THREE.MathUtils.clamp(Number(cmd.value?.intensity ?? cmd.value?.amplitude ?? intensity), 0, 1); audioIntensity = intensity; if (typeof cmd.value?.speaking === 'boolean') speaking = cmd.value.speaking; const emotion = String(cmd.value?.emotion ?? '').toLowerCase(); if (/happy|positive|excited|warm|insight|success/.test(emotion)) microExpressions?.triggerInsightSmileExpression(true); }
      else if (cmd.type === 'expression') { const value = cmd.value.toLowerCase(); if (/smile|positive|happy|warm|insight|success|confident|encourag/.test(value)) microExpressions?.triggerInsightSmileExpression(true); else if (/neutral|stop|rest/.test(value)) microExpressions?.triggerInsightSmileExpression(false); }
      else if (cmd.type === 'gesture') { const value = cmd.value.toLowerCase(); targetRotation = value.includes('left') ? -0.08 : value.includes('right') ? 0.08 : 0; if (/run|walk|move/.test(value)) crossfade(findAction([/run/i, /walk/i, /move/i])); else crossfade(findAction([/idle/i, /breath/i, /stand/i, /rest/i, /standing/i])); }
      else if (cmd.type === 'viseme') { const weight = THREE.MathUtils.clamp(Number(cmd.weight ?? 0), 0, 1); audioIntensity = Math.max(audioIntensity * 0.7, weight); if (/jaw/i.test(cmd.value)) setTargets(jawTargets, Math.min(weight * 0.5, 0.45), 0.3); else setTargets(mouthTargets, Math.min(weight, 0.85), 0.3); if (/silence|close|rest/i.test(cmd.value)) { resetTargets(mouthTargets); resetTargets(jawTargets); audioIntensity = 0; } }
    };
    apiRef.current?.({ command });
    const resize = () => { const w = Math.max(1, mount.clientWidth || 640), h = Math.max(1, mount.clientHeight || 640); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }; resize(); const observer = new ResizeObserver(resize); observer.observe(mount); const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => { const dt = Math.min(clock.getDelta(), 0.05); const time = performance.now() / 1000; avatarRoot.rotation.y = THREE.MathUtils.lerp(avatarRoot.rotation.y, targetRotation + Math.sin(time * 0.22) * 0.018, 0.045); mixer?.update(dt); runAvatarBehaviorPipeline(time, dt, audioIntensity); microExpressions?.update(performance.now(), intensity); const speechTarget = speaking ? Math.max(0.035, intensity * 0.62) : 0; setTargets(mouthTargets, Math.min(speechTarget, 0.82), 0.18); setTargets(jawTargets, Math.min(speechTarget * 0.48, 0.4), 0.16); innerRing.rotation.z += dt * 0.08; outerRing.rotation.z -= dt * 0.045; grid.rotation.y += dt * 0.003; keyCyanLight.intensity = 2.35 + Math.sin(time * 1.8) * 0.18; renderer.render(scene, camera); });
    return () => { disposed = true; renderer.setAnimationLoop(null); observer.disconnect(); microExpressions?.dispose(); mixer?.stopAllAction(); resetTargets(mouthTargets); resetTargets(jawTargets); if (model) avatarRoot.remove(model); avatarMeshTarget = null; jointHeadRef.current = null; jointNeckRef.current = null; jointChestRef.current = null; jointHipsRef.current = null; renderer.dispose(); floor.geometry.dispose(); (floor.material as THREE.Material).dispose(); grid.geometry.dispose(); gridMaterials.forEach((m) => m.dispose()); innerRing.geometry.dispose(); (innerRing.material as THREE.Material).dispose(); outerRing.geometry.dispose(); (outerRing.material as THREE.Material).dispose(); canvasContainer.remove(); };
  }, []);
  return <div ref={mountRef} className="relative w-full h-full min-h-[500px]" />;
}
