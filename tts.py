import os, tempfile, base64, httpx
from pathlib import Path

class TTS:
    def __init__(self): self.url=os.getenv('TTS_URL','').rstrip('/')
    def synthesize(self,text):
        if not self.url: return None
        # OpenAI-compatible Chatterbox server endpoint.
        payload={'input':text,'voice':os.getenv('TTS_VOICE','file:///voices/neeraj-voice-reference'),'language_id':os.getenv('TTS_LANGUAGE','en'),'response_format':'wav'}
        r=httpx.post(self.url+'/v1/audio/speech',json=payload,timeout=180)
        r.raise_for_status()
        p=Path(tempfile.mkstemp(suffix='.wav')[1]); p.write_bytes(r.content); return str(p)
