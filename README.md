# NEERAJ AI — Human Hologram

TypeGPU/WebGPU + React + Three.js foundation for a high-fidelity Neeraj Kapil AI digital human.

## Product modes

### Career Coach Profile
A polished professional identity screen using the approved Neeraj reference image and the supplied blue/neon visual direction.

### AI Career Companion / Video Call
The production path is wired for a real-time high-fidelity digital-human call using Tavus CVI when a provider account is available. The UI opens the returned conversation inside the Neeraj hologram stage.

The local pipeline remains available as a development fallback:

`voice/text -> STT -> Neeraj persona -> LLM -> cloned/synthesized Neeraj voice -> lip/face animation -> avatar/video presentation`

## Free real-human avatar bridge

The repository now includes `public/neeraj-ai-avatar-demo.html` as a no-signup/manual bridge for a generated Neeraj talking-head clip.

## Implemented foundation

- TypeGPU/WebGPU holographic background
- Three.js full-body GLB loader at `public/avatar/avatar.glb`
- Morph-target / viseme hook
- Blinking, expressions and gesture command interface
- Profile vs live AI Career Companion UI
- Embedded real-time Tavus video-call surface
- WebSocket brain pipeline
- Responsive neon-blue career-coach screen
- Natural breathing and speaking-weight motion
- Audio-reactive wave track
- Runtime voice/audio bridge scripts packaged for Vite

## Persona

The AI persona is warm, happy-go-lucky, empathetic, strategic, globally aware and professionally polished. It adapts its communication style to career coaching, interviews, LinkedIn, emotional conversations, relationships, casual chat and technical/global topics.

## High-fidelity replica

The production integration is designed around an authorized personal Neeraj digital-human representation trained from suitable real footage. A production provider can supply natural facial movement, turn-taking, multilingual support and real-time video. Self-hosted face/lip animation can provide generated speech performance when suitable compute is available.

## Identity note

The goal is high-fidelity likeness, not a misleading claim of a mathematically exact copy. The supplied identity/voice references are intended for this project.

## Sandbox build trigger

Packaging validation trigger: runtime scripts under `public/` must be present in the Vite production artifact.
