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

    let targetMouth = 0;
    let mouth = 0;

    let targetRotation = 0;
    let rotationStep = 0;
    const glassesObjects: THREE.Object3D[] = [];

    const morphs: Morph[] = [];
    const blinkMorphs: Morph[] = [];
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
      ].forEach((bone) =>
        restoreBone(bone, speed, dt),
      );
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

      if (/^(glasses|spectacles|eyewear|glasses-on|spectacles-on)$/.test(value)) {
        setGlasses(true);
        return;
      }

      if (/^(no-glasses|glasses-off|spectacles-off|remove-glasses|remove-spectacles)$/.test(value)) {
        setGlasses(false);
        return;
      }

      if (/\b(wave|waving|greet|greeting|hello|hi|welcome)\b/.test(value)) {
        gesture = 'wave';
      } else if (/\b(point|pointing|indicate|indicating)\b/.test(value)) {
        gesture = 'point';
      } else if (/\b(present|presenting|explain|explaining|show|showing|open-hand|open-palms)\b/.test(value)) {
        gesture = 'present';
      } else if (/\b(handshake|hand-shake|shake-hand|shake-hands)\b/.test(value)) {
        gesture = 'handshake';
      } else if (/\b(nod|nodding|yes|agree|agreement)\b/.test(value)) {
        gesture = 'nod';
      } else if (/\b(shrug|shrugging|uncertain|uncertainty)\b/.test(value)) {
        gesture = 'shrug';
      } else if (/\b(laugh|laughing|laughter)\b/.test(value)) {
        gesture = 'laugh';
      } else if (/\b(smile|smiling|happy|happiness)\b/.test(value)) {
        gesture = 'smile';
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
      nativeMotion = false;

      // Prefer animation clips authored for this exact rig. Procedural motion is
      // only a fallback; this prevents guessed bone axes from fighting the FBX.
      const nativePatterns: Record<string, RegExp[]> = {
        idle: [/idle/, /stand/, /breath/, /rest/, /neutral/],
        walk: [/walk/, /walking/, /locomotion/],
        run: [/run/, /running/, /sprint/, /jog/],
        jump: [/jump/, /jumping/, /leap/],
        wave: [/wave/, /greet/, /salute/, /hello/],
        handshake: [/^handshake$/, /^hand-shake$/, /handshake/],
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
      const exactNativeOnly =
        gesture === 'wave' ||
        gesture === 'point' ||
        gesture === 'present' ||
        gesture === 'handshake' ||
        gesture === 'laugh';
      const proceduralPriority = new Set(['wave','point','present','handshake','nod','shrug','laugh','smile','walk','run','jump','sit','stand','full-body']);

      if (patterns.length && !exactNativeOnly && !proceduralPriority.has(gesture)) {
        nativeMotion = playNative(
          patterns,
          gesture === 'idle' || gesture === 'walk',
        );
      }

      if (exactNativeOnly && model?.animations.some((clip) => {
        const n = norm(clip.name);
        return gesture === 'wave'
          ? /^(wave|waving|greet|salute|hello)$/.test(n)
          : gesture === 'handshake'
            ? /^(handshake|handshake01|handshake02)$/.test(n)
            : /^(laugh|laughing|laughter)$/.test(n);
      })) {
        nativeMotion = playNative(patterns, false);
      }

      // If a one-shot native clip exists, let the clip own the bones completely.
      // Otherwise the controlled fallback pose below is used.
      setStatus(
        `3D AVATAR • ${gesture.toUpperCase()} • ${nativeMotion ? 'NATIVE' : 'FALLBACK'}`,
      );
    };

    const command = (cmd: AvatarCommand) => {
      if (cmd.type === 'performance') {
        if (
          typeof cmd.value?.speaking ===
          'boolean'
        ) {
          speaking = cmd.value.speaking;
        }

        if (
          typeof cmd.value?.gesture ===
          'string'
        ) {
          runGesture(cmd.value.gesture);
        }

        if (
          typeof cmd.value?.emotion ===
          'string'
        ) {
          expression =
            cmd.value.emotion.toLowerCase();
        }

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
            });
          }
        });

        bones = findBones(loaded);
        console.info('[Neeraj Avatar] MOTION ROOT CAUSE CHECK', { nativeClips: loaded.animations.map((c) => c.name), bones, fingerCount: fingerBones.left.length + fingerBones.right.length, morphCount: morphs.length, nativeProceduralConflictPolicy: 'procedural gestures own bones' });

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

        const padding = 1.16;
        const vFov = THREE.MathUtils.degToRad(camera.fov);
        const hFov =
          2 * Math.atan(
            Math.tan(vFov / 2) * camera.aspect,
          );
        const distanceFromHeight =
          (size.y * padding) /
          (2 * Math.tan(vFov / 2));
        const distanceFromWidth =
          (size.x * padding) /
          (2 * Math.tan(hFov / 2));
        const distance = Math.max(
          distanceFromHeight,
          distanceFromWidth,
          size.z * 1.5,
        );

        camera.position.set(
          0,
          height * 0.50,
          distance,
        );

        camera.lookAt(
          0,
          height * 0.50,
          0,
        );

        camera.near =
          Math.max(0.01, height / 1000);

        camera.far =
          Math.max(100, height * 10);

        camera.updateProjectionMatrix();

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
      const width = Math.max(
        1,
        mount.clientWidth,
      );

      const height = Math.max(
        1,
        mount.clientHeight,
      );

      renderer.setSize(
        width,
        height,
        false,
      );

      camera.aspect =
        width / height;

      camera.updateProjectionMatrix();
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
        /viseme|mouthopen|jawopen|phoneme|^aa$|^ah$|^ao$|^oh$|^uh$/i.test(norm(item.name)),
      );
      setMorph(
        openMouthMorphs.length ? openMouthMorphs : morphs,
        mouth,
        0.48,
      );

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
       * PROCEDURAL BODY MOTION
       */
      if (bones && !nativeMotion) {
        /*
         * Procedural fallback is deliberately conservative. The FBX's own
         * authored clips are preferred because arbitrary rigs do not share
         * the same local bone axes.
         */
        restoreUpperBody(bones, 10, dt);
        restoreLowerBody(bones, 10, dt);
        // All procedural gestures start from the captured rest pose each frame;
        // this prevents hand/elbow/leg rotations from accumulating or stacking.

        /*
         * Always maintain a subtle breathing motion.
         */
        addRotation(
          bones.spine,
          'x',
          Math.sin(time * 1.4) *
            0.012,
          5,
          dt,
        );

        /*
         * IDLE
         */
        if (gesture === 'idle') {
          restoreUpperBody(
            bones,
            7,
            dt,
          );

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
          addRotation(bones.rFore, 'z', Math.sin(time * 7) * 0.10, 10, dt);

          addRotation(
            bones.rFore,
            'z',
            Math.sin(time * 7) *
              0.12,
            12,
            dt,
          );

          addRotation(bones.rHand, 'z', Math.sin(time * 9) * 0.16 * adaptiveProfile.hand, 12, dt);
          addRotation(bones.rHand, 'y', Math.sin(time * 9 + Math.PI / 2) * 0.06, 10, dt);
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

          setMorph(
            morphs,
            0.45 +
              Math.abs(
                Math.sin(
                  time * 7,
                ),
              ) *
                0.20,
            0.25,
          );
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

          setMorph(
            morphs,
            Math.max(
              mouth,
              0.16,
            ),
            0.18,
          );
        }

        /*
         * EYE GESTURES
         */
        else if (
          gesture === 'eyes'
        ) {
          addRotation(
            bones.lEye,
            'y',
            Math.sin(
              time * 1.4,
            ) *
              0.08,
            10,
            dt,
          );

          addRotation(
            bones.rEye,
            'y',
            Math.sin(
              time * 1.4,
            ) *
              0.08,
            10,
            dt,
          );
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
          addRotation(bones.lArm, 'z', -leftSwing * (fast ? 0.28 : 0.20), 12, dt);
          addRotation(bones.rArm, 'z', -rightSwing * (fast ? 0.28 : 0.20), 12, dt);
          addRotation(bones.spine, 'x', Math.abs(Math.sin(phase * 2)) * 0.025, 10, dt);
        }

        else if (gesture === 'jump') {
          const t = THREE.MathUtils.clamp((now - gestureStarted) / 900, 0, 1);
          const arc = Math.sin(Math.PI * t);
          const crouch = t < 0.24 ? t / 0.24 : t > 0.76 ? (1 - t) / 0.24 : 0;

          addRotation(bones.lThigh, 'x', -0.38 * crouch, 10, dt);
          addRotation(bones.rThigh, 'x', -0.38 * crouch, 10, dt);
          addRotation(bones.lCalf, 'x', 0.55 * crouch, 10, dt);
          addRotation(bones.rCalf, 'x', 0.55 * crouch, 10, dt);
          addRotation(bones.lFoot, 'x', -0.18 * crouch, 10, dt);
          addRotation(bones.rFoot, 'x', -0.18 * crouch, 10, dt);
          root.position.y = arc * 0.22;
        }

        /*
         * FULL BODY
         */
        else if (gesture === 'sit') {
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