# Neeraj AI Avatar — production stack

The repository is the source of truth for the Neeraj AI Career Companion. The runtime must use Neeraj's approved identity assets and must never silently substitute a generic avatar.

## Selected open-source building blocks

The implementation is intentionally compositional rather than cloning an entire unrelated application.

### 1. Face reconstruction reference

`arturwyroslak/face-to-blendshape-3d` is used by `generate_photo_glb.mjs` for a credential-free photo-driven facial GLB. Its useful contract is browser-side reconstruction, embedded texture, Three.js rendering and facial morph targets.

Output: `public/avatar/neeraj-face.glb`.

This is a **facial reference asset**, not the production full-body avatar.

### 2. Full-body GLB runtime contract

The production asset is `public/avatar/avatar.glb` and must contain:

- humanoid mesh/body
- skin/skeleton
- facial morph targets
- preferably ARKit 52 and/or Oculus visemes
- optional baked body animations

The runtime contract is intentionally compatible with the patterns used by `met4citizen/TalkingHead` and `tenjerma/tts-avatar`: a custom GLB supplies the identity while the application supplies TTS, visemes, blinking, gaze, expressions and body motion.

Ready Player Me is **not** used as a generation dependency. Older TalkingHead forks still document it, but the public Ready Player Me platform shut down in January 2026.

### 3. Rigging / facial animation reference

`Altageris/avatarforge` is the selected reference for the production rig contract: humanoid skeleton, body joints, facial morphs and Oculus-style visemes. Its techniques can be used when converting the reconstructed Neeraj body into the final GLB.

### 4. Reconstruction worker

`HumanNOVA/HumanNOVA` is the preferred open-source research route for photorealistic single-image full-human reconstruction. It is GPU-oriented and therefore kept as a reconstruction worker rather than pretending that a normal GitHub-hosted CPU runner can produce a production-quality result.

### 5. Motion/runtime reference

`ubemotho/XR-MoCap` is the reference for webcam-driven full-body/hand/face motion capture. The web runtime remains responsible for applying compatible motion to the Neeraj rig.

## Production generation routes

### Route A — existing production GLB

Place the completed identity-preserving full-body GLB at:

`public/avatar/avatar.glb`

Then run the avatar validation workflow. The validator rejects assets without a mesh, skin/skeleton or facial morph targets.

### Route B — AvatarSDK

`avatarsdk_generate.py` remains available for account-authorized generation. It requires real developer credentials supplied as GitHub Actions secrets:

- `AVATARSDK_CLIENT_ID`
- `AVATARSDK_CLIENT_SECRET`

Credentials cannot be manufactured by this repository.

### Route C — self-hosted reconstruction worker

Use HumanNOVA (or an equivalent current reconstruction model) on a CUDA machine to reconstruct the full body from the approved Neeraj image/video frame, then pass the mesh through a humanoid rig + facial blendshape stage. The resulting GLB must satisfy the production validator before being copied to `public/avatar/avatar.glb`.

## Runtime

`src/AvatarEngine.tsx` now follows the custom-GLB contract:

- loads only the configured Neeraj production GLB
- no Ready Player Me fallback
- no generic procedural avatar fallback
- supports ARKit/Oculus-style mouth aliases
- autonomous blinking
- gaze/head movement
- expression states
- procedural body/arm gestures
- optional baked GLB animation clips

`src/useHologramBrain.ts` supplies streamed audio and performance events. `src/App.tsx` maps the live audio level to the mouth-open channel while the avatar runtime handles the face/body animation.

## Acceptance gate

A project is **not** considered production-complete until `public/avatar/avatar.glb` is a real Neeraj full-body rigged asset and passes:

```bash
python scripts/avatar/validate_glb.py public/avatar/avatar.glb
```

Do not rename a face-only GLB to `avatar.glb` to bypass this gate.
