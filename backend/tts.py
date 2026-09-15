import asyncio
import os
import tempfile
from pathlib import Path

import httpx

from .rvc import RVC


class TTS:
    """Speech adapter with optional Neeraj voice conversion through RVC."""

    def __init__(self):
        self.url = os.getenv("TTS_URL", "").rstrip("/")
        self.voice_reference = os.getenv(
            "TTS_VOICE",
            "file:///voices/neeraj-voice-reference.wav",
        )
        self.rvc = RVC(Path(__file__).resolve().parents[1])

    def _convert_with_rvc(self, path: str):
        converted = self.rvc.convert(path)
        if converted:
            try:
                Path(path).unlink(missing_ok=True)
            except OSError:
                pass
            return converted
        return path

    def synthesize(self, text, language=None):
        lang = language or os.getenv("TTS_LANGUAGE", "en")
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
                return self._convert_with_rvc(str(path))
            except Exception:
                pass

        try:
            import edge_tts

            voice = os.getenv(
                "EDGE_TTS_VOICE",
                "en-IN-PrabhatNeural" if lang.startswith("en-IN") else "en-US-GuyNeural",
            )
            path = Path(tempfile.mkstemp(suffix=".mp3")[1])
            asyncio.run(edge_tts.Communicate(text, voice).save(str(path)))
            return self._convert_with_rvc(str(path))
        except Exception:
            return None
