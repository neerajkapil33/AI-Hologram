import os
from pathlib import Path


class STT:
    """Speech-to-text adapter for AURA's browser voice input.

    The FBX avatar is rendered in the browser, so STT only converts the
    visitor's microphone audio into text for Brain. It does not touch the
    FBX model, facial morphs, bones, or animation state.
    """

    def __init__(self):
        self.model = None
        self.device = self._resolve_device()
        self.compute_type = os.getenv(
            "WHISPER_COMPUTE_TYPE",
            "float16" if self.device == "cuda" else "int8",
        )
        self.model_name = os.getenv("WHISPER_MODEL", "small")
        self.language = os.getenv("WHISPER_LANGUAGE", "").strip() or None
        self.beam_size = self._int_env("WHISPER_BEAM_SIZE", 1, 1, 5)

    @staticmethod
    def _int_env(name: str, default: int, minimum: int, maximum: int) -> int:
        try:
            value = int(os.getenv(name, str(default)))
        except ValueError:
            value = default
        return max(minimum, min(value, maximum))

    @staticmethod
    def _resolve_device() -> str:
        configured = os.getenv("WHISPER_DEVICE", "auto").strip().lower()
        if configured in {"cpu", "cuda"}:
            return configured
        try:
            import torch

            return "cuda" if torch.cuda.is_available() else "cpu"
        except Exception:
            return "cpu"

    def _load_model(self):
        if self.model is not None:
            return

        from faster_whisper import WhisperModel

        try:
            self.model = WhisperModel(
                self.model_name,
                device=self.device,
                compute_type=self.compute_type,
            )
        except Exception:
            # CUDA/float16 can fail on a machine without a compatible
            # runtime. Fall back to CPU/int8 so AURA voice input remains
            # usable instead of crashing the websocket.
            if self.device != "cpu":
                self.device = "cpu"
                self.compute_type = "int8"
                self.model = WhisperModel(
                    self.model_name,
                    device="cpu",
                    compute_type="int8",
                )
            else:
                raise

    def transcribe(self, path: str) -> str:
        audio_path = Path(path)
        if not audio_path.is_file():
            return ""

        self._load_model()

        segments, _ = self.model.transcribe(
            str(audio_path),
            beam_size=self.beam_size,
            vad_filter=True,
            language=self.language,
            condition_on_previous_text=False,
        )

        return " ".join(
            segment.text.strip()
            for segment in segments
            if segment.text and segment.text.strip()
        ).strip()
