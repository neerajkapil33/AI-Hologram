import os, subprocess, tempfile
from pathlib import Path

class AvatarEngine:
    def __init__(self,root): self.root=root; self.engine=os.getenv('AVATAR_ENGINE','simple').lower()
    def generate(self,audio_path):
        if self.engine!='musetalk': return None
        # Adapter: use the official MuseTalk install in third_party/MuseTalk.
        # A persistent worker is recommended for production; this fallback invokes the realtime script per turn.
        mt=Path(os.getenv('MUSETALK_DIR',self.root/'third_party/MuseTalk'))
        if not mt.exists(): return None
        cfg=mt/'configs/inference/realtime.yaml'
        if not cfg.exists(): return None
        # The official script is designed around an audio_clips directory. We prepare one clip and run it.
        clipdir=mt/'audio_clips'; clipdir.mkdir(exist_ok=True)
        import shutil
        shutil.copy2(audio_path,clipdir/'turn.wav')
        cmd=['python','-m','scripts.realtime_inference','--inference_config',str(cfg),'--result_dir',str(mt/'results/realtime'),'--unet_model_path',str(mt/'models/musetalkV15/unet.pth'),'--unet_config',str(mt/'models/musetalkV15/musetalk.json'),'--version','v15','--fps','25']
        try:
            subprocess.run(cmd,cwd=mt,check=True,timeout=180)
        except Exception:
            return None
        outs=sorted((mt/'results/realtime').glob('*.mp4'),key=lambda p:p.stat().st_mtime,reverse=True)
        return str(outs[0]) if outs else None
