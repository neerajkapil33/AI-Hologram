# Neeraj AI Avatar — architecture and implementation contract

This project uses a compositional digital-human pipeline. Open-source projects are used as engineering references/components; their unrelated application shells are not copied into the product.

## Target pipeline

```text
Approved Neeraj photo/video
        |
        v
Identity reconstruction
  HumanNOVA / modern human reconstruction
        |
        v
Textured full-body mesh
        |
        +--> facial identity / texture reference
        |
        v
Humanoid rig + skin weights
  Make-It-Animatable / AvatarForge patterns
        |
        v
Facial rig
  ARKit 52 + Oculus/15-class visemes
        |
        v
Production GLB
  public/avatar/avatar.glb
        |
        +------------------------------+
        |                              |
        v                              v
Three.js runtime                 AI conversation brain
AvatarEngine                     STT -> LLM -> TTS
        |                              |
        +--> gaze/blink                +--> audio + viseme timing
        +--> expression                +--> performance events
        +--> gestures                  |
        +--> body animation <----------+
        |
        v
Holographic Neeraj Career Advisor
```

## Responsibilities

### Reconstruction
- Preserve identity from the approved Neeraj reference.
- Reconstruct the complete visible body, not a face-only mesh.
- Recover clothing/hair appearance where the source supports it.
- Generate a watertight or clean renderable mesh with usable UVs/textures.

### Rigging
The final asset must be humanoid and skin-weighted. Core requirements are pelvis/hips, spine/chest, neck/head, upper/lower arms, hands, upper/lower legs and feet. Finger bones are strongly preferred for natural gestures.

### Face
The preferred contract is ARKit 52-compatible facial targets. Oculus/15-class visemes may coexist. Runtime code must use alias matching so exports with naming differences remain compatible.

### Runtime
`AvatarEngine` owns:
- GLB loading and scale normalization
- animation mixer
- facial morph driving
- blinking
- gaze/head motion
- expression state
- procedural gesture layer
- body motion

`useHologramBrain` owns:
- WebSocket conversation transport
- transcription
- assistant response
- streamed audio
- performance events
- avatar-video events when supplied by a backend

The two layers communicate through typed avatar commands; the asset itself contains identity and rigging, while behavior is driven at runtime.

### Motion capture extension
XR Animator / full-body tracking patterns can be connected later through the same bone contract. Camera tracking must never replace the identity asset; it only drives its skeleton and facial controls.

## Asset acceptance gate

`public/avatar/avatar.glb` is production-ready only when it has:

- full-body mesh
- at least one skinned mesh
- humanoid core bones
- facial morph targets
- useful ARKit/viseme-compatible target names
- valid GLB v2 structure
- embedded or resolvable textures
- sensible dimensions/orientation

Baked idle/talk animations are optional because AI-Hologram supplies runtime behavior. A face-only GLB must never be renamed to satisfy the gate.

## Why this architecture

The strongest projects found during GitHub research specialize in different layers: Tex-An Mesh demonstrates the single-image full-body reconstruction flow; HumanNOVA/DiGS-Avatar represent newer reconstruction research; Make-It-Animatable and AvatarForge address rigging; TalkingHead, tts-avatar and SINT demonstrate browser-side facial/lip-sync runtime; XR Animator addresses body/hand/face motion. Combining those contracts is more maintainable than cloning one unrelated repository wholesale.
