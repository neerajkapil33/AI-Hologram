# Neeraj AI — Ready Player Me GLB processing reference

This project uses Ready Player Me as a **reference for humanoid avatar creation/loading and GLB processing**, while the browser runtime remains Three.js/WebGL.

## Reference implementation

The Ready Player Me Unity SDK Core repository describes its core integration as providing avatar loading and creation functionality and managing the Avatar Loader and glTFast dependencies. Its quick-start documentation shows the package importing Ready Player Me Core, WebView and glTFast.

Reference repositories:

- https://github.com/readyplayerme/rpm-unity-sdk-core
- https://github.com/readyplayerme/visage
- https://github.com/readyplayerme/animation-library

## How we apply the reference here

We do **not** add the Unity SDK to the React/Vite web application. Instead, we carry over the useful asset-processing principles:

1. Treat the GLB as the canonical packaged avatar asset.
2. Keep avatar loading asynchronous and failure-tolerant.
3. Preserve the humanoid skeleton when processing the asset.
4. Preserve facial morph targets/blendshapes where available.
5. Keep embedded textures/materials and animations inside the final GLB where practical.
6. Validate the exported GLB before enabling the production avatar status.
7. Keep avatar creation/processing separate from the browser presentation/runtime layer.

The web renderer uses Three.js `GLTFLoader` and does not depend on Unity or glTFast at runtime.

## Neeraj-specific processing contract

Input references:

- `assets_private/Neeraj.png`
- `assets_private/neeraj.jpg`
- `assets_private/neeraj-reference.mp4`
- `assets_private/neeraj-voice-reference.wav`

Production output:

- `public/avatar/avatar.glb`

The uploaded full-body reference establishes the target proportions and appearance for the avatar: head/face, hairstyle, torso, arms/hands, legs, footwear and overall body silhouette. The model must remain recognizably Neeraj while clothing and presentation can change at runtime.

## GLB validation checklist

Before marking the avatar `NEERAJ GLB ONLINE`, verify:

- GLB loads without console/network errors.
- A humanoid armature is present.
- Head, neck, spine, pelvis, upper/lower arms, hands, thighs, calves and feet can be resolved or retargeted.
- Facial morph targets are present when the source model supports them.
- At least one idle/standing animation is embedded or supplied separately.
- Animation clips can be played without exploding the skeleton or producing extreme joint offsets.
- Textures/materials render correctly under the hologram lighting.
- Feet remain grounded at the chosen avatar scale.
- The avatar faces the camera correctly and has a sensible origin/pivot.
- The final file is web-optimized and does not contain unnecessary editor-only data.

## Animation contract

The final asset should support, either as embedded clips or retargetable external clips:

- idle / breathing
- speaking / conversational body motion
- greeting / wave
- nod / acknowledgement
- explanation / open-hand gestures
- pointing / emphasis / enumeration
- walking and spatial movement
- sitting and standing
- fitness/exercise demonstrations
- sport demonstrations
- dance
- presentation/teaching
- celebration

Ready Player Me's animation library is used as a **motion reference/retargeting source** where compatible; it does not replace the Neeraj identity mesh.

## Identity rule

A stock Ready Player Me avatar is only a technical rig/runtime test. It must never be labelled as the real Neeraj avatar.

The production GLB must be generated/refined from the approved Neeraj visual references and then rigged for animation. The browser may report `NEERAJ GLB ONLINE` only after that Neeraj-specific GLB has actually loaded successfully.

## Blender handoff

Recommended processing order:

`Neeraj full-body reference → base humanoid model → Neeraj face/body refinement → humanoid rig → facial morphs → animation retargeting → wardrobe variants → GLB export → Three.js validation`

Blender is the preferred authoring/export stage for this repository because it can package the completed rig, meshes, materials and animations into a single `.glb` file. The resulting binary belongs at `public/avatar/avatar.glb` and should be tested by the existing `src/AvatarEngine.tsx` loader.
