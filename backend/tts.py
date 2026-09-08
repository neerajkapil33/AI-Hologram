import os
import tempfile
from pathlib import Path

import httpx


class TTS:
    """Chatterbox-first speech adapter with Neeraj voice-reference support."""

    def __init__(self):
        self.url = os.getenv("TTS_URL", "").rstrip("/")
        self.voice_reference = os.getenv(
            "TTS_VOICE",
            "file:///voices/neeraj-voice-reference.wav",
        )

    def synthesize(self, text, language=None):
        lang = language or os.getenv("TTS_LANGUAGE", "en")
        # Chatterbox/custom TTS is preferred when configured. The reference WAV is
        # passed on every request so the configured service can perform voice cloning.
        if self.url:
            try:
                payload = {
                    "input": text,
                    "voice": self.voice_reference,
                    "language_id": lang,
                    "response_format": "wav",
                }
                response = httpx.post(
                    self.url + "/v1/audio/speech",
                    json=payload,
                    timeout=180,
                )
                response.raise_for_status()
                path = Path(tempfile.mkstemp(suffix=".wav")[1])
                path.write_bytes(response.content)
                return str(path)
            except Exception:
                pass

        # Optional direct edge-tts fallback. This keeps the system speaking even
        # if the cloning service is unavailable; it intentionally does not claim
        # to reproduce Neeraj's voice.
        try:
            import asyncio
            import edge_tts

            voice = os.getenv(
                "EDGE_TTS_VOICE",
                "en-IN-PrabhatNeural" if lang.startswith("en-IN") else "en-US-GuyNeural",
            )
            path = Path(tempfile.mkstemp(suffix=".mp3")[1])
            asyncio.run(edge_tts.Communicate(text, voice).save(str(path)))
            return str(path)
        except Exception:
            return None
