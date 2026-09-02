# Neeraj AI — high-fidelity replica setup

The production live-call path uses Tavus CVI because it provides a lifelike Replica, Persona-driven behavior, and a real-time WebRTC conversation room. The browser never receives the Tavus API key.

## 1. Create the personal Replica

Use the Tavus Developer Portal and create a personal Replica from Neeraj's real training footage. For the highest identity fidelity, use clean, real footage of Neeraj rather than AI-generated footage.

Before training, the footage must contain the provider's required consent statement. Tavus currently documents this statement as:

> I, [FULL NAME], am currently speaking and give consent to Tavus to create an AI clone of me by using the audio and video samples I provide. I understand that this AI clone can be used to create videos that look and sound like me.

Use the exact legal name in place of `[FULL NAME]` and follow Tavus's current training requirements. If the existing `assets_private/neeraj-reference.mp4` does not contain the required consent and training format, record a dedicated consent/training clip rather than modifying the existing source asset.

For identity quality, prefer:

- real camera footage of Neeraj
- stable lighting and a clean background
- direct-to-camera framing
- clear natural speech
- full lip closures and natural facial movement
- approximately one minute of natural talking followed by approximately one minute of silence when using the documented Phoenix personal-replica training path
- 1080p H.264 source where practical

The repository's existing reference video is **source material only**. The application does not replay it as the answer video.

## 2. Create the Neeraj AI Persona

Create a Persona whose instructions establish:

- Neeraj AI is an AI representation, not the physical Neeraj.
- Warm, confident, empathetic, approachable executive communication.
- Professional and strategic with career conversations.
- Relaxed, witty and friendly when the user is casual.
- Listen first during emotional conversations.
- Career strategy, leadership, talent acquisition, interviews, resumes, LinkedIn, job search, skills and global opportunities.
- Default English with natural multilingual conversation where supported.
- Never invent private biography or personal experiences.
- Do not claim literal physical identity or private emotions.
- Give qualified guidance for high-stakes legal, medical or financial topics.

The application also supplies a per-session conversational context containing the selected language.

## 3. Add server credentials

Copy `.env.example` to `.env` and fill in:

```text
TAVUS_API_KEY=...
TAVUS_REPLICA_ID=...
TAVUS_PERSONA_ID=...
```

Keep these values server-side. Never put the API key in Vite, React, browser local storage, or public source code.

## 4. Start the application

Backend:

```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Frontend:

```bash
npm install
npm run dev
```

The `VIDEO CALL` button calls `POST /api/tavus/conversation`, and the backend creates a Tavus CVI conversation. The returned conversation URL is embedded into the hologram stage.

## 5. What the app does

```text
User microphone / browser
        |
        v
Tavus CVI conversation
        |
        +--> perception / turn taking / STT
        |
        +--> Neeraj AI Persona + knowledge
        |
        +--> TTS
        |
        v
Phoenix Replica
        |
        v
Real-time WebRTC video call
```

The local WebGPU/TypeGPU AvatarEngine remains available as a development fallback. MuseTalk remains available for generated lip-synced turn videos, but it is not the preferred production live-call renderer.

## 6. Important fidelity boundary

No software can honestly guarantee pixel-for-pixel identity or reproduce a person's private inner state. The goal here is **high-fidelity likeness** using the user's authorized real image/video/voice references, while clearly presenting the result as an AI representation.
