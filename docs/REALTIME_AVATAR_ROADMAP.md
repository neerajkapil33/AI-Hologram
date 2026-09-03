# Neeraj AI — Realtime Full-Body Avatar Roadmap

## Target
A realtime career-advisor digital double using the existing Neeraj reference image/video/voice assets, with conversational AI, streaming speech, semantic facial/body performance, and WebRTC delivery.

## Current architecture
Browser → realtime session → STT/LLM → Performance Director → TTS/avatar renderer → WebRTC → browser.

## Existing building blocks
- `backend/brain.py`: Neeraj AI conversational persona and LLM routing.
- `backend/performance.py`: semantic performance director for emotion, expression, gesture, head, body and gaze.
- `backend/tavus.py`: server-side Tavus realtime conversation adapter.
- `src/useHologramBrain.ts`: realtime browser/backend messaging and audio handling.
- `src/AvatarEngine.tsx`: Three.js full-body runtime with GLB animation/morph-target support and semantic performance commands.
- `assets_private/neeraj-reference.mp4`: body/facial reference.
- `assets_private/neeraj-voice-reference.wav`: voice reference.
- `assets_private/Neeraj.png` and `assets_private/neeraj.jpg`: visual references.

## Production avatar requirement
A reference MP4 and voice sample are source assets; they do not by themselves create a production neural digital human. The realtime photorealistic stage requires either:
1. a configured realtime avatar provider/session (Tavus/HeyGen-compatible), or
2. a separately hosted custom neural avatar renderer with a rigged/animated Neeraj model.

The application must never silently claim that a fallback Three.js test model is the photorealistic Neeraj clone.

## Performance goals
- Stream response text as early as possible.
- Start TTS/avatar generation before the complete response is unnecessarily buffered.
- Support interruption/barge-in.
- Keep WebRTC transport separate from provider credentials.
- Preserve the custom hologram path as a fallback.

## Acceptance criteria
- User can start an avatar session from the dashboard.
- Microphone input reaches the realtime session.
- Assistant response is generated using the Neeraj persona.
- Avatar speech is synchronized with generated audio/video.
- Semantic performance controls expression, gesture, posture and gaze.
- Language selection changes response/voice language where the selected provider supports it.
- UI clearly identifies AI disclosure and connection state.
- CI must pass before a deployment is called ready.
