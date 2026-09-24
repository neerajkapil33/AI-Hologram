# Neeraj AI — Realtime Full-Body Avatar Roadmap

## Target
A realtime career-advisor digital double using the existing Neeraj reference image/video/voice assets, with conversational AI, streaming speech, semantic facial/body performance, and browser FBX delivery plus optional WebRTC video.

## Current architecture
Browser → realtime session → STT/LLM → Performance Director → TTS/avatar renderer → WebRTC → browser.

## Existing building blocks
- `backend/brain.py`: Neeraj AI conversational persona and LLM routing.
- `backend/performance.py`: semantic performance director for emotion, expression, gesture, head, body and gaze.
- `backend/tavus.py`: server-side Tavus realtime conversation adapter.
- `src/useHologramBrain.ts`: realtime browser/backend messaging and audio handling.
- `src/AvatarEngine.tsx`: Three.js/WebGL full-body runtime using the production `public/avatar/model.fbx`, its 73-bone rig, facial morphs and semantic performance commands.
- `assets_private/neeraj-reference.mp4`: body/facial reference.
- `assets_private/neeraj-voice-reference.wav`: voice reference.
- `assets_private/Neeraj.png` and `assets_private/neeraj.jpg`: visual references.

## Production avatar requirement
The reference MP4 and voice sample are source assets. The production browser digital human is the rigged FBX asset. The realtime photorealistic stage requires either:
1. the production browser FBX avatar for the standard AURA experience, or
2. a configured realtime avatar provider/session such as Tavus for the optional live-video experience.

The application must never silently claim that a fallback Three.js test model is the photorealistic Neeraj clone.

## Performance goals
- Stream response text as early as possible.
- Start TTS/avatar generation before the complete response is unnecessarily buffered.
- Support interruption/barge-in.
- Keep WebRTC transport for optional provider video separate from provider credentials.
- Preserve the custom hologram path as a fallback.

## Acceptance criteria
- User can start an avatar session from the dashboard.
- Microphone input reaches the realtime session.
- Assistant response is generated using the Neeraj persona.
- Avatar speech is synchronized with generated audio/video.
- Semantic performance controls expression, gesture, posture and gaze on the FBX rig.
- Language selection changes response/voice language where the selected provider supports it.
- UI clearly identifies AI disclosure and connection state.
- CI must pass before a deployment is called ready.
