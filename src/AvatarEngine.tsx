import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export type AvatarPerformance = {
  emotion: string;
  expression: string;
  gesture: string;
  head: string;
  body: string;
  gaze: string;
  wardrobe?: string;
  environment?: string;
  activity?: string;
  intensity: number;
};

export type AvatarCommand =
  | { type: 'expression'; value: 'neutral' | 'happy' | 'thinking' | 'speaking' }
  | { type: 'viseme'; value: string; amount?: number }
  | { type: 'gesture'; value: 'wave' | 'nod' | 'idle' | 'acknowledge' | 'open_hand' | 'contrast' | 'emphasis' | 'explain' | 'enumerate' | 'question' | 'namaste' | 'clap' | 'bye_wave' | 'flying_kiss' | 'kiss_gesture' }
  | { type: 'performance'; value: AvatarPerformance };

type FaceMesh = THREE.Mesh & { morphTargetDictionary?: Record<string, number>; morphTargetInfluences?: number[] };
const LOCAL_NEERAJ_GLB = '/avatar/avatar.glb';
const clamp = (n: number) => THREE.MathUtils.clamp(n, 0, 1);

const aliases: Record<string, string[]> = {
  mouthOpen: ['mouthOpen', 'jawOpen', 'viseme_aa', 'viseme_AA'],
  smile: ['smile', 'mouthSmile', 'mouthSmileLeft', 'mouthSmileRight'],
  blink: ['blink', 'eyeBlink', 'eyeBlinkLeft', 'eyeBlinkRight', 'eyesClosed'],
  brow: ['brow', 'browInnerUp', 'browDownLeft', 'browDownRight'],
  pucker: ['mouthPucker', 'viseme_OU', 'viseme_ou'],
  funnel: ['mouthFunnel', 'viseme_O', 'viseme_oh'],
};

