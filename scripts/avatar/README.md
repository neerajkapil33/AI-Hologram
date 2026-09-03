# Neeraj Avatar Generation

This directory is reserved for the production photo-to-avatar stage.

Reference implementation: AvatarSDK Web API. The API accepts a front-facing photo and can return a rigged GLB/glTF with facial blendshapes/visemes. Credentials must remain server-side/GitHub Actions secrets.

The production pipeline must never substitute a generic avatar. The approved Neeraj identity reference is `assets_private/neeraj.jpg`.

Required GitHub Actions secrets when the AvatarSDK API is enabled:
- `AVATARSDK_CLIENT_ID`
- `AVATARSDK_CLIENT_SECRET`

The generated binary is intended to become `public/avatar/avatar.glb` after validation.
