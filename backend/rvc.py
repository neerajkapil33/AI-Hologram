from pathlib import Path


class RVC:
    """RVC DirectML adapter configuration for the backend voice pipeline."""

    def __init__(self, root: Path):
        self.root = root
        self.repo = Path("third_party/RVC")
        self.model = ""
        self.enabled = False

    @property
    def available(self):
        return self.enabled and bool(self.model)

    def convert(self, input_path: str):
        return None
