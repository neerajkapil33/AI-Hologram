import os, subprocess, uuid
from pathlib import Path

class AvatarEngine:
    def __init__(self,root):
        self.root=Path(root)
        self.engine=os.getenv('AVATAR_ENGINE','simple').lower()
        self.source_video=Path(os.getenv('MUSETALK_SOURCE_VIDEO', self.root/'assets_private'/'neeraj-reference.mp4'))
        self.prepared=False

    def generate(self,audio_path):
        if self.engine!='musetalk' or not self.source_video.exists(): return None
        mt=Path(os.getenv('MUSETALK_DIR',self.root/'third_party/MuseTalk'))
        if not mt.exists(): return None
        cfg=mt/'configs/inference/realtime.yaml'
        if not cfg.exists(): return None
        avatar_id=os.getenv('MUSETALK_AVATAR_ID','neeraj_ai')
        live_cfg=mt/'configs/inference/neeraj_live_generated.yaml'
        preparation=not self.prepared
        audio_abs=str(Path(audio_path).resolve()).replace('\\','/')
        video_abs=str(self.source_video.resolve()).replace('\\','/')
        live_cfg.write_text(f'''{avatar_id}:\n  preparation: {str(preparation).lower()}\n  video_path: "{video_abs}"\n  bbox_shift: 0\n  audio_clips:\n    turn_{uuid.uuid4().hex}: "{audio_abs}"\n''',encoding='utf-8')
        cmd=['python','-m','scripts.realtime_inference','--inference_config',str(live_cfg),'--result_dir',str(mt/'results/realtime'),'--unet_model_path',str(mt/'models/musetalkV15/unet.pth'),'--unet_config',str(mt/'models/musetalkV15/musetalk.json'),'--version','v15','--fps','25','--skip_save_images']
        try:
            subprocess.run(cmd,cwd=mt,check=True,timeout=int(os.getenv('MUSETALK_TIMEOUT','180')))
            self.prepared=True
        except Exception:
            return None
        outs=sorted((mt/'results'/'v15'/'avatars'/avatar_id/'vid_output').glob('*.mp4'),key=lambda p:p.stat().st_mtime,reverse=True)
        return str(outs[0]) if outs else None
