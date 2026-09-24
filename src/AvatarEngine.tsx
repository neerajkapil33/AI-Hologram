import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

export type AvatarCommand =
  | { type: 'expression'; value: string }
  | { type: 'viseme'; value: string; weight?: number }
  | { type: 'gesture'; value: string }
  | { type: 'performance'; value: any };

type Props = {
  onStatus?: (status: string) => void;
  onApi?: (api: { command: (cmd: AvatarCommand) => void }) => void;
};

type BoneMap = {
  root: THREE.Bone | null;
  hips: THREE.Bone | null;
  spine: THREE.Bone | null;
  spine1: THREE.Bone | null;
  spine2: THREE.Bone | null;
  neck: THREE.Bone | null;
  neck1: THREE.Bone | null;
  neck2: THREE.Bone | null;
  head: THREE.Bone | null;

  lShoulder: THREE.Bone | null;
  rShoulder: THREE.Bone | null;
  lArm: THREE.Bone | null;
  rArm: THREE.Bone | null;
  lFore: THREE.Bone | null;
  rFore: THREE.Bone | null;
  lHand: THREE.Bone | null;
  rHand: THREE.Bone | null;
  lThigh: THREE.Bone | null;
  rThigh: THREE.Bone | null;
  lCalf: THREE.Bone | null;
  rCalf: THREE.Bone | null;
  lFoot: THREE.Bone | null;
  rFoot: THREE.Bone | null;
  jaw: THREE.Bone | null;

  lEye: THREE.Bone | null;
  rEye: THREE.Bone | null;
};

type Morph = {
  mesh: THREE.Mesh;
  index: number;
  name: string;
};

const SRC = `${import.meta.env.BASE_URL}avatar/model.fbx`;

const norm = (s: string) =>
  s.replace(/[^a-z0-9]/gi, '').toLowerCase();

function findExactBone(
  root: THREE.Object3D,
  names: string[],
): THREE.Bone | null {
  const wanted = new Set(names.map(norm));
  let result: THREE.Bone | null = null;

  root.traverse((object) => {
    if (result) return;

    if (!(object instanceof THREE.Bone)) return;

    if (wanted.has(norm(object.name))) {
      result = object;
    }
  });

  return result;
}

function findBones(root: THREE.Object3D): BoneMap {
  const bones: BoneMap = {
    root: null,
    hips: null,
    spine: null,
    spine1: null,
    spine2: null,
    neck: null,
    neck1: null,
    neck2: null,
    head: null,

    lShoulder: null,
    rShoulder: null,
    lArm: null,
    rArm: null,
    lFore: null,
    rFore: null,
    lHand: null,
    rHand: null,
    lThigh: null,
    rThigh: null,
    lCalf: null,
    rCalf: null,
    lFoot: null,
    rFoot: null,
    jaw: null,
    lEye: null,
    rEye: null,
  };

  bones.root = findExactBone(root, [
    'Root',
    'RootNode',
    'Armature',
  ]);

  bones.hips = findExactBone(root, [
    'Hips',
    'Hip',
    'Pelvis',
  ]);

  bones.spine = findExactBone(root, ['Spine']);
  bones.spine1 = findExactBone(root, ['Spine1']);
  bones.spine2 = findExactBone(root, ['Spine2']);
  bones.neck = findExactBone(root, ['Neck']);
  bones.neck1 = findExactBone(root, ['Neck1']);
  bones.neck2 = findExactBone(root, ['Neck2']);
  bones.head = findExactBone(root, ['Head']);

  bones.lShoulder = findExactBone(root, ['LeftShoulder']);
  bones.rShoulder = findExactBone(root, ['RightShoulder']);

  bones.lArm = findExactBone(root, ['LeftArm']);
  bones.rArm = findExactBone(root, ['RightArm']);

  bones.lFore = findExactBone(root, ['LeftForeArm']);
  bones.rFore = findExactBone(root, ['RightForeArm']);

  bones.lHand = findExactBone(root, ['LeftHand']);
  bones.rHand = findExactBone(root, ['RightHand']);

  bones.lThigh = findExactBone(root, ['LeftUpLeg', 'LeftThigh', 'LThigh', 'LUpLeg']);
  bones.rThigh = findExactBone(root, ['RightUpLeg', 'RightThigh', 'RThigh', 'RUpLeg']);
  bones.lCalf = findExactBone(root, ['LeftLeg', 'LeftCalf', 'LCalf', 'LLeg']);
  bones.rCalf = findExactBone(root, ['RightLeg', 'RightCalf', 'RCalf', 'RLeg']);
  bones.lFoot = findExactBone(root, ['LeftFoot', 'LFoot', 'LeftAnkle', 'LAnkle']);
  bones.rFoot = findExactBone(root, ['RightFoot', 'RFoot', 'RightAnkle', 'RAnkle']);
  bones.jaw = findExactBone(root, ['Jaw', 'LowerJaw', 'Mandible']);

  bones.lEye = findExactBone(root, [
    'LeftEye',
    'LEye',
    'iEye',
  ]);

  bones.rEye = findExactBone(root, [
    'RightEye',
    'REye',
  ]);

  return bones;
}

