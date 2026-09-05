import * as THREE from 'three';

export type AvatarRuntimeReport = {
  skinnedMeshes: number;
  bones: number;
  morphMeshes: number;
  morphTargets: number;
  arkitTargets: number;
  visemeTargets: number;
  animations: string[];
  ready: boolean;
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const ARKIT = new Set([
  'browDownLeft','browDownRight','browInnerUp','browOuterUpLeft','browOuterUpRight',
  'eyeBlinkLeft','eyeBlinkRight','eyeLookDownLeft','eyeLookDownRight','eyeLookInLeft','eyeLookInRight',
  'eyeLookOutLeft','eyeLookOutRight','eyeLookUpLeft','eyeLookUpRight','eyeSquintLeft','eyeSquintRight',
  'eyeWideLeft','eyeWideRight','cheekPuff','cheekSquintLeft','cheekSquintRight','noseSneerLeft','noseSneerRight',
  'jawForward','jawLeft','jawOpen','jawRight','mouthClose','mouthDimpleLeft','mouthDimpleRight',
  'mouthFrownLeft','mouthFrownRight','mouthFunnel','mouthLeft','mouthLowerDownLeft','mouthLowerDownRight',
  'mouthPressLeft','mouthPressRight','mouthPucker','mouthRight','mouthRollLower','mouthRollUpper',
  'mouthShrugLower','mouthShrugUpper','mouthSmileLeft','mouthSmileRight','mouthStretchLeft','mouthStretchRight',
  'mouthUpperUpLeft','mouthUpperUpRight','tongueOut',
]);

const VISEMES = new Set(['viseme_sil','viseme_PP','viseme_FF','viseme_TH','viseme_DD','viseme_kk','viseme_CH','viseme_SS','viseme_nn','viseme_RR','viseme_aa','viseme_E','viseme_I','viseme_O','viseme_U','viseme_aa','viseme_ih','viseme_ou']);

export class AvatarRuntime {
  readonly root: THREE.Object3D;
  readonly mixer: THREE.AnimationMixer | null;
  private readonly morphMeshes: THREE.Mesh[] = [];
  private readonly bones = new Map<string, THREE.Object3D>();
  private readonly morphIndex = new Map<string, Array<{ mesh: THREE.Mesh; index: number }>>();

  constructor(root: THREE.Object3D, animations: THREE.AnimationClip[] = []) {
    this.root = root;
    this.mixer = animations.length ? new THREE.AnimationMixer(root) : null;

    root.traverse((obj) => {
      if (obj instanceof THREE.Bone) this.bones.set(normalize(obj.name), obj);
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh instanceof THREE.SkinnedMesh) {
        // SkinnedMesh is intentionally detected separately; its skeleton remains owned by Three.js.
      }
      if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
      this.morphMeshes.push(mesh);
      for (const [name, index] of Object.entries(mesh.morphTargetDictionary)) {
        const key = normalize(name);
        const list = this.morphIndex.get(key) ?? [];
        list.push({ mesh, index });
        this.morphIndex.set(key, list);
      }
    });

    for (const clip of animations) this.mixer?.clipAction(clip).play();
  }

  report(): AvatarRuntimeReport {
    let skinnedMeshes = 0;
    let bones = 0;
    this.root.traverse((obj) => {
      if (obj instanceof THREE.SkinnedMesh) skinnedMeshes++;
      if (obj instanceof THREE.Bone) bones++;
    });
    const names = [...this.morphIndex.keys()];
    const arkitTargets = names.filter((name) => ARKIT.has(name)).length;
    const visemeTargets = names.filter((name) => VISEMES.has(name)).length;
    return {
      skinnedMeshes,
      bones,
      morphMeshes: this.morphMeshes.length,
      morphTargets: names.length,
      arkitTargets,
      visemeTargets,
      animations: this.mixer ? [] : [],
      ready: skinnedMeshes > 0 && bones > 0 && this.morphMeshes.length > 0,
    };
  }

  setMorph(names: string | string[], weight: number) {
    const wanted = Array.isArray(names) ? names : [names];
    for (const name of wanted) {
      const entries = this.morphIndex.get(normalize(name));
      if (!entries) continue;
      for (const { mesh, index } of entries) mesh.morphTargetInfluences![index] = THREE.MathUtils.clamp(weight, 0, 1);
    }
  }

  setFirstAvailable(names: string[], weight: number) {
    for (const name of names) {
      const entries = this.morphIndex.get(normalize(name));
      if (entries?.length) {
        this.setMorph(name, weight);
        return true;
      }
    }
    return false;
  }

  bone(names: string[]) {
    for (const name of names) {
      const result = this.bones.get(normalize(name));
      if (result) return result;
    }
    return null;
  }

  update(delta: number) {
    this.mixer?.update(delta);
  }
}
