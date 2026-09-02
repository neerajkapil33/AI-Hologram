import os
class STT:
    def __init__(self): self.model=None
    def transcribe(self,path):
        from faster_whisper import WhisperModel
        if self.model is None:
            device=os.getenv('WHISPER_DEVICE','auto')
            if device=='auto': device='cuda' if __import__('torch').cuda.is_available() else 'cpu'
            compute='float16' if device=='cuda' else 'int8'
            self.model=WhisperModel(os.getenv('WHISPER_MODEL','small'),device=device,compute_type=compute)
        segments,_=self.model.transcribe(path,beam_size=1,vad_filter=True)
        return ' '.join(s.text.strip() for s in segments).strip()
