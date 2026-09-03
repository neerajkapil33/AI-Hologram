import os, subprocess, uuid
from pathlib import Path


class AvatarEngine:
    """Realtime Neeraj avatar renderer.

    MuseTalk is intentionally optional: the web hologram remains usable without
    GPU models, while a CUDA host can render the supplied Neeraj reference video
    with generated speech.
    """

    def __init__(self, root):
        self.root = Path(root)
        self.engine = os.getenv("AVATAR_ENGINE", "simple").lower()
        self.source_video = Path(
            os.getenv("MUSETALK_SOURCE_VIDEO", self.root / "assets_private" / "neeraj-reference.mp4")
        )
        self.musetalk_dir = Path(os.getenv("MUSETALK_DIR", self.root / "third_party" / "MuseTalk"))
        self.prepared = False

    @property
    def available(self):
        return (
            self.engine == "musetalk"
            and self.source_video.exists()
            and (self.musetalk_dir / "configs/inference/realtime.yaml").exists()
        )

    def generate(self, audio_path):
        if not self.available:
            return None

        cfg_dir = self.musetalk_dir / "configs" / "inference"
        result_dir = self.musetalk_dir / "results" / "realtime"
        result_dir.mkdir(parents=True, exist_ok=True)
        avatar_id = os.getenv("MUSETALK_AVATAR_ID", "neeraj_ai")
        live_cfg = cfg_dir / "neeraj_live_generated.yaml"
        audio_abs = str(Path(audio_path).resolve()).replace("\\", "/")
        video_abs = str(self.source_video.resolve()).replace("\\", "/")
        preparation = not self.prepared

        live_cfg.write_text(
            f'''{avatar_id}:\n  preparation: {str(preparation).lower()}\n  video_path: "{video_abs}"\n  bbox_shift: {os.getenv("MUSETALK_BBOX_SHIFT", "0")}\n  audio_clips:\n    turn_{uuid.uuid4().hex}: "{audio_abs}"\n''',
            encoding="utf-8",
        )

        cmd = [
            "python", "-m", "scripts.realtime_inference",
            "--inference_config", str(live_cfg),
            "--result_dir", str(result_dir),
            "--unet_model_path", str(self.musetalk_dir / "models/musetalkV15/unet.pth"),
            "--unet_config", str(self.musetalk_dir / "models/musetalkV15/musetalk.json"),
            "--version", "v15", "--fps", os.getenv("MUSETALK_FPS", "25"), "--skip_save_images",
        ]
        try:
            subprocess.run(cmd, cwd=self.musetalk_dir, check=True, timeout=int(os.getenv("MUSETALK_TIMEOUT", "180")))
            self.prepared = True
        except Exception:
            return None

        candidates = [
            self.musetalk_dir / "results" / "v15" / "avatars" / avatar_id / "vid_output",
            result_dir / "v15" / "avatars" / avatar_id / "vid_output",
        ]
        outputs = []
        for folder in candidates:
            if folder.exists():
                outputs.extend(folder.glob("*.mp4"))
        if not outputs:
            return None
        return str(max(outputs, key=lambda p: p.stat().st_mtime))
