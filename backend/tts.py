import asyncio
import os
import tempfile
from pathlib import Path

import httpx

from .rvc import RVC


class TTS:
    """Speech adapter for AURA's browser-rendered FBX avatar.

    TTS produces audio only. AvatarEngine owns the FBX face, lip-sync,
    expressions, gestures, and body animation. Optional RVC post-processes
    the generated audio to match the configured Neeraj voice model.
    """

    def __init__(self):
        self.url = os.getenv("TTS_URL", "").rstrip("/")
        self.voice_reference = os.getenv(
            "TTS_VOICE",
            "file:///voices/neeraj-voice-reference.wav",
        )
        self.timeout = self._float_env("TTS_TIMEOUT", 180.0, 5.0, 300.0)
        self.rvc = RVC(Path(__file__).resolve().parents[1])

    @staticmethod
    def _float_env(name: str, default: float, minimum: float, maximum: float) -> float:
        try:
            value = float(os.getenv(name, str(default)))
        except ValueError:
            value = default
        return max(minimum, min(value, maximum))

    def _convert_with_rvc(self, path: str) -> str:
        converted = self.rvc.convert(path)
        if converted:
            try:
                Path(path).unlink(missing_ok=True)
            except OSError:
                pass
            return converted
        return path

    @staticmethod
    def _write_response(response: httpx.Response, suffix: str) -> str:
        if not response.content:
            raise RuntimeError("TTS returned an empty audio response")
        path = Path(tempfile.mkstemp(suffix=suffix)[1])
        try:
            path.write_bytes(response.content)
            return str(path)
        except Exception:
            path.unlink(missing_ok=True)
            raise

    def _synthesize_remote(self, text: str, language: str) -> str | None:
        if not self.url:
            return None

        payload = {
            "input": text,
            "voice": self.voice_reference,
            "language_id": language,
            "response_format": "wav",
        }

        try:
            response = httpx.post(
                self.url + "/v1/audio/speech",
                json=payload,
                timeout=self.timeout,
            )
            response.raise_for_status()
            path = self._write_response(response, ".wav")
            return self._convert_with_rvc(path)
        except Exception:
            return None

    def _synthesize_edge(self, text: str, language: str) -> str | None:
        try:
            import edge_tts

            voice = os.getenv(
                "EDGE_TTS_VOICE",
                "en-IN-PrabhatNeural"
                if language.startswith("en-IN")
                else "en-US-GuyNeural",
            )
            path = Path(tempfile.mkstemp(suffix=".mp3")[1])
            try:
                asyncio.run(edge_tts.Communicate(text, voice).save(str(path)))
                if not path.is_file() or path.stat().st_size == 0:
                    path.unlink(missing_ok=True)
                    return None
                return self._convert_with_rvc(str(path))
            except Exception:
                path.unlink(missing_ok=True)
                return None
        except Exception:
            return None

    def synthesize(self, text: str, language: str | None = None) -> str | None:
        """Return a temporary audio file ready for browser playback."""
        text = (text or "").strip()
        if not text:
            return None

        lang = language or os.getenv("TTS_LANGUAGE", "en-IN")

        # Preferred path: local Chatterbox or another OpenAI-compatible
        # speech endpoint configured through TTS_URL.
        audio = self._synthesize_remote(text, lang)
        if audio:
            return audio

        # Fallback path keeps AURA usable when the local TTS service is down.
        return self._synthesize_edge(text, lang)