export default function AvatarEngine({
  onStatus,
  onApi,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  const statusRef = useRef(onStatus);
const apiRef = useRef<{ command: (cmd: AvatarCommand) => void } | null>(null);
  const onApiRef = useRef(onApi);

  useEffect(() => {
    statusRef.current = onStatus;
    onApiRef.current = onApi;
  }, [onApi, onStatus]);

  useEffect(() => {
    const mount = mountRef.current;

    if (!mount) return;

    mount.style.cssText =
      'position:relative;width:100%;height:100%;min-height:560px;overflow:hidden';

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      38,
      1,
      0.01,
      1000,
    );

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 1.5),
    );

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0, 0);

    renderer.domElement.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;display:block;z-index:2;pointer-events:none';

    mount.appendChild(renderer.domElement);

    scene.add(
      new THREE.HemisphereLight(
        0xd9f5ff,
        0x10141b,
        2.8,
      ),
    );

    const key = new THREE.DirectionalLight(
      0xffffff,
      3.4,
    );

    key.position.set(3, 6, 5);
    scene.add(key);

    const fill = new THREE.DirectionalLight(
      0x9beeff,
      1.8,
    );

    fill.position.set(-4, 3, 4);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(
      0xffffff,
      1.6,
    );

    rim.position.set(0, 5, -5);
    scene.add(rim);

    const root = new THREE.Group();
    scene.add(root);

    const loader = new FBXLoader();

    let model: THREE.Object3D | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let activeAction: THREE.AnimationAction | null = null;
    let nativeMotion = false;

    let bones: BoneMap | null = null;

    let disposed = false;

    let gesture = 'idle';
    let gestureStarted = performance.now();

    let speaking = false;
    let expression = 'neutral';

    let performanceState = {
      head: 'neutral',
      body: 'idle',
      gaze: 'camera',
      intensity: 0.35,
      durationMs: 1800,
      startedAt: performance.now(),
    };

    let targetMouth = 0;
    let mouth = 0;

    let eyeTargetX = 0;
    let eyeTargetY = 0;
    let eyeX = 0;
    let eyeY = 0;
    let nextEyeShift = performance.now() + 700;

    let avatarFrame: {
      height: number;
      width: number;
      depth: number;
    } | null = null;

    let targetRotation = 0;
    let rotationStep = 0;
    const glassesObjects: THREE.Object3D[] = [];

    const morphs: Morph[] = [];
    const blinkMorphs: Morph[] = [];
    const expressionMorphs: Morph[] = [];
    const fingerBones: { left: THREE.Bone[]; right: THREE.Bone[] } = { left: [], right: [] };
    const adaptiveProfile = { arm: 1, forearm: 1, hand: 1, leg: 1, ankle: 1, spine: 1 };

    const originalRotation = new Map<
      THREE.Bone,
      THREE.Euler
    >();

    const setStatus = (value: string) => {
      statusRef.current?.(value);
    };

    const rememberBone = (bone: THREE.Bone | null) => {
      if (!bone) return;

      if (!originalRotation.has(bone)) {
        originalRotation.set(
          bone,
          bone.rotation.clone(),
        );
      }
    };

    const rememberAllBones = (map: BoneMap) => {
      Object.values(map).forEach((value) => {
        if (value instanceof THREE.Bone) {
          rememberBone(value);
        }
      });
    };

    const dampRotation = (
      bone: THREE.Bone | null,
      axis: 'x' | 'y' | 'z',
      value: number,
      speed: number,
      dt: number,
    ) => {
      if (!bone) return;

      bone.rotation[axis] = THREE.MathUtils.damp(
        bone.rotation[axis],
        value,
        speed,
        dt,
      );
    };

    const addRotation = (
      bone: THREE.Bone | null,
      axis: 'x' | 'y' | 'z',
      amount: number,
      speed: number,
      dt: number,
    ) => {
      if (!bone) return;

      const base = originalRotation.get(bone);

      if (!base) return;

      dampRotation(
        bone,
        axis,
        base[axis] + amount,
        speed,
        dt,
      );
    };

    const restoreBone = (
      bone: THREE.Bone | null,
      speed: number,
      dt: number,
    ) => {
      if (!bone) return;

      const base = originalRotation.get(bone);

      if (!base) return;

      dampRotation(
        bone,
        'x',
        base.x,
        speed,
        dt,
      );

      dampRotation(
        bone,
        'y',
        base.y,
        speed,
        dt,
      );

      dampRotation(
        bone,
        'z',
        base.z,
        speed,
        dt,
      );
    };

    const restoreLowerBody = (
      map: BoneMap,
      speed: number,
      dt: number,
    ) => {
      [map.lThigh, map.rThigh, map.lCalf, map.rCalf, map.lFoot, map.rFoot]
        .forEach((bone) => restoreBone(bone, speed, dt));
    };

    const restoreUpperBody = (
      map: BoneMap,
      speed: number,
      dt: number,
    ) => {
      [
        map.lShoulder,
        map.rShoulder,
        map.lArm,
        map.rArm,
        map.lFore,
        map.rFore,
        map.lHand,
        map.rHand,
        map.head,
        map.neck,
        map.neck1,
        map.neck2,
        map.lEye,
        map.rEye,
      ].forEach((bone) =>
        restoreBone(bone, speed, dt),
      );
    };

    const restoreAllBones = (
      speed: number,
      dt: number,
    ) => {
      originalRotation.forEach((_base, bone) => restoreBone(bone, speed, dt));
    };

    const frameAvatar = () => {
      if (!avatarFrame) return;

      const vFov = THREE.MathUtils.degToRad(camera.fov);
      const aspect = Math.max(camera.aspect, 0.1);
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
      const distanceFromHeight = (avatarFrame.height * 1.10) / (2 * Math.tan(vFov / 2));
      const distanceFromWidth = (avatarFrame.width * 1.10) / (2 * Math.tan(hFov / 2));
      const distance = Math.max(distanceFromHeight, distanceFromWidth, avatarFrame.depth * 1.35);

      camera.position.set(0, avatarFrame.height * 0.50, distance);
      camera.lookAt(0, avatarFrame.height * 0.50, 0);
      camera.near = Math.max(0.01, avatarFrame.height / 1000);
      camera.far = Math.max(100, avatarFrame.height * 10);
      camera.updateProjectionMatrix();
    };

    const setMorph = (
      items: Morph[],
      value: number,
      alpha = 0.3,
    ) => {
      items.forEach(({ mesh, index }) => {
        if (!mesh.morphTargetInfluences) return;

        const current =
          mesh.morphTargetInfluences[index] ?? 0;

        mesh.morphTargetInfluences[index] =
          THREE.MathUtils.lerp(
            current,
            THREE.MathUtils.clamp(value, 0, 1),
            alpha,
          );
      });
    };

    const playNative = (
      patterns: RegExp[],
      loop: boolean,
      fallbackFirst = false,
    ) => {
      if (!mixer || !model) {
        nativeMotion = false;
        return false;
      }

      const clip =
        model.animations.find((candidate) =>
          patterns.some((pattern) =>
            pattern.test(norm(candidate.name)),
          ),
        ) ??
        (fallbackFirst
          ? model.animations[0]
          : undefined);

      if (!clip) {
        nativeMotion = false;
        return false;
      }

      const action = mixer.clipAction(clip);

      nativeMotion = true;
      action.reset();
      action.setEffectiveWeight(1);
      action.setEffectiveTimeScale(1);

      action.setLoop(
        loop ? THREE.LoopRepeat : THREE.LoopOnce,
        loop ? Infinity : 1,
      );

      action.clampWhenFinished = !loop;

      if (
        activeAction &&
        activeAction !== action
      ) {
        activeAction.fadeOut(0.16);
        action.fadeIn(0.16);
      }

      action.play();
      activeAction = action;

      return true;
    };

    const stopNativeMotion = () => {
      if (mixer) {
        mixer.stopAllAction();
      }
      activeAction = null;
      nativeMotion = false;
    };

    const setGlasses = (visible: boolean) => {
      glassesObjects.forEach((object) => { object.visible = visible; });
      setStatus(`3D AVATAR • GLASSES ${visible ? 'ON' : 'OFF'}`);
    };

    const runGesture = (raw: string) => {
      const value = raw
        .toLowerCase()
        .replace(/[_\s]+/g, '-')
        .replace(/--+/g, '-')
        .trim();

      if (value === 'reset-rotation' || value === 'face-front' || value === 'front') {
        rotationStep = 0;
        targetRotation = 0;
        setStatus('3D AVATAR • FRONT');
        return;
      }

      if (value === 'rotate' || value === 'turn' || value === 'turn-around' || value === 'rotate-step' || value === 'turn-step') {
        rotationStep += THREE.MathUtils.degToRad(45);
        targetRotation = rotationStep;
        setStatus('3D AVATAR • ROTATION STEP 45°');
        return;
      }

      if (/^(calibrate|self-check|diagnose|diagnostics)$/.test(value)) {
        setStatus('NEERAJ SELF-CHECK • ARMS ' + [bones?.lArm, bones?.rArm, bones?.lFore, bones?.rFore].filter(Boolean).length + ' • FINGERS ' + (fingerBones.left.length + fingerBones.right.length) + ' • LEGS ' + [bones?.lThigh, bones?.rThigh, bones?.lCalf, bones?.rCalf].filter(Boolean).length + ' • FACE ' + (morphs.length + (bones?.jaw ? 1 : 0)));
        return;
      }

      if (/^blink$/.test(value)) {
        blinkUntil = performance.now() + 180;
        setStatus('3D AVATAR • BLINK TEST');
        return;
      }

      if (/^jaw$/.test(value)) {
        targetMouth = 0.75;
        speaking = true;
        setStatus('3D AVATAR • JAW / LIP TEST');
        return;
      }

      if (/^(look-left|look-right|look-up|look-down|look)$/.test(value)) {
        gesture = value === 'look' ? 'eyes' : value;
        gestureStarted = performance.now();
        stopNativeMotion();
        setStatus(`3D AVATAR • ${gesture.toUpperCase()} TEST`);
        return;
      }

      if (/^(left-arm-up|right-arm-up|arms-up|cross-arms|fingers)$/.test(value)) {
        gesture = value;
        gestureStarted = performance.now();
        stopNativeMotion();
        setStatus(`3D AVATAR • ${value.toUpperCase()} TEST`);
        return;
      }

      if (/^(glasses|spectacles|eyewear|glasses-on|spectacles-on)$/.test(value)) {
        setGlasses(true);
        return;
      }

      if (/^(no-glasses|glasses-off|spectacles-off|remove-glasses|remove-spectacles)$/.test(value)) {
        setGlasses(false);
        return;
      }

      if (/\b(acknowledge|acknowledgement|nod|nodding|yes|agree|agreement)\b/.test(value)) {
        gesture = 'nod';
      } else if (/\b(chin-touch|chin|thinking-hand|think)\b/.test(value)) {
        gesture = 'chin-touch';
      } else if (/\b(namaste)\b/.test(value)) {
        gesture = 'present';
      } else if (/\b(bye-wave|wave|waving|greet|greeting|hello|hi|welcome)\b/.test(value)) {
        gesture = 'wave';
      } else if (/\b(point|pointing|indicate|indicating)\b/.test(value)) {
        gesture = 'point';
      } else if (/\b(present|presenting|explain|explaining|show|showing|open-hand|open-palms|emphasis|demonstrate)\b/.test(value)) {
        gesture = 'present';
      } else if (/\b(handshake|hand-shake|shake-hand|shake-hands)\b/.test(value)) {
        gesture = 'handshake';
      } else if (/\b(shrug|shrugging|uncertain|uncertainty)\b/.test(value)) {
        gesture = 'shrug';
      } else if (/\b(laugh|laughing|laughter)\b/.test(value)) {
        gesture = 'laugh';
        expression = 'excited';
      } else if (/\b(smile|smiling|happy|happiness)\b/.test(value)) {
        gesture = 'smile';
        expression = 'smile';
      } else if (/\b(eyes|eye-contact|look|looking|gaze)\b/.test(value)) {
        gesture = 'eyes';
      } else if (/\b(run|running|sprint|sprinting)\b/.test(value)) {
        gesture = 'run';
      } else if (/\b(walk|walking|step|stepping|locomotion)\b/.test(value)) {
        gesture = 'walk';
      } else if (/\b(jump|jumping|leap|leaping)\b/.test(value)) {
        gesture = 'jump';
      } else if (/\b(full-body|fullbody|performance|perform)\b/.test(value)) {
        gesture = 'full-body';
      } else if (/\b(clothes|clothing|adjust-clothes|adjust-clothing)\b/.test(value)) {
        gesture = 'clothes';
      } else if (/\b(sit|sitting|sit-down|sitdown)\b/.test(value)) {
        gesture = 'sit';
      } else if (/\b(stand|standing|stand-up|standup|rise|get-up)\b/.test(value)) {
        gesture = 'stand';
      } else if (/\b(idle|neutral|rest|reset|stop)\b/.test(value)) {
        gesture = 'idle';
      } else {
        gesture = 'idle';
      }

      gestureStarted = performance.now();
      stopNativeMotion();

      // Native idle is the only authored FBX clip allowed to drive the rig.
      // Active gestures remain procedural so one controller owns the body bones.
      const nativePatterns: Record<string, RegExp[]> = {
        idle: [/idle/, /stand/, /breath/, /rest/, /neutral/],
        walk: [/walk/, /walking/, /locomotion/],
        run: [/run/, /running/, /sprint/, /jog/],
        jump: [/jump/, /jumping/, /leap/],
        wave: [/wave/, /waving/, /greet/, /salute/, /hello/],
        handshake: [/handshake/, /hand-shake/, /shakehand/],
        point: [/point/, /indicate/],
        present: [/present/, /explain/, /show/, /openhand/],
        nod: [/nod/, /yes/, /agree/],
        shrug: [/shrug/, /uncertain/],
        laugh: [/laugh/, /laughter/],
        smile: [/smile/, /happy/],
        eyes: [/eye/, /gaze/, /look/],
        'full-body': [/fullbody/, /performance/, /dance/, /gesture/],
        clothes: [/clothes/, /clothing/, /adjust/],
        sit: [/sit/, /sitting/, /sitdown/],
        stand: [/stand/, /standing/, /standup/, /rise/, /getup/],
      };

      const patterns = nativePatterns[gesture] ?? [];
      // Only idle is allowed to use an authored FBX clip. Active movement is
      // owned by the rig-aware controller so the shoulder/elbow/wrist/fingers,
      // hips/knees/ankles and neck are never locked by a competing clip.
      if (gesture === 'idle' && patterns.length) {
        nativeMotion = playNative(patterns, true);
      } else {
        nativeMotion = false;
      }

      setStatus(
        `3D AVATAR • ${gesture.toUpperCase()} • ${nativeMotion ? 'NATIVE' : 'PROCEDURAL FALLBACK'}`,
      );
    };

    const command = (cmd: AvatarCommand) => {
      if (cmd.type === 'performance') {
        const value = cmd.value ?? {};

        if (typeof value.speaking === 'boolean') {
          speaking = value.speaking;
        }

        if (typeof value.gesture === 'string') {
          runGesture(value.gesture);
        }

        const expressionSource =
          typeof value.expression === 'string'
            ? value.expression
            : typeof value.emotion === 'string'
              ? value.emotion
              : 'neutral';

        const normalizedExpression = expressionSource.toLowerCase();
        if (/smile|happy|warm|kind|positive|confident/.test(normalizedExpression)) {
          expression = 'smile';
        } else if (/sad|grief|hurt/.test(normalizedExpression)) {
          expression = 'sad';
        } else if (/thinking|thoughtful|confused|curious|smart/.test(normalizedExpression)) {
          expression = 'thinking';
        } else if (/surprise|excited|energetic|joyful/.test(normalizedExpression)) {
          expression = 'excited';
        } else if (/firm|angry|assertive|focused/.test(normalizedExpression)) {
          expression = 'firm';
        } else {
          expression = 'neutral';
        }

        performanceState = {
          head: typeof value.head === 'string' ? value.head.toLowerCase() : 'neutral',
          body: typeof value.body === 'string' ? value.body.toLowerCase() : 'idle',
          gaze: typeof value.gaze === 'string' ? value.gaze.toLowerCase() : 'camera',
          intensity: THREE.MathUtils.clamp(Number(value.intensity ?? 0.35), 0.15, 0.85),
          durationMs: Math.max(300, Math.min(10000, Number(value.duration_ms ?? 1800))),
          startedAt: performance.now(),
        };

        setStatus(
          `NEERAJ PERFORMANCE • ${performanceState.body.toUpperCase()} • ${performanceState.head.toUpperCase()} • ${performanceState.gaze.toUpperCase()}`,
        );
        return;
      }

      if (cmd.type === 'viseme') {
        targetMouth =
          /silence|close|rest/i.test(
            cmd.value,
          )
            ? 0
            : THREE.MathUtils.clamp(
                Number(cmd.weight ?? 0),
                0,
                1,
              );

        return;
      }

      if (cmd.type === 'expression') {
        const value =
          cmd.value.toLowerCase();

        if (
          /speaking|talk/.test(value)
        ) {
          speaking = true;
        }

        if (
          /neutral|rest|stop/.test(value)
        ) {
          speaking = false;
          expression = 'neutral';

          playNative(
            [/idle/, /stand/, /breath/, /rest/, /neutral/],
            true,
            true,
          );
        }

        if (
          /smile|happy|warm|positive|confident/.test(
            value,
          )
        ) {
          expression = 'smile';
        }

        if (/sad/.test(value)) {
          expression = 'sad';
        }

        return;
      }

      runGesture(cmd.value);
    };

    apiRef.current = {
      command,
    };

    onApiRef.current?.({
      command,
    });

    loader.load(
      SRC,
      (loaded) => {
        if (disposed) return;

        model = loaded;

        root.add(loaded);

        loaded.traverse((object) => {
          const avatarObjectName = norm(object.name);
          if (/glasses|spectacles|eyewear|eyeglass|sunglasses/.test(avatarObjectName)) {
            glassesObjects.push(object);
            object.visible = false;
          }

          if (object instanceof THREE.Bone) {
            rememberBone(object);
            const n = norm(object.name);
            const isFinger = /finger|thumb|index|middle|ring|pinky|little|metacarp|proximal|distal/.test(n);
            if (isFinger && !/hand$|wrist|forearm|arm/.test(n)) {
              if (/left|^l/.test(n)) fingerBones.left.push(object);
              if (/right|^r/.test(n)) fingerBones.right.push(object);
            }
          }

          if (!(object instanceof THREE.Mesh))
            return;

          object.frustumCulled = false;

          if (
            object.morphTargetDictionary &&
            object.morphTargetInfluences
          ) {
            Object.entries(
              object.morphTargetDictionary,
            ).forEach(([name, index]) => {
              const item = {
                mesh: object,
                index,
                name,
              };

              const normalized = norm(name);

              if (
                /mouth|viseme|phoneme|lip|tongue|jaw|aa|ah|ao|oh|uh/.test(
                  normalized,
                )
              ) {
                morphs.push(item);
              }

              if (
                /blink|eyelid|eyeclose|closeeye|lidclose/.test(
                  normalized,
                )
              ) {
                blinkMorphs.push(item);
              }

              if (
                /smile|happy|sad|frown|brow|cheek|mouthsmile|lipcorner/.test(
                  normalized,
                )
              ) {
                expressionMorphs.push(item);
              }
            });
          }
        });

        bones = findBones(loaded);
        console.info('[Neeraj Avatar] MOTION ROOT CAUSE CHECK', { nativeClips: loaded.animations.map((c) => c.name), bones, fingerCount: fingerBones.left.length + fingerBones.right.length,
          morphCount: morphs.length,
          blinkMorphCount: blinkMorphs.length,
          expressionMorphCount: expressionMorphs.length,
          nativeProceduralConflictPolicy: 'procedural gestures own bones',
          missingCriticalJoints: Object.entries(bones).filter(([, value]) => !value).map(([name]) => name) });

        rememberAllBones(bones);

        mixer =
          new THREE.AnimationMixer(loaded);

        mixer.addEventListener('finished', (event) => {
          if (event.action !== activeAction) return;
          if (!event.action.clampWhenFinished) return;

          nativeMotion = false;
          gesture = 'idle';
          gestureStarted = performance.now();
          playNative(
            [/idle/, /stand/, /breath/, /rest/, /neutral/],
            true,
            true,
          );
        });

        loaded.updateMatrixWorld(true);

        const box =
          new THREE.Box3().setFromObject(
            loaded,
          );

        const center =
          box.getCenter(
            new THREE.Vector3(),
          );

        const size =
          box.getSize(
            new THREE.Vector3(),
          );

        const height =
          Math.max(size.y, 1);

        loaded.position.set(
          -center.x,
          -box.min.y,
          -center.z,
        );

        loaded.updateMatrixWorld(true);

        avatarFrame = {
          height,
          width: Math.max(size.x, 0.1),
          depth: Math.max(size.z, 0.1),
        };
        frameAvatar();

        nativeMotion = playNative(
          [
            /idle/,
            /stand/,
            /breath/,
            /rest/,
            /neutral/,
          ],
          true,
          true,
        );

        const nativeStarted = nativeMotion;

        console.log(
          '[Neeraj Avatar] Skeleton:',
          {
            root: bones.root?.name,
            hips: bones.hips?.name,
            spine: bones.spine?.name,
            spine1: bones.spine1?.name,
            spine2: bones.spine2?.name,
            neck: bones.neck?.name,
            head: bones.head?.name,
            lShoulder: bones.lShoulder?.name,
            rShoulder: bones.rShoulder?.name,
            lArm: bones.lArm?.name,
            rArm: bones.rArm?.name,
            lFore: bones.lFore?.name,
            rFore: bones.rFore?.name,
            lHand: bones.lHand?.name,
            rHand: bones.rHand?.name,
            lThigh: bones.lThigh?.name,
            rThigh: bones.rThigh?.name,
            lCalf: bones.lCalf?.name,
            rCalf: bones.rCalf?.name,
            lFoot: bones.lFoot?.name,
            rFoot: bones.rFoot?.name,
            jaw: bones.jaw?.name,
            neck1: bones.neck1?.name,
            neck2: bones.neck2?.name,
            lEye: bones.lEye?.name,
            rEye: bones.rEye?.name,
          },
        );

        console.log(
          '[Neeraj Avatar] FBX animations:',
          loaded.animations.map(
            (clip) => clip.name,
          ),
        );

        console.log(
          '[Neeraj Avatar] Morph targets:',
          morphs.map(
            (item) => item.name,
          ),
        );

        setStatus(
          `NEERAJ AVATAR READY • FULL BODY • ${
            loaded.animations.length
          } FBX CLIP${
            loaded.animations.length === 1
              ? ''
              : 'S'
          } • ${
            nativeStarted
              ? 'NATIVE MOTION PLAYING'
              : 'PROCEDURAL MOTION'
          }`,
        );
      },
      undefined,
      (error) => {
        console.error(
          '[Neeraj Avatar] FBX load error',
          error,
        );

        setStatus(
          `NEERAJ AVATAR LOAD ERROR • ${
            error instanceof Error
              ? error.message
              : 'CHECK avatar/model.fbx'
          }`,
        );
      },
    );

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);

      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      frameAvatar();
    };

    resize();

    const resizeObserver =
      new ResizeObserver(resize);

    resizeObserver.observe(mount);

    const clock =
      new THREE.Clock();

    let nextBlink =
      performance.now() + 2200;

    let blinkUntil = 0;

    renderer.setAnimationLoop(() => {
      const dt = Math.min(
        clock.getDelta(),
        0.033,
      );

      const now =
        performance.now();

      const time =
        now * 0.001;

      mixer?.update(dt);

      root.rotation.y =
        THREE.MathUtils.damp(
          root.rotation.y,
          targetRotation,
          7,
          dt,
        );

      /*
       * BLINKING
       */
      if (
        now >= nextBlink &&
        now > blinkUntil
      ) {
        blinkUntil =
          now + 140;

        nextBlink =
          now +
          2600 +
          Math.random() * 2800;
      }

      setMorph(
        blinkMorphs,
        now < blinkUntil
          ? 1
          : 0,
        0.55,
      );

      /*
       * MOUTH / SPEECH
       */
      mouth =
        THREE.MathUtils.damp(
          mouth,
          speaking
            ? Math.max(
                targetMouth,
                0.16 +
                  Math.abs(
                    Math.sin(
                      time * 8,
                    ),
                  ) *
                    0.14,
              )
            : targetMouth,
          20,
          dt,
        );

      const openMouthMorphs = morphs.filter((item) =>
        /viseme|mouthopen|jawopen|phoneme|^aa$|^ah$|^ao$|^oh$|^uh$|open|vowel|talk|speech|lip/i.test(norm(item.name)),
      );
      // Some exports name the facial keys simply "mouth" or "lip". If the
      // FBX has facial morphs but no explicit open-mouth key, drive the facial
      // morph set rather than leaving the lips permanently sealed.
      const mouthTargets = openMouthMorphs.length ? openMouthMorphs : morphs;
      setMorph(mouthTargets, mouth, 0.72);

      // Always release the previous expression before applying the new one.
      // This prevents smile/brow shapes from becoming permanently stuck.
      setMorph(expressionMorphs, 0, 0.12);

      const faceExpression = expression;
      if (faceExpression !== 'neutral' && expressionMorphs.length) {
        const expressionTargets = expressionMorphs.filter((item) => {
          const n = norm(item.name);
          if (faceExpression === 'smile' || faceExpression === 'happy' || faceExpression === 'warm') {
            return /smile|happy|mouthsmile|lipcorner|cheek/.test(n);
          }
          if (faceExpression === 'sad' || faceExpression === 'concerned') {
            return /sad|frown|brow|mouthdown|lipcorner/.test(n);
          }
          if (faceExpression === 'surprised' || faceExpression === 'excited') {
            return /surprise|wide|brow|open/.test(n);
          }
          if (faceExpression === 'angry' || faceExpression === 'firm') {
            return /angry|frown|brow|tension/.test(n);
          }
          if (faceExpression === 'thinking' || faceExpression === 'confused') {
            return /brow|confus|think|frown/.test(n);
          }
          return false;
        });
        setMorph(expressionTargets, faceExpression === 'surprised' || faceExpression === 'excited' ? 0.42 : 0.34, 0.24);
      }

      // Fallback jaw articulation for FBX rigs without usable lip morphs.
      if (bones?.jaw) {
        const base = originalRotation.get(bones.jaw);
        if (base) {
          bones.jaw.rotation.x = THREE.MathUtils.damp(
            bones.jaw.rotation.x,
            base.x + mouth * 0.22,
            18,
            dt,
          );
        }
      }

      /*
       * PROCEDURAL ATTENTION LAYER
       *
       * One writer owns both eye bones in procedural idle.
       * PerformanceDirector contributes only a target offset here; it never
       * writes the eye bones independently.
       */
      if (bones && !nativeMotion && gesture === 'idle') {
        if (now >= nextEyeShift) {
          eyeTargetX = (Math.random() * 2 - 1) * 0.035;
          eyeTargetY = (Math.random() * 2 - 1) * 0.020;
          nextEyeShift = now + 900 + Math.random() * 1200;
        }

        const performanceAge =
          (now - performanceState.startedAt) /
          Math.max(performanceState.durationMs, 1);
        const pulse =
          Math.sin(Math.min(performanceAge, 1) * Math.PI);
        const attentionStrength =
          performanceState.intensity *
          (0.65 + 0.35 * pulse);
        const focusX =
          performanceState.gaze === 'soft_focus'
            ? -0.045 * attentionStrength
            : 0;
        const focusY =
          performanceState.gaze === 'soft_focus'
            ? -0.025 * attentionStrength
            : 0;

        eyeX = THREE.MathUtils.damp(
          eyeX,
          eyeTargetX + focusX,
          14,
          dt,
        );
        eyeY = THREE.MathUtils.damp(
          eyeY,
          eyeTargetY + focusY,
          14,
          dt,
        );

        addRotation(bones.lEye, 'y', eyeX, 14, dt);
        addRotation(bones.rEye, 'y', eyeX, 14, dt);
        addRotation(bones.lEye, 'x', eyeY, 14, dt);
        addRotation(bones.rEye, 'x', eyeY, 14, dt);
      }

      /*
       * PROCEDURAL BODY MOTION
       */
      if (bones && !nativeMotion) {
        /*
         * Procedural fallback is deliberately conservative. The FBX's own
         * authored clips are preferred because arbitrary rigs do not share
         * the same local bone axes.
         */
        restoreAllBones(10, dt);
        // All procedural gestures start from the captured rest pose each frame;
        // this prevents hand/elbow/leg rotations from accumulating or stacking.

        /*
         * EXECUTABLE PERFORMANCE LAYER
         *
         * PerformanceDirector supplies semantic head/body/gaze instructions.
         * They are converted here into small rig-aware offsets so the real FBX
         * performs instead of merely receiving a label.
         */
        // PerformanceDirector and gesture motion share the same bones.
        // Never stack both controllers: an explicit gesture owns the rig,
        // while PerformanceDirector offsets are applied only during idle.
        if (gesture === 'idle') {
          const performanceAge = (now - performanceState.startedAt) / Math.max(performanceState.durationMs, 1);
          const pulse = Math.sin(Math.min(performanceAge, 1) * Math.PI);
          const strength = performanceState.intensity * (0.65 + 0.35 * pulse);

        if (performanceState.head === 'small_nod') {
          const nod = Math.sin(time * 2.4) * 0.055 * strength;
          addRotation(bones.neck, 'x', nod * 0.35, 9, dt);
          addRotation(bones.neck1, 'x', nod * 0.25, 9, dt);
          addRotation(bones.neck2, 'x', nod * 0.20, 9, dt);
          addRotation(bones.head, 'x', nod, 9, dt);
        } else if (performanceState.head === 'slight_tilt') {
          addRotation(bones.neck, 'z', 0.045 * strength, 8, dt);
          addRotation(bones.neck1, 'z', 0.035 * strength, 8, dt);
          addRotation(bones.head, 'z', 0.075 * strength, 8, dt);
        } else if (performanceState.head === 'soft_tilt') {
          addRotation(bones.neck, 'z', 0.035 * strength, 8, dt);
          addRotation(bones.head, 'z', 0.065 * strength, 8, dt);
        } else if (performanceState.head === 'downward_soft') {
          addRotation(bones.neck, 'x', 0.055 * strength, 8, dt);
          addRotation(bones.neck1, 'x', 0.040 * strength, 8, dt);
          addRotation(bones.head, 'x', 0.080 * strength, 8, dt);
        } else if (performanceState.head === 'firm') {
          addRotation(bones.spine2, 'x', -0.025 * strength, 8, dt);
          addRotation(bones.neck, 'x', -0.018 * strength, 8, dt);
          addRotation(bones.head, 'x', -0.015 * strength, 8, dt);
        } else if (performanceState.head === 'upright') {
          addRotation(bones.spine2, 'x', -0.035 * strength, 8, dt);
          addRotation(bones.head, 'x', -0.018 * strength, 8, dt);
        }

        if (performanceState.body === 'open_posture' || performanceState.body === 'upright') {
          addRotation(bones.lShoulder, 'z', 0.035 * strength, 8, dt);
          addRotation(bones.rShoulder, 'z', -0.035 * strength, 8, dt);
          addRotation(bones.spine2, 'x', -0.025 * strength, 7, dt);
        } else if (performanceState.body === 'forward_lean') {
          addRotation(bones.spine, 'x', -0.045 * strength, 7, dt);
          addRotation(bones.spine1, 'x', -0.035 * strength, 7, dt);
          addRotation(bones.spine2, 'x', -0.025 * strength, 7, dt);
        } else if (performanceState.body === 'softened' || performanceState.body === 'relaxed') {
          addRotation(bones.spine2, 'x', 0.018 * strength, 7, dt);
          addRotation(bones.lShoulder, 'z', -0.025 * strength, 7, dt);
          addRotation(bones.rShoulder, 'z', 0.025 * strength, 7, dt);
          } else if (performanceState.body === 'athletic') {
            addRotation(bones.spine2, 'x', -0.035 * strength, 7, dt);
            addRotation(bones.lArm, 'z', 0.08 * strength, 7, dt);
            addRotation(bones.rArm, 'z', -0.08 * strength, 7, dt);
          }
        }

        /*
         * IDLE
         *
         * restoreAllBones() above already establishes the FBX rest pose.
         * Keep exactly one breathing layer here; authored FBX idle clips
         * already provide breathing and never enter this procedural branch.
         */
        if (gesture === 'idle') {
          addRotation(
            bones.spine,
            'x',
            Math.sin(time * 1.5) *
              0.018,
            5,
            dt,
          );

          addRotation(
            bones.head,
            'y',
            Math.sin(time * 0.8) *
              0.025,
            4,
            dt,
          );
        }

        /*
         * HEAD / NECK DIRECTION TESTS
         */
        else if (/^look-(left|right|up|down)$/.test(gesture)) {
          const horizontal = gesture === 'look-left' ? 0.42 : gesture === 'look-right' ? -0.42 : 0;
          const vertical = gesture === 'look-up' ? -0.24 : gesture === 'look-down' ? 0.24 : 0;
          addRotation(bones.lEye, 'y', horizontal, 12, dt);
          addRotation(bones.rEye, 'y', horizontal, 12, dt);
          addRotation(bones.lEye, 'x', vertical, 12, dt);
          addRotation(bones.rEye, 'x', vertical, 12, dt);
          addRotation(bones.neck, 'y', horizontal * 0.18, 8, dt);
          addRotation(bones.neck1, 'y', horizontal * 0.16, 8, dt);
          addRotation(bones.neck2, 'y', horizontal * 0.18, 8, dt);
          addRotation(bones.head, 'y', horizontal * 0.48, 9, dt);
          addRotation(bones.neck, 'x', vertical * 0.18, 8, dt);
          addRotation(bones.neck1, 'x', vertical * 0.14, 8, dt);
          addRotation(bones.neck2, 'x', vertical * 0.16, 8, dt);
          addRotation(bones.head, 'x', vertical * 0.48, 9, dt);
        }

        /*
         * ARM / HAND / FINGER TESTS
         */
        else if (gesture === 'left-arm-up' || gesture === 'right-arm-up' || gesture === 'arms-up') {
          const left = gesture !== 'right-arm-up';
          const right = gesture !== 'left-arm-up';
          if (left) {
            addRotation(bones.lShoulder, 'z', 0.72, 10, dt);
            addRotation(bones.lArm, 'z', 0.82, 10, dt);
            addRotation(bones.lFore, 'x', -0.35, 10, dt);
          }
          if (right) {
            addRotation(bones.rShoulder, 'z', -0.72, 10, dt);
            addRotation(bones.rArm, 'z', -0.82, 10, dt);
            addRotation(bones.rFore, 'x', -0.35, 10, dt);
          }
        }
        else if (gesture === 'cross-arms') {
          addRotation(bones.lArm, 'z', 0.48, 10, dt);
          addRotation(bones.rArm, 'z', -0.48, 10, dt);
          addRotation(bones.lFore, 'y', -0.72, 10, dt);
          addRotation(bones.rFore, 'y', 0.72, 10, dt);
        }
        else if (gesture === 'fingers') {
          const curl = (finger: THREE.Bone, index: number) => {
            const segment = Number(norm(finger.name).match(/[1-4]$/)?.[0] ?? 1);
            addRotation(finger, 'x', 0.10 + segment * 0.045 + Math.sin(time * 5 + index * 0.35) * 0.025, 12, dt);
          };
          fingerBones.left.forEach(curl);
          fingerBones.right.forEach(curl);
        }

        /*
         * WAVE
         */
        else if (
          gesture === 'wave'
        ) {
          restoreBone(
            bones.lArm,
            6,
            dt,
          );

          restoreBone(
            bones.lFore,
            6,
            dt,
          );

          addRotation(
            bones.rShoulder,
            'z',
            -0.08,
            10,
            dt,
          );

          addRotation(
            bones.rArm,
            'z',
            -0.42,
            10,
            dt,
          );

          addRotation(
            bones.rArm,
            'x',
            -0.08,
            10,
            dt,
          );

          addRotation(bones.rFore, 'x', -0.52, 10, dt);
          addRotation(bones.rFore, 'z', Math.sin(time * 7) * 0.12, 12, dt);

          addRotation(bones.rHand, 'z', Math.sin(time * 9) * 0.16 * adaptiveProfile.hand, 12, dt);
          addRotation(bones.rHand, 'y', Math.sin(time * 9 + Math.PI / 2) * 0.06, 10, dt);
          fingerBones.right.forEach((finger, index) =>
            addRotation(finger, 'x', 0.08 + Math.sin(time * 7 + index * 0.22) * 0.05, 12, dt),
          );
        }

        /*
         * POINT
         */
        else if (
          gesture === 'point'
        ) {
          restoreBone(
            bones.lArm,
            7,
            dt,
          );

          restoreBone(
            bones.lFore,
            7,
            dt,
          );

          addRotation(
            bones.rShoulder,
            'z',
            -0.12,
            12,
            dt,
          );

          addRotation(
            bones.rArm,
            'z',
            -0.72,
            14,
            dt,
          );

          addRotation(
            bones.rFore,
            'x',
            -0.85,
            14,
            dt,
          );

          addRotation(bones.rHand, 'z', -0.12 * adaptiveProfile.hand, 14, dt);
          fingerBones.right.forEach((finger, index) => addRotation(finger, 'x', index % 4 === 0 ? 0.04 : 0.12 + Math.abs(Math.sin(time * 9 + index)) * 0.06, 10, dt));
        }

        /*
         * PRESENT / OPEN HANDS
         */
        else if (
          gesture === 'present'
        ) {
          addRotation(
            bones.lArm,
            'z',
            0.65,
            12,
            dt,
          );

          addRotation(
            bones.rArm,
            'z',
            -0.65,
            12,
            dt,
          );

          addRotation(
            bones.lFore,
            'x',
            -0.25,
            12,
            dt,
          );

          addRotation(
            bones.rFore,
            'x',
            -0.25,
            12,
            dt,
          );

          addRotation(
            bones.lHand,
            'z',
            -0.12,
            12,
            dt,
          );

          addRotation(bones.rHand, 'z', 0.12 * adaptiveProfile.hand, 12, dt);
          fingerBones.left.forEach((finger) => addRotation(finger, 'x', 0.16, 10, dt));
          fingerBones.right.forEach((finger) => addRotation(finger, 'x', 0.16, 10, dt));
        }

        /*
         * HANDSHAKE
         */
        else if (
          gesture === 'handshake'
        ) {
          addRotation(
            bones.rShoulder,
            'z',
            -0.18,
            12,
            dt,
          );

          addRotation(
            bones.rArm,
            'z',
            -0.72,
            14,
            dt,
          );

          addRotation(
            bones.rFore,
            'x',
            -0.88 +
              Math.sin(
                time * 9,
              ) *
                0.12,
            16,
            dt,
          );

          addRotation(
            bones.rHand,
            'x',
            Math.sin(
              time * 9,
            ) *
              0.10,
            16,
            dt,
          );
        }

        /*
         * NOD
         */
        else if (
          gesture === 'nod'
        ) {
          restoreBone(
            bones.lArm,
            7,
            dt,
          );

          restoreBone(
            bones.rArm,
            7,
            dt,
          );

          addRotation(
            bones.head,
            'x',
            Math.sin(
              time * 4.2,
            ) *
              0.15,
            14,
            dt,
          );
        }

        /*
         * SHRUG
         */
        else if (
          gesture === 'shrug'
        ) {
          addRotation(
            bones.lShoulder,
            'z',
            -0.22,
            10,
            dt,
          );

          addRotation(
            bones.rShoulder,
            'z',
            0.22,
            10,
            dt,
          );

          addRotation(
            bones.lArm,
            'z',
            -0.15,
            10,
            dt,
          );

          addRotation(
            bones.rArm,
            'z',
            0.15,
            10,
            dt,
          );
        }

        /*
         * LAUGH
         */
        else if (
          gesture === 'laugh'
        ) {
          addRotation(
            bones.head,
            'x',
            Math.sin(time * 8) * 0.10,
            12,
            dt,
          );

          addRotation(
            bones.spine,
            'x',
            0.075 + Math.abs(Math.sin(time * 7)) * 0.035,
            9,
            dt,
          );

          addRotation(
            bones.spine1,
            'x',
            0.045 + Math.abs(Math.sin(time * 7)) * 0.025,
            9,
            dt,
          );

          // Facial morphs remain under the centralized mouth/expression layer.
        }

        /*
         * SMILE
         */
        else if (
          gesture === 'smile' ||
          expression === 'smile'
        ) {
          restoreUpperBody(
            bones,
            7,
            dt,
          );

          // Facial expression morphs are driven once by the centralized
          // expression layer above; this gesture only restores the body pose.
        }

        /*
         * EYE GESTURES
         */
        else if (
          gesture === 'eyes'
        ) {
          const gaze = Math.sin(time * 1.15) * 0.07;
          const vertical = Math.sin(time * 0.9 + 1) * 0.025;
          addRotation(bones.lEye, 'y', gaze, 10, dt);
          addRotation(bones.rEye, 'y', gaze, 10, dt);
          addRotation(bones.lEye, 'x', vertical, 10, dt);
          addRotation(bones.rEye, 'x', vertical, 10, dt);
          addRotation(bones.neck, 'y', gaze * 0.18, 6, dt);
          addRotation(bones.head, 'y', gaze * 0.35, 7, dt);
        }

        /*
         * CHIN TOUCH / THINKING
         */
        else if (gesture === 'chin-touch') {
          addRotation(bones.rShoulder, 'z', -0.18, 10, dt);
          addRotation(bones.rArm, 'z', -0.58, 10, dt);
          addRotation(bones.rFore, 'x', -1.00, 10, dt);
          addRotation(
            bones.rHand,
            'z',
            Math.sin(time * 1.5) * 0.04,
            10,
            dt,
          );
          addRotation(bones.head, 'x', 0.045, 8, dt);
        }

        /*
         * CLOTHES / SELF-ADJUSTMENT
         */
        else if (gesture === 'clothes') {
          addRotation(bones.rShoulder, 'z', -0.16, 10, dt);
          addRotation(bones.rArm, 'z', -0.34, 10, dt);
          addRotation(bones.rFore, 'x', -0.62, 10, dt);
          addRotation(
            bones.rHand,
            'z',
            Math.sin(time * 2) * 0.06,
            10,
            dt,
          );
          addRotation(bones.spine, 'x', 0.015, 8, dt);
        }

        /*
         * WALK / RUN / JUMP LEG TESTS
         */
        else if (gesture === 'walk' || gesture === 'run') {
          const fast = gesture === 'run';
          const phase = time * (fast ? 8.5 : 5.2);
          const leftSwing = Math.sin(phase);
          const rightSwing = Math.sin(phase + Math.PI);
          const leftKnee = Math.max(0, Math.sin(phase + Math.PI / 2));
          const rightKnee = Math.max(0, Math.sin(phase + Math.PI / 2 + Math.PI));

          addRotation(bones.lThigh, 'x', leftSwing * (fast ? 0.62 : 0.48) * adaptiveProfile.leg, 14, dt);
          addRotation(bones.rThigh, 'x', rightSwing * (fast ? 0.62 : 0.48) * adaptiveProfile.leg, 14, dt);
          addRotation(bones.lCalf, 'x', leftKnee * (fast ? 0.72 : 0.52) * adaptiveProfile.leg, 16, dt);
          addRotation(bones.rCalf, 'x', rightKnee * (fast ? 0.72 : 0.52) * adaptiveProfile.leg, 16, dt);
          addRotation(bones.lFoot, 'x', -leftSwing * (fast ? 0.22 : 0.16) * adaptiveProfile.ankle, 14, dt);
          addRotation(bones.rFoot, 'x', -rightSwing * (fast ? 0.22 : 0.16) * adaptiveProfile.ankle, 14, dt);
          addRotation(bones.lShoulder, 'z', -leftSwing * (fast ? 0.12 : 0.08), 12, dt);
          addRotation(bones.rShoulder, 'z', -rightSwing * (fast ? 0.12 : 0.08), 12, dt);
          addRotation(bones.lArm, 'z', -leftSwing * (fast ? 0.42 : 0.30), 12, dt);
          addRotation(bones.rArm, 'z', -rightSwing * (fast ? 0.42 : 0.30), 12, dt);
          addRotation(bones.lFore, 'x', -leftSwing * (fast ? 0.20 : 0.12), 12, dt);
          addRotation(bones.rFore, 'x', -rightSwing * (fast ? 0.20 : 0.12), 12, dt);
          addRotation(bones.spine, 'x', Math.abs(Math.sin(phase * 2)) * 0.035, 10, dt);
          addRotation(bones.spine1, 'x', Math.abs(Math.sin(phase * 2 + 0.4)) * 0.018, 10, dt);
          // Natural pelvic counter-rotation keeps the stride from looking like
          // a pair of disconnected legs.
          addRotation(bones.hips, 'z', Math.sin(phase) * 0.035, 10, dt);
          addRotation(bones.hips, 'y', Math.sin(phase + Math.PI / 2) * 0.025, 10, dt);
        }

        else if (gesture === 'jump') {
          const t = THREE.MathUtils.clamp((now - gestureStarted) / 900, 0, 1);
          const arc = Math.sin(Math.PI * t);
          const crouch = t < 0.24 ? t / 0.24 : t > 0.76 ? (1 - t) / 0.24 : 0;

          addRotation(bones.hips, 'x', -0.10 * crouch, 10, dt);
          addRotation(bones.lThigh, 'x', -0.62 * crouch, 10, dt);
          addRotation(bones.rThigh, 'x', -0.62 * crouch, 10, dt);
          addRotation(bones.lCalf, 'x', 1.05 * crouch, 10, dt);
          addRotation(bones.rCalf, 'x', 1.05 * crouch, 10, dt);
          addRotation(bones.lFoot, 'x', -0.24 * crouch, 10, dt);
          addRotation(bones.rFoot, 'x', -0.24 * crouch, 10, dt);
          addRotation(bones.lArm, 'z', -0.28 * arc, 10, dt);
          addRotation(bones.rArm, 'z', 0.28 * arc, 10, dt);
          root.position.y = arc * 0.22;
        }

        /*
         * FULL BODY
         */
        else if (gesture === 'sit') {
          addRotation(bones.hips, 'x', -0.10, 4.5, dt);
          addRotation(bones.lThigh, 'x', -0.95, 4.5, dt);
          addRotation(bones.rThigh, 'x', -0.95, 4.5, dt);
          addRotation(bones.lCalf, 'x', 1.35, 4.5, dt);
          addRotation(bones.rCalf, 'x', 1.35, 4.5, dt);
          addRotation(bones.lFoot, 'x', -0.35, 4.5, dt);
          addRotation(bones.rFoot, 'x', -0.35, 4.5, dt);
          addRotation(bones.spine, 'x', -0.10, 4, dt);
        }

        else if (gesture === 'stand') {
          restoreLowerBody(bones, 4.5, dt);
          restoreBone(bones.spine, 4, dt);
        }

        else if (
          gesture === 'full-body'
        ) {
          addRotation(
            bones.spine,
            'x',
            Math.sin(
              time * 1.2,
            ) *
              0.025,
            6,
            dt,
          );

          addRotation(
            bones.spine1,
            'x',
            Math.sin(
              time * 1.2,
            ) *
              0.018,
            6,
            dt,
          );

          addRotation(
            bones.head,
            'y',
            Math.sin(
              time * 0.9,
            ) *
              0.035,
            5,
            dt,
          );

          addRotation(
            bones.lArm,
            'z',
            Math.sin(
              time * 1.5,
            ) *
              0.05,
            5,
            dt,
          );

          addRotation(
            bones.rArm,
            'z',
            -Math.sin(
              time * 1.5,
            ) *
              0.05,
            5,
            dt,
          );
        }

        /*
         * SPEAKING
         */
        else if (
          speaking
        ) {
          addRotation(
            bones.head,
            'y',
            Math.sin(
              time * 2.2,
            ) *
              0.025,
            5,
            dt,
          );

          addRotation(
            bones.lArm,
            'z',
            Math.sin(
              time * 2.4,
            ) *
              0.04,
            5,
            dt,
          );

          addRotation(
            bones.rArm,
            'z',
            -Math.sin(
              time * 2.4,
            ) *
              0.04,
            5,
            dt,
          );
        }
      }

      if (!nativeMotion && gesture !== 'idle') {
        const durations: Record<string, number> = {
          wave: 1800,
          point: 1600,
          present: 1800,
          handshake: 2000,
          nod: 1200,
          shrug: 1400,
          laugh: 1800,
          smile: 1800,
          eyes: 1400,
          'full-body': 2200,
          'look-left': 1400,
          'look-right': 1400,
          'look-up': 1400,
          'look-down': 1400,
          'left-arm-up': 1600,
          'right-arm-up': 1600,
          'arms-up': 1600,
          'cross-arms': 1800,
          fingers: 1400,
          'chin-touch': 1800,
          clothes: 1800,
          sit: 3200,
          stand: 2600,
          walk: 3000,
          run: 3000,
          jump: 1200,
        };

        const duration = durations[gesture] ?? 0;
        if (duration > 0 && now - gestureStarted > duration) {
          gesture = 'idle';
          gestureStarted = now;
          nativeMotion = playNative(
            [/idle/, /stand/, /breath/, /rest/, /neutral/],
            true,
            true,
          );
        }
      }

      renderer.render(
        scene,
        camera,
      );

      if (targetMouth > 0) {
        targetMouth *=
          Math.pow(0.2, dt);
      } else {
        targetMouth = 0;
      }
    });

    return () => {
      disposed = true;

      resizeObserver.disconnect();

      renderer.setAnimationLoop(null);

      if (mixer && model) {
        mixer.stopAllAction();
        mixer.uncacheRoot(model);
      }

      if (model) {
        model.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;

          object.geometry.dispose();

          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];

          materials.forEach((material) => material.dispose());
        });

        root.remove(model);
      }

      activeAction = null;
      nativeMotion = false;
      mixer = null;
      model = null;

      renderer.dispose();

      if (
        mount.contains(
          renderer.domElement,
        )
      ) {
        mount.removeChild(
          renderer.domElement,
        );
      }

      apiRef.current = null;
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 560,
        overflow: 'hidden',
      }}
    />
  );
}