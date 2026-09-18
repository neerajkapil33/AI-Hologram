import os
import tempfile
from pathlib import Path

import httpx


class RVC:
    """Optional adapter for a local RVC DirectML inference service."""

    def __init__(self, root: Path):
        self.root = root
        self.url = os.getenv("RVC_URL", "").rstrip("/")
        self.enabled = os.getenv("RVC_ENABLED", "true").lower() in {"1", "true", "yes", "on"}
        self.model = os.getenv("RVC_MODEL", "").strip()
        self.index = os.getenv("RVC_INDEX", "").strip()
        self.index_rate = float(os.getenv("RVC_INDEX_RATE", "0.75"))
        self.f0_method = os.getenv("RVC_F0_METHOD", "rmvpe")
        self.pitch = int(os.getenv("RVC_PITCH", "0"))
        self.protect = float(os.getenv("RVC_PROTECT", "0.33"))
        self.timeout = float(os.getenv("RVC_TIMEOUT", "180"))

    @property
    def available(self):
        return self.enabled and bool(self.url) and bool(self.model)

    def convert(self, input_path: str):
        if not self.available:
            return None
        source = Path(input_path)
        if not source.is_file():
            return None
        output = Path(tempfile.mkstemp(prefix="rvc_", suffix=".wav")[1])
        try:
            with source.open("rb") as audio:
                response = httpx.post(
                    self.url + "/convert",
                    files={"audio": (source.name, audio, "application/octet-stream")},
                    data={
                        "model": self.model,
                        "index": self.index,
                        "index_rate": str(self.index_rate),
                        "f0_method": self.f0_method,
                        "pitch": str(self.pitch),
                        "protect": str(self.protect),
                        "output_format": "wav",
                    },
                    timeout=self.timeout,
                )
            response.raise_for_status()
            output.write_bytes(response.content)
            if output.stat().st_size == 0:
                output.unlink(missing_ok=True)
                return None
            return str(output)
        except Exception:
            output.unlink(missing_ok=True)
            return None
