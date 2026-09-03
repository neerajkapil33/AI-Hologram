# Neeraj AI — Ready Player Me GLB pipeline

Ready Player Me is being used here as the **3D avatar rig/runtime foundation and GLB-processing reference**, not as a claim that the stock avatar is an exact photographic copy of Neeraj.

## What the references give us

The Ready Player Me `visage` project demonstrates loading GLB avatars directly in a Three.js/React web scene. Its avatar component accepts a GLB model source and animation sources. The Ready Player Me Unity SDK Core repository documents avatar creation/loading and its use of glTFast for GLB/glTF handling. The animation library provides motion-captured clips retargeted to compatible humanoid armatures.

References:
- https://github.com/readyplayerme/visage
- https://github.com/readyplayerme/animation-library
- https://github.com/readyplayerme/rpm-unity-sdk-core
- Detailed processing contract: `docs/RPM_GLB_PROCESSING_REFERENCE.md`

## Neeraj full-body reference

The approved full-body reference supplied for this project is now part of the avatar creation target. It provides the target silhouette, body proportions, face, hairstyle, hands, legs and footwear for the production model. The model must preserve Neeraj's recognizable identity while allowing clothing/presentation variants.

The repository also contains the approved visual/voice references under `assets_private/`.

## Neeraj-specific asset requirement

The production asset must be a GLB built from the approved Neeraj references and then rigged to a Ready Player Me-compatible humanoid skeleton.

Required production file:

`public/avatar/avatar.glb`

The renderer will also accept a remote GLB using:

`VITE_NEERAJ_GLB_URL=https://.../neeraj-avatar.glb`

## Recommended creation and processing pipeline

1. Create a compatible male humanoid base.
2. Use the supplied Neeraj full-body and face references to refine the mesh, proportions, hair, skin, hands and other visible identity details.
3. Preserve a humanoid skeleton compatible with animation retargeting.
4. Add facial morph targets/blendshapes for blink, smile, jaw/mouth and expressive states.
5. Add or retarget compatible Ready Player Me animation clips for idle, talking, gestures, walking, sitting, dance and activity modes.
6. Add wardrobe variants as separate meshes/materials or compatible wearable assets while keeping the same underlying Neeraj identity and skeleton.
7. Validate the skeleton, morphs, animation clips, materials, textures, scale and origin.
8. Export a web-optimized GLB to `public/avatar/avatar.glb`.
9. Verify the GLB in the existing Three.js renderer before enabling the production status.

## Runtime contract

The browser renderer now:

- loads `/avatar/avatar.glb` by default;
- supports `VITE_NEERAJ_GLB_URL` for a generated/hosted GLB;
- can optionally load the public Ready Player Me Visage male GLB with `VITE_RPM_PREVIEW=true` for rig/runtime testing;
- reads embedded GLB animations and starts an idle/standing animation;
- drives facial morphs where the model exposes compatible morph targets;
- drives head, spine and arm motion from the existing Neeraj performance director;
- keeps the technical hologram fallback clearly labelled as test mode.

## Unity SDK reference — important implementation boundary

`rpm-unity-sdk-core` is a **Unity** package. We use it as a reference for avatar creation/loading and GLB/glTF processing behavior; we do not add Unity dependencies to the React/Vite browser build. The web application continues to use Three.js `GLTFLoader` for runtime loading.

The processing/validation checklist derived from this reference is documented in `docs/RPM_GLB_PROCESSING_REFERENCE.md`.

## Important identity note

Ready Player Me's standard avatar system is a stylized 3D avatar platform. It is excellent for a rigged, interactive GLB and animation system, but a stock Ready Player Me avatar should **not** be presented as an exact photorealistic Neeraj digital double. For the final identity match, the generated/edited GLB must be based on Neeraj's approved references and reviewed for face, body proportions, hair, skin, hands and other identifying visual details.

## Status labels

- `NEERAJ GLB ONLINE` = a configured Neeraj GLB loaded successfully.
- `READY PLAYER ME RIG PREVIEW` = only the public RPM sample is being used for technical validation.
- `AVATAR TEST MODE` = no production GLB was available.
