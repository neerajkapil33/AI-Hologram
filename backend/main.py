import asyncio
import base64
import json
import os
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .brain import Brain
from .performance import PerformanceDirector
from .motor_brain import MotorBrain
from .stt import STT
from .tavus import Tavus
from .tts import TTS

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
AVATAR_MODEL = Path(
    os.getenv(
        "AVATAR_MODEL_PATH",
        str(ROOT / "public" / "avatar" / "model.fbx"),
    )
).expanduser().resolve()

app = FastAPI(
    title=os.getenv("APP_NAME", "Neeraj Kapil Hologram"),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core conversational services.
#
# The 3D avatar is rendered in the browser by src/AvatarEngine.tsx from
# public/avatar/model.fbx. The backend sends audio and performance metadata;
# it does not render the FBX and does not run MuseTalk for the 3D avatar.
brain = Brain()
tts = TTS()
stt = STT()
tavus = Tavus()
performance = PerformanceDirector()
motor_brain = MotorBrain()


@app.get("/health")
async def health():
    return {
        "ok": True,
        "avatar_engine": "threejs_fbx",
        "avatar_model": str(AVATAR_MODEL),
        "avatar_model_exists": AVATAR_MODEL.is_file(),
        "tts": bool(os.getenv("TTS_URL")),
        "tts_voice_reference": tts.voice_reference,
        "tavus": tavus.configured,
        "persona": "neeraj-ai-career-companion",
        "brain_provider": brain.provider,
        "brain_online_capable": brain.online,
        "brain_offline_fallback": True,
        "brain_last_error": brain.last_error,
        "performance_director": True,
        "motor_brain": True,
        "motor_brain_mode": "semantic_goal_to_posture_plan",
        "motor_brain_knowledge": list(MotorBrain.KNOWLEDGE.keys()),
        "capabilities": [
            "conversation",
            "multilingual",
            "voice",
            "lip_sync",
            "facial_expression",
            "gesture",
            "full_body_performance",
            "AI_ML",
            "mathematics",
            "science",
            "medical_science",
            "research",
            "Hindu_literature",
            "politics_neutral",
            "markets",
            "corporate",
            "startup_design",
            "software_creation",
        ],
    }


@app.post("/api/tavus/conversation")
async def tavus_conversation(payload: dict | None = None):
    """Create a real-time Tavus CVI room; the Tavus secret stays on the backend."""
    payload = payload or {}
    language = str(payload.get("language", "en-IN"))
    return await asyncio.to_thread(tavus.create_conversation, language)


@app.post("/api/performance")
async def performance_direct(payload: dict | None = None):
    """Return animation-neutral performance metadata for the 3D browser avatar."""
    payload = payload or {}
    return performance.direct(str(payload.get("text", ""))).__dict__


@app.websocket("/ws")
async def ws(websocket: WebSocket):
    await websocket.accept()
    history: list[dict[str, str]] = []

    try:
        while True:
            data = json.loads(await websocket.receive_text())
            message_type = data.get("type")
            language = str(data.get("language", "en-IN"))

            if message_type == "text":
                user_text = str(data.get("text", "")).strip()

            elif message_type == "audio":
                raw = base64.b64decode(data.get("audio", ""))
                with tempfile.NamedTemporaryFile(
                    suffix=".webm",
                    delete=False,
                ) as temp_file:
                    temp_file.write(raw)
                    audio_input_path = temp_file.name

                try:
                    user_text = await asyncio.to_thread(
                        stt.transcribe,
                        audio_input_path,
                    )
                finally:
                    try:
                        os.unlink(audio_input_path)
                    except OSError:
                        pass

                await websocket.send_json(
                    {
                        "type": "transcription",
                        "text": user_text,
                    }
                )

            else:
                continue

            if not user_text:
                continue

            history.append(
                {
                    "role": "user",
                    "content": user_text,
                }
            )

            answer = await asyncio.to_thread(
                brain.reply,
                history,
                language,
            )

            history.append(
                {
                    "role": "assistant",
                    "content": answer,
                }
            )

            # PerformanceDirector produces instructions for the browser-side
            # AvatarEngine.tsx: expression, gesture, head, body, gaze and
            # intensity. It deliberately does not render video.
            performance_data = await asyncio.to_thread(
                performance.direct,
                answer,
            )
            # The motor brain receives the user's explicit physical intent as
            # well as the language-model answer. This prevents a conversational
            # reply from erasing a concrete command such as "sit on the chair".
            performance_data = await asyncio.to_thread(
                motor_brain.apply,
                user_text,
                performance_data,
            )

            await websocket.send_json(
                {
                    "type": "message",
                    "role": "assistant",
                    "content": answer,
                }
            )

            await websocket.send_json(
                {
                    "type": "performance",
                    "performance": performance_data.__dict__,
                }
            )

            # TTS remains independent from the FBX renderer. The generated
            # audio is played by the browser and its amplitude drives the
            # browser-side mouth/viseme controller.
            audio_path = await asyncio.to_thread(
                tts.synthesize,
                answer,
                language,
            )

            if audio_path:
                audio_file = Path(audio_path)
                audio_mime = (
                    "audio/mpeg"
                    if audio_file.suffix.lower() == ".mp3"
                    else "audio/wav"
                )

                await websocket.send_json(
                    {
                        "type": "audio",
                        "audio": base64.b64encode(
                            audio_file.read_bytes()
                        ).decode(),
                        "mime": audio_mime,
                    }
                )

                try:
                    audio_file.unlink(missing_ok=True)
                except OSError:
                    pass

            await websocket.send_json({"type": "done"})

    except WebSocketDisconnect:
        return
