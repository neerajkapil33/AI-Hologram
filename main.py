import base64, json, os, tempfile, uuid
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

from brain import Brain
from tts import TTS
from stt import STT
from avatar import AvatarEngine

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / '.env')
app = FastAPI(title=os.getenv('APP_NAME', 'Neeraj Kapil Hologram'))
app.mount('/assets', StaticFiles(directory=str(ROOT / 'assets')), name='assets')
app.mount('/app', StaticFiles(directory=str(ROOT / 'frontend')), name='frontend')

brain = Brain()
tts = TTS()
stt = STT()
avatar = AvatarEngine(ROOT)

@app.get('/')
async def index():
    return FileResponse(ROOT / 'frontend' / 'index.html')

@app.get('/health')
async def health():
    return {'ok': True, 'avatar_engine': os.getenv('AVATAR_ENGINE','simple'), 'tts': bool(os.getenv('TTS_URL'))}

@app.websocket('/ws')
async def ws(websocket: WebSocket):
    await websocket.accept()
    history=[]
    try:
        while True:
            msg = await websocket.receive_text()
            data = json.loads(msg)
            typ=data.get('type')
            if typ=='text':
                user_text=data.get('text','').strip()
            elif typ=='audio':
                raw=base64.b64decode(data.get('audio',''))
                with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as f:
                    f.write(raw); path=f.name
                try:
                    user_text=stt.transcribe(path)
                finally:
                    try: os.unlink(path)
                    except OSError: pass
                await websocket.send_json({'type':'transcription','text':user_text})
            else:
                continue
            if not user_text: continue
            history.append({'role':'user','content':user_text})
            answer=brain.reply(history)
            history.append({'role':'assistant','content':answer})
            await websocket.send_json({'type':'message','role':'assistant','content':answer})
            audio_path=tts.synthesize(answer)
            if audio_path:
                await websocket.send_json({'type':'audio','audio':base64.b64encode(Path(audio_path).read_bytes()).decode(), 'mime':'audio/wav'})
                video_path=avatar.generate(audio_path)
                if video_path:
                    await websocket.send_json({'type':'avatar_video','video':base64.b64encode(Path(video_path).read_bytes()).decode(),'mime':'video/mp4'})
            await websocket.send_json({'type':'done'})
    except WebSocketDisconnect:
        return
