import os
import torch
import torchaudio
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from chatterbox.tts import ChatterboxTTS

app = FastAPI(title="Neeraj Chatterbox Voice")

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
REFERENCE = os.path.abspath(
    os.getenv(
        "NEERAJ_VOICE_REFERENCE",
        "assets_private/neeraj-voice-reference.wav",
    )
)

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
        "reference_exists": os.path.exists(REFERENCE),
    }


@app.post("/v1/audio/speech")
def speech(request: SpeechRequest):
    if not os.path.exists(REFERENCE):
        raise HTTPException(
            status_code=500,
            detail=f"Voice reference not found: {REFERENCE}",
        )

    try:
        wav = model.generate(
            request.input,
            audio_prompt_path=REFERENCE,
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

        import io
        buffer = io.BytesIO()
        torchaudio.save(buffer, wav, model.sr, format="wav")

        return Response(
            content=buffer.getvalue(),
            media_type="audio/wav",
        )

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))