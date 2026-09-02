# NEERAJ AI — Human Hologram

TypeGPU/WebGPU + React + Three.js foundation for a high-fidelity Neeraj Kapil AI digital human.

## Product modes

### Career Coach Profile
A polished professional identity screen using the approved Neeraj reference image and the supplied blue/neon visual direction.

### AI Career Companion / Video Call
The production path is now wired for a real-time high-fidelity digital-human call using Tavus CVI. Tavus combines a lifelike Replica, a behavior Persona, and a real-time WebRTC conversation. The UI opens the returned conversation inside the Neeraj hologram stage.

The local pipeline remains available as a development fallback:

`voice/text -> STT -> Neeraj persona -> LLM -> cloned/synthesized Neeraj voice -> lip/face animation -> avatar/video presentation`

The production call path is:

`user microphone -> Tavus CVI -> Neeraj AI Persona -> TTS -> Phoenix Replica -> WebRTC video call`

## Reference-asset policy

`assets_private/neeraj-reference.mp4` is **source material only** for avatar generation/preparation. The application must not simply copy, loop or present that reference video as an AI answer. New responses are generated from the user's question and synthesized speech.

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
- Responsive neon-blue career-coach screen based on the supplied visual direction
- Explicit AI-representation disclosure

## High-fidelity replica

The production integration is designed around a personal Replica trained from Neeraj's authorized real footage. Tavus documents a short personal-replica training path and real-time CVI with natural facial movement, turn-taking and multilingual support. See `docs/TAVUS_SETUP.md` for the exact setup checklist and consent/training requirements.

## Persona

The AI persona is warm, happy-go-lucky, empathetic, strategic, globally aware and professionally polished. It adapts its communication style to career coaching, interviews, LinkedIn, emotional conversations, relationships, casual chat and technical/global topics. It must not invent Neeraj's biography or claim to be the biological Neeraj.

The system can infer conversational cues, but it does not claim to read a user's private emotions or physiological pulse without an explicit data source.

## Remaining production requirements

1. Create the authorized personal Neeraj Replica in Tavus using suitable real training footage and the required consent statement.
2. Create the Neeraj AI Persona and attach the career-coaching instructions/knowledge.
3. Put `TAVUS_API_KEY`, `TAVUS_REPLICA_ID` and `TAVUS_PERSONA_ID` in the server `.env`.
4. Configure the approved voice-cloning/TTS runtime for the local fallback path.
5. Install and prepare MuseTalk 1.5 on a GPU host if generated lip-synced turn videos are required.
6. Add consent-based inspect/delete controls before enabling persistent conversation memory.
7. Add the final avatar animation library for natural gaze, posture, gestures, dance/spin and other explicitly requested entertainment actions.

## Important identity note

The goal is **high-fidelity likeness**, not a misleading claim of a mathematically exact copy. The product is an AI representation of Neeraj Kapil and should be presented as such. The user has explicitly authorized use of the supplied identity/voice references for this project.

The repository is the source-of-truth destination for continued development.
