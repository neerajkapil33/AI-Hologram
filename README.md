# NEERAJ AI — Human Hologram

TypeGPU/WebGPU + React + Three.js foundation for a high-fidelity Neeraj Kapil AI digital human.

## Product modes

### Career Coach Profile
A polished professional identity screen using the approved Neeraj reference image and the supplied blue/neon visual direction.

### AI Career Companion / Video Call
A live interactive digital human. The pipeline is designed as:

`voice/text -> STT -> Neeraj persona -> LLM -> cloned/synthesized Neeraj voice -> lip/face animation -> avatar/video presentation`

The UI switches into the live companion when the user chooses **AI Career Companion** or **VIDEO CALL**.

## Reference-asset policy

`assets_private/neeraj-reference.mp4` is **source material only** for avatar generation/preparation. The application must not simply copy, loop or present that reference video as an AI answer. New responses are generated from the user's question and synthesized speech.

The approved voice reference is `assets_private/neeraj-voice-reference.wav`. The approved identity reference is `assets_private/neeraj.jpg`.

## Implemented foundation

- TypeGPU/WebGPU holographic background
- Three.js full-body GLB loader at `public/avatar/avatar.glb`
- Morph-target / viseme hook
- Blinking, expressions and gesture command interface
- Profile vs live AI Career Companion UI
- Video-call presentation surface for generated avatar video
- WebSocket brain pipeline
- Anthropic/Ollama persona layer
- Selected-language propagation from UI -> LLM -> TTS
- OpenAI-compatible TTS adapter for the approved voice reference
- MuseTalk adapter that prepares generated lip-synced output from the approved reference video
- Responsive neon-blue career-coach screen based on the supplied visual direction
- Explicit AI-representation disclosure

## Persona

The AI persona is warm, happy-go-lucky, empathetic, strategic, globally aware and professionally polished. It adapts its communication style to career coaching, interviews, LinkedIn, emotional conversations, relationships, casual chat and technical/global topics. It must not invent Neeraj's biography or claim to be the biological Neeraj.

The system can infer conversational cues, but it does not claim to read a user's private emotions or physiological pulse without an explicit data source.

## Remaining production requirements

1. Generate/rig the final high-fidelity Neeraj full-body GLB from the approved references, including face, hands, shoes, clothing and watch.
2. Configure the approved voice-cloning/TTS runtime and voice reference.
3. Install and prepare MuseTalk 1.5 on a GPU host for generated lip-synced video mode.
4. Connect production STT and streaming audio/video transport.
5. Add consent-based inspect/delete controls before enabling persistent conversation memory.
6. Add the final avatar animation library for natural gaze, posture, gestures, dance/spin and other explicitly requested entertainment actions.

## Important identity note

The goal is high-fidelity likeness and behavior, but software should not claim a mathematically exact copy of a real person. The product is an AI representation of Neeraj Kapil and should be presented as such.

The repository is the source-of-truth destination for continued development.
