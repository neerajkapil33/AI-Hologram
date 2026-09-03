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

Workflow:

1. Use an external free lip-sync generator with the authorized Neeraj reference photo/video and approved voice/audio.
2. Generate a short talking-head MP4.
3. Open the repository's `neeraj-ai-avatar-demo.html` page and load the generated MP4.
4. The generated clip is displayed as the Neeraj AI talking avatar.

The bridge intentionally does **not** replay `assets_private/neeraj-reference.mp4`. That video remains source material for generating a new performance.

This is the free path for obtaining an actual human-looking talking result without pretending that a free unlimited real-time avatar API exists. The same presentation surface can later be connected to a real-time avatar stream.

## Reference-asset policy

`assets_private/neeraj-reference.mp4` is **source material only** for avatar generation/preparation. The application must not simply copy, loop or present that reference video as an AI answer. New responses should be generated from the user's question and synthesized speech.

The approved voice reference is `assets_private/neeraj-voice-reference.wav`. The approved identity reference is `assets_private/neeraj.jpg`.

## Implemented foundation

- TypeGPU/WebGPU holographic background
- Three.js full-body GLB loader at `public/avatar/avatar.glb`
- Morph-target / viseme hook
- Blinking, expressions and gesture command interface
- Profile vs live AI Career Companion UI
- Embedded real-time Tavus video-call surface
- Server-side Tavus conversation creation; API key never reaches the browser
- WebSocket brain pipeline
- Anthropic/Ollama persona layer
- Selected-language propagation from UI -> LLM -> TTS and live-call context
- OpenAI-compatible TTS adapter for the approved voice reference
- MuseTalk adapter that prepares generated lip-synced output from the approved reference video
- Free generated-clip avatar bridge at `public/neeraj-ai-avatar-demo.html`
- Responsive neon-blue career-coach screen based on the supplied visual direction
- Explicit AI-representation disclosure

## High-fidelity replica

The production integration is designed around an authorized personal Neeraj digital-human representation trained from suitable real footage. A production provider can supply natural facial movement, turn-taking, multilingual support and real-time video. Self-hosted MuseTalk can provide generated lip-synced face animation when a suitable GPU is available; it does not by itself provide unrestricted full-body human motion.

## Persona

The AI persona is warm, happy-go-lucky, empathetic, strategic, globally aware and professionally polished. It adapts its communication style to career coaching, interviews, LinkedIn, emotional conversations, relationships, casual chat and technical/global topics. It must not invent Neeraj's biography or claim to be the biological Neeraj.

The system can infer conversational cues, but it does not claim to read a user's private emotions or physiological pulse without an explicit data source.

## Production requirements

A fully automated real-time human-looking video call still requires either a real-time avatar provider account/API or a GPU-hosted avatar stack. The repository is prepared for that integration without changing the core UI/persona architecture.

For a provider integration, configure its server-side credentials and identity/persona identifiers through deployment environment variables. Never commit API keys to GitHub or paste them into chat.

## Important identity note

The goal is **high-fidelity likeness**, not a misleading claim of a mathematically exact copy. The product is an AI representation of Neeraj Kapil and should be presented as such. The user has explicitly authorized use of the supplied identity/voice references for this project.

The repository is the source-of-truth destination for continued development.
