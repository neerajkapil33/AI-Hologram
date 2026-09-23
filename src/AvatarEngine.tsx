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

    let bones: BoneMap | null = null;

    let disposed = false;

    let gesture = 'idle';
    let gestureStarted = performance.now();

    let speaking = false;
    let expression = 'neutral';

    let targetMouth = 0;
    let mouth = 0;

    let targetRotation = 0;

    const morphs: Morph[] = [];
    const blinkMorphs: Morph[] = [];

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
      if (!mixer || !model) return false;

      const clip =
        model.animations.find((candidate) =>
          patterns.some((pattern) =>
            pattern.test(norm(candidate.name)),
          ),
        ) ??
        (fallbackFirst
          ? model.animations[0]
          : undefined);

      if (!clip) return false;

      const action = mixer.clipAction(clip);

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
        activeAction.crossFadeTo(
          action,
          0.18,
          true,
        );
      }

      action.play();
      activeAction = action;

      return true;
    };

    const runGesture = (raw: string) => {
      const value = raw
        .toLowerCase()
        .replace(/_/g, '-')
        .trim();

      if (value === 'rotate') {
        targetRotation += Math.PI * 0.55;

        setStatus('3D AVATAR • ROTATING');

        return;
      }

      if (
        value.includes('wave') ||
        value.includes('greet')
      ) {
        gesture = 'wave';
      } else if (
        value.includes('point')
      ) {
        gesture = 'point';
      } else if (
        value.includes('present') ||
        value.includes('open-hand')
      ) {
        gesture = 'present';
      } else if (
        value.includes('handshake')
      ) {
        gesture = 'handshake';
      } else if (
        value.includes('nod')
      ) {
        gesture = 'nod';
      } else if (
        value.includes('shrug')
      ) {
        gesture = 'shrug';
      } else if (
        value.includes('laugh')
      ) {
        gesture = 'laugh';
      } else if (
        value.includes('smile') ||
        value.includes('happy')
      ) {
        gesture = 'smile';
      } else if (
        value.includes('eyes')
      ) {
        gesture = 'eyes';
      } else if (
        value.includes('walk')
      ) {
        gesture = 'walk';
      } else if (
        value.includes('full-body')
      ) {
        gesture = 'full-body';
      } else if (
        value.includes('clothes')
      ) {
        gesture = 'clothes';
      } else {
        gesture = 'idle';
      }

      gestureStarted = performance.now();

      if (gesture === 'walk') {
        playNative(
          [/walk/, /locomotion/, /run/],
          true,
        );
      } else if (gesture === 'idle') {
        playNative(
          [/idle/, /stand/, /breath/, /rest/, /neutral/],
          true,
          true,
        );
      } else if (gesture === 'full-body') {
        playNative(
          [/idle/, /stand/, /breath/, /neutral/],
          true,
          true,
        );
      } else if (gesture === 'wave') {
        playNative(
          [/wave/, /greet/, /salute/],
          false,
        );
      } else if (gesture === 'handshake') {
        playNative(
          [/handshake/, /shake/],
          false,
        );
      }

      setStatus(
        `3D AVATAR • ${gesture.toUpperCase()}`,
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

        rememberAllBones(bones);

        mixer =
          new THREE.AnimationMixer(loaded);

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

        const nativeStarted =
          playNative(
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

      setMorph(
        morphs,
        mouth,
        0.48,
      );

      /*
       * PROCEDURAL BODY MOTION
       */
      if (bones) {
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
            -0.18,
            12,
            dt,
          );

          addRotation(
            bones.rArm,
            'z',
            -1.05,
            14,
            dt,
          );

          addRotation(
            bones.rArm,
            'x',
            -0.15,
            14,
            dt,
          );

          addRotation(
            bones.rFore,
            'x',
            -0.55,
            14,
            dt,
          );

          addRotation(
            bones.rFore,
            'z',
            Math.sin(time * 7) *
              0.18,
            18,
            dt,
          );

          addRotation(
            bones.rHand,
            'z',
            Math.sin(time * 9) *
              0.25,
            18,
            dt,
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

          addRotation(
            bones.rHand,
            'z',
            -0.12,
            14,
            dt,
          );
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

          addRotation(
            bones.rHand,
            'z',
            0.12,
            12,
            dt,
          );
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
            Math.sin(
              time * 8,
            ) *
              0.07,
            10,
            dt,
          );

          addRotation(
            bones.spine,
            'x',
            0.05,
            8,
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
         * FULL BODY
         */
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