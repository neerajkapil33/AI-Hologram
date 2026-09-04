# NEERAJ AI — Open-source avatar implementation

## What was incorporated

The runtime architecture was implemented from public, permissively licensed Three.js avatar patterns rather than copying a third-party application wholesale.

Reference implementations reviewed:

- `tenjerma/tts-avatar` — ARKit facial blendshape lookup, automatic blink, eye saccades and idle motion. License: MIT.
- `Dunya-8a/TalkingHead3DAvatar` — full-body GLB conventions, ARKit/Oculus viseme mapping and Blender helper-script approach.
- `pradhankukiran/talk2avatar` — VRM/Three.js real-time conversation pipeline and Oculus viseme application.
- `TLTMedia/valid-vrm-avatars` — VRM 1.0 avatar packaging with ARKit 52 facial expressions under CC BY 4.0.

## Local implementation

`src/avatar/rig/AvatarRuntime.ts` is the project-owned runtime layer. It discovers:

- SkinnedMesh objects and skeleton bones
- facial morph meshes and morph target names
- ARKit-compatible facial targets
- Oculus/viseme-style targets
- Three.js animation clips

`src/AvatarEngine.tsx` now tries `/avatar/avatar.glb` first and falls back to the existing `/profile/scene.gltf`. The UI status explicitly reports whether the loaded asset is `RIGGED READY` or `STATIC FALLBACK`.

## Required production asset contract

The final `/public/avatar/avatar.glb` must contain:

1. At least one `SkinnedMesh` bound to an armature.
2. A humanoid skeleton with hips/spine/neck/head, arms, hands, legs and feet.
3. Facial morph targets, preferably the full ARKit 52 set.
4. Oculus visemes or equivalent viseme morphs.
5. Eye/blink controls.
6. Named animation clips for idle, talk, wave and nod, or a separate animation library that can be retargeted.
7. All textures/material dependencies packed or referenced with valid relative paths.

The current `public/profile/scene.gltf` is deliberately retained as a fallback because it is a static photogrammetry-style model and does not meet this contract.

## Important limitation

Code can consume and animate a rigged model, but it cannot manufacture accurate facial deformation from a static mesh without an asset-generation/rigging stage. Therefore the repository is now production-runtime ready, while the identity-specific rigged GLB remains the final asset-generation input.