export function AvatarEngine({ apiRef, onStatus }: { apiRef: React.MutableRefObject<{ command: (c: AvatarCommand) => void } | null>; onStatus: (s: string) => void }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020609, 0.045);
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    camera.position.set(0, 1.65, 6.2);
    camera.lookAt(0, 1.5, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0x9bf8ff, 0x031014, 1.8));
    const key = new THREE.DirectionalLight(0xc8ffff, 3.2);
    key.position.set(2, 5, 4); key.castShadow = true; scene.add(key);
    const rim = new THREE.PointLight(0x2beaff, 10, 10);
    rim.position.set(-2.5, 2.5, -2); scene.add(rim);

    const avatar = new THREE.Group(); scene.add(avatar);
    const clock = new THREE.Clock();
    let model: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let expression: AvatarPerformance['expression'] = 'neutral';
    let speaking = false;
    let perf: AvatarPerformance = { emotion: 'neutral', expression: 'neutral', gesture: 'idle', head: 'neutral', body: 'idle', gaze: 'camera', intensity: 0.35 };
    let gesture = 'idle';
    let blinkTimer = 1.5;
    let blinkUntil = 0;

    const setMorph = (name: string, amount: number) => {
      if (!model) return;
      const wanted = aliases[name] ?? [name];
      model.traverse((obj) => {
        const mesh = obj as FaceMesh;
        if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
        const dict = mesh.morphTargetDictionary;
        for (const candidate of wanted) {
          const exact = Object.keys(dict).find((k) => k.toLowerCase() === candidate.toLowerCase());
          if (exact) mesh.morphTargetInfluences[dict[exact]] = clamp(amount);
        }
      });
    };

    const resetMouth = () => {
      for (const n of ['mouthOpen', 'pucker', 'funnel']) setMorph(n, 0);
    };
    const setExpression = (next: AvatarPerformance['expression']) => {
      expression = next;
      speaking = next === 'speaking';
      setMorph('smile', next === 'happy' ? 0.7 : 0);
      setMorph('brow', next === 'thinking' ? 0.3 : 0);
    };

    apiRef.current = { command: (command) => {
      if (command.type === 'expression') setExpression(command.value);
      if (command.type === 'gesture') gesture = command.value;
      if (command.type === 'viseme') {
        resetMouth();
        setMorph(command.value, command.amount ?? 0.8);
        if (command.value.toLowerCase().includes('mouthopen') || command.value.toLowerCase().includes('jawopen')) setMorph('mouthOpen', command.amount ?? 0.8);
      }
      if (command.type === 'performance') {
        perf = command.value;
        gesture = command.value.gesture;
        const e = command.value.expression.toLowerCase();
        if (e.includes('smile') || command.value.emotion === 'positive' || command.value.emotion === 'happy') setExpression('happy');
        else if (e.includes('think') || e.includes('thought')) setExpression('thinking');
        else if (e.includes('speak')) setExpression('speaking');
        else setExpression('neutral');
      }
    } };

    const loadProductionAvatar = async () => {
      const source = (import.meta.env.VITE_NEERAJ_GLB_URL as string | undefined)?.trim() || LOCAL_NEERAJ_GLB;
      try {
        const gltf = await new GLTFLoader().loadAsync(source);
        model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        model.position.y += size.y / 2;
        model.scale.setScalar(3 / Math.max(size.y, 0.001));
        model.traverse((obj) => { const mesh = obj as THREE.Mesh; if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; } });
        avatar.add(model);
        if (gltf.animations.length) {
          mixer = new THREE.AnimationMixer(model);
          const idle = gltf.animations.find((clip) => /idle|breath|stand/i.test(clip.name)) ?? gltf.animations[0];
          mixer.clipAction(idle).play();
        }
        let meshes = 0; let morphSets = 0; let bones = 0;
        model.traverse((obj) => { const mesh = obj as FaceMesh; if (mesh.isMesh) { meshes++; if (mesh.morphTargetDictionary) morphSets++; } if ((obj as THREE.Bone).isBone) bones++; });
        onStatus(`NEERAJ GLB ONLINE • ${meshes} MESHES • ${bones} BONES • ${morphSets} FACE MORPH SETS`);
      } catch (error) {
        onStatus(`NEERAJ GLB NOT AVAILABLE • ${error instanceof Error ? error.message : 'PRODUCTION ASSET REQUIRED'}`);
      }
    };
    void loadProductionAvatar();

    const findBone = (names: string[]) => {
      let found: THREE.Object3D | null = null;
      model?.traverse((obj) => { if (found) return; const n = obj.name.toLowerCase(); if (names.some((x) => n.includes(x))) found = obj; });
      return found;
    };
    const resize = () => { const w = mount.clientWidth || 1; const h = mount.clientHeight || 1; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false); };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(mount);

    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.05);
      mixer?.update(dt);
      const t = performance.now() / 1000;
      blinkTimer += dt;
      if (blinkTimer > 3.2 + Math.random() * 2.7) { blinkTimer = 0; blinkUntil = t + 0.14; }
      const blinkAmount = blinkUntil > t ? Math.sin(((blinkUntil - t) / 0.14) * Math.PI) : 0;
      setMorph('blink', blinkAmount);

      const head = findBone(['head']);
      const neck = findBone(['neck']);
      const spine = findBone(['spine', 'chest', 'upperchest']);
      const leftArm = findBone(['leftupperarm', 'left_arm', 'leftarm']);
      const rightArm = findBone(['rightupperarm', 'right_arm', 'rightarm']);
      const intensity = clamp(perf.intensity || 0.35);

      if (head) {
        const look = perf.gaze === 'camera' || perf.gaze === 'direct' ? Math.sin(t * 0.55) * 0.035 : Math.sin(t * 0.32) * 0.015;
        head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, look, 0.035);
        head.rotation.z = THREE.MathUtils.lerp(head.rotation.z, perf.head.includes('tilt') ? 0.025 : 0, 0.04);
        if (gesture === 'nod' || gesture === 'acknowledge') head.rotation.x = Math.sin(t * 3.1) * 0.035;
      }
      if (neck) neck.rotation.y = THREE.MathUtils.lerp(neck.rotation.y, Math.sin(t * 0.4) * 0.012, 0.02);
      if (spine) spine.rotation.x = THREE.MathUtils.lerp(spine.rotation.x, perf.body.includes('lean') ? -0.035 * intensity : 0, 0.025);

      const armAmount = 0.18 + intensity * 0.32;
      if (rightArm) rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, ['open_hand', 'explain', 'enumerate', 'emphasis', 'wave', 'bye_wave'].includes(gesture) ? -armAmount : gesture === 'namaste' || gesture === 'clap' ? -0.3 : 0, 0.06);
      if (leftArm) leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, ['namaste', 'clap', 'contrast'].includes(gesture) ? armAmount * 0.9 : 0, 0.06);

      if (!speaking) setMorph('mouthOpen', 0);
      if (expression !== 'happy') setMorph('smile', 0);
      renderer.render(scene, camera);
    });

    return () => { renderer.setAnimationLoop(null); ro.disconnect(); apiRef.current = null; mixer?.stopAllAction(); renderer.dispose(); if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement); };
  }, [apiRef, onStatus]);

  return <div ref={mountRef} className="avatar-engine" />;
}
