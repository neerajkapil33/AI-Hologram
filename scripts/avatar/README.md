# Neeraj Avatar Generation

The production avatar must preserve the approved Neeraj identity reference at `assets_private/neeraj.jpg`. The application must never silently replace it with a generic avatar.

## Route A — AvatarSDK automation

The repository contains `avatarsdk_generate.py`, which uses AvatarSDK's official OAuth/API flow to turn the master photo into a GLB. AvatarSDK requires account-bound developer credentials; these cannot be manufactured by the repository or by GitHub Actions.

Required GitHub Actions secrets:

- `AVATARSDK_CLIENT_ID`
- `AVATARSDK_CLIENT_SECRET`

The generated file is written to `public/avatar/avatar.glb` and then validated.

## Route B — credential-free GLB ingestion

The GitHub workflow now accepts an already-exported production GLB. Put it at:

`public/avatar/avatar.glb`

Then run the **Build Neeraj AI Avatar** workflow. `validate_glb.py` checks that the asset is a GLB v2, contains a mesh, contains a skeleton/skin, and contains facial morph targets. Baked animation clips are optional because the AI-Hologram runtime already drives gestures procedurally.

This route is intentionally strict: a generic Ready Player Me/demo avatar is not considered a valid replacement for Neeraj.

## Best no-credential generation candidate

For a truly self-hosted alternative, HumanNOVA is an open-source 2026 single-image photorealistic human reconstruction project. It is GPU-oriented and is a reconstruction stage, not a drop-in replacement for AvatarSDK's complete facial-viseme production pipeline. It can therefore be integrated as a separate generation worker later rather than pretending it already produces the exact runtime contract.

The same principle applies to other open-source image-to-3D systems: they can generate geometry, but the Neeraj runtime additionally needs a usable humanoid rig and facial morph targets for real-time expressions and lip-sync.

## Runtime contract

`src/AvatarEngine.tsx` loads `/avatar/avatar.glb`. Once a valid GLB is present, the existing Three.js runtime handles sizing, lighting, blinking, expressions, visemes, gaze, head motion, body motion, and gestures. Do not replace that working behavior merely to change the avatar-generation provider.
