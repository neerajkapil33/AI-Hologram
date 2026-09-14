import os
import io
from pathlib import Path

import torch
import torchaudio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from chatterbox.tts import ChatterboxTTS

app = FastAPI(title="Neeraj Chatterbox Voice")

# The Vite client runs on a different localhost port during development.
# Allow only the local development origins needed by this app.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DEFAULT_REFERENCE = Path(__file__).resolve().parents[1] / "assets_private" / "neeraj-voice-reference.wav"
REFERENCE = Path(
    os.getenv("NEERAJ_VOICE_REFERENCE", str(DEFAULT_REFERENCE))
).expanduser().resolve()

print(f"Loading Chatterbox on {DEVICE}...")
print(f"Voice reference: {REFERENCE}")

model = ChatterboxTTS.from_pretrained(device=DEVICE)


class SpeechRequest(BaseModel):
    input: str
    voice: str | None = None
    language_id: str | None = "en"
    response_format: str | None = "wav"


@app.get("/health")
def health():
    return {
        "status": "ok",
        "engine": "chatterbox",
        "device": DEVICE,
        "reference": str(REFERENCE),
        "reference_exists": REFERENCE.is_file(),
    }


@app.post("/v1/audio/speech")
def speech(request: SpeechRequest):
    text = request.input.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Speech input is empty")
    if not REFERENCE.is_file():
        raise HTTPException(
            status_code=500,
            detail=f"Voice reference not found: {REFERENCE}",
        )

    try:
        wav = model.generate(
            text,
            audio_prompt_path=str(REFERENCE),
            exaggeration=0.5,
            cfg_weight=0.5,
            temperature=0.8,
            repetition_penalty=1.2,
            min_p=0.05,
            top_p=1.0,
        )
        wav = wav.detach().cpu()
        if wav.ndim == 1:
            wav = wav.unsqueeze(0)

        buffer = io.BytesIO()
        torchaudio.save(buffer, wav, model.sr, format="wav")
        return Response(content=buffer.getvalue(), media_type="audio/wav")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Chatterbox synthesis failed: {exc}") from exc
