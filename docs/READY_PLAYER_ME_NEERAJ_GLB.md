# Neeraj AI — Ready Player Me GLB pipeline

Ready Player Me is being used here as the **3D avatar rig/runtime foundation**, not as a claim that the stock avatar is an exact photographic copy of Neeraj.

## What the reference gives us

The Ready Player Me `visage` project demonstrates loading GLB avatars directly in a Three.js/React web scene. Its `Avatar` component accepts a GLB model source and animation sources. The Ready Player Me animation library contains 200+ motion-captured animations retargeted to its masculine/feminine armatures.

References:
- https://github.com/readyplayerme/visage
- https://github.com/readyplayerme/animation-library

## Neeraj-specific asset requirement

The production asset must be a GLB built from the approved Neeraj references and then rigged to a Ready Player Me-compatible humanoid skeleton. The repository already contains the approved visual/voice references under `assets_private/`.

Required production file:

`public/avatar/avatar.glb`

The renderer will also accept a remote GLB using:

`VITE_NEERAJ_GLB_URL=https://.../neeraj-avatar.glb`

## Recommended creation pipeline

1. Create the closest possible male base avatar with the Ready Player Me creator.
2. Export/download the GLB.
3. In Blender or another 3D package, use the approved Neeraj face/body references to refine the model. Do not replace Neeraj's identity with a generic avatar.
4. Preserve a humanoid skeleton and facial morph targets/blendshapes.
5. Add or retarget the Ready Player Me animation set for idle, talking, gestures, walking, dance and activity modes.
6. Add wardrobe variants as separate meshes/materials or compatible wearable assets while keeping the same underlying Neeraj identity and skeleton.
7. Export a web-optimized GLB to `public/avatar/avatar.glb`.
8. Verify the GLB in the existing Three.js renderer before enabling the production status.

## Runtime contract

The browser renderer now:

- loads `/avatar/avatar.glb` by default;
- supports `VITE_NEERAJ_GLB_URL` for a generated/hosted GLB;
- can optionally load the public Ready Player Me Visage male GLB with `VITE_RPM_PREVIEW=true` for rig/runtime testing;
- reads embedded GLB animations and starts an idle/standing animation;
- drives facial morphs where the model exposes compatible morph targets;
- drives head, spine and arm motion from the existing Neeraj performance director;
- keeps the technical hologram fallback clearly labelled as test mode.

## Important identity note

Ready Player Me's standard avatar system is a stylized 3D avatar platform. It is excellent for a rigged, interactive GLB and animation system, but a stock Ready Player Me avatar should **not** be presented as an exact photorealistic Neeraj digital double. For the final identity match, the generated/edited GLB must be based on Neeraj's approved references and reviewed for face, body proportions, hair, skin, hands and other identifying visual details.

## Status labels

- `NEERAJ GLB ONLINE` = a configured Neeraj GLB loaded successfully.
- `READY PLAYER ME RIG PREVIEW` = only the public RPM sample is being used for technical validation.
- `AVATAR TEST MODE` = no production GLB was available.
