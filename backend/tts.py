import os
import tempfile
from pathlib import Path

import httpx


class TTS:
    """Chatterbox-first speech adapter with free neural fallbacks."""

    def __init__(self):
        self.url = os.getenv("TTS_URL", "").rstrip("/")

    def synthesize(self, text, language=None):
        lang = language or os.getenv("TTS_LANGUAGE", "en")
        # Existing local Chatterbox service is preferred when configured.
        if self.url:
            try:
                payload = {
                    "input": text,
                    "voice": os.getenv("TTS_VOICE", "file:///voices/neeraj-voice-reference"),
                    "language_id": lang,
                    "response_format": "wav",
                }
                response = httpx.post(self.url + "/v1/audio/speech", json=payload, timeout=180)
                response.raise_for_status()
                path = Path(tempfile.mkstemp(suffix=".wav")[1])
                path.write_bytes(response.content)
                return str(path)
            except Exception:
                pass

        # Optional direct edge-tts fallback. This keeps the system speaking even
        # if Chatterbox is unavailable; it does not pretend to clone Neeraj's voice.
        try:
            import asyncio
            import edge_tts

            voice = os.getenv("EDGE_TTS_VOICE", "en-IN-PrabhatNeural" if lang.startswith("en-IN") else "en-US-GuyNeural")
            path = Path(tempfile.mkstemp(suffix=".mp3")[1])
            asyncio.run(edge_tts.Communicate(text, voice).save(str(path)))
            return str(path)
        except Exception:
            return None
