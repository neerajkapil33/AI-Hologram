import asyncio, base64, json, os, tempfile
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from .brain import Brain
from .tts import TTS
from .stt import STT
from .avatar import AvatarEngine
from .tavus import Tavus
from .performance import PerformanceDirector

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / '.env')
app = FastAPI(title=os.getenv('APP_NAME', 'Neeraj Kapil Hologram'))
app.add_middleware(CORSMiddleware, allow_origins=[os.getenv('FRONTEND_ORIGIN', 'http://localhost:5173')], allow_methods=['*'], allow_headers=['*'])
brain, tts, stt, avatar, tavus, performance = Brain(), TTS(), STT(), AvatarEngine(ROOT), Tavus(), PerformanceDirector()

@app.get('/health')
async def health():
    return {
        'ok': True,
        'avatar_engine': os.getenv('AVATAR_ENGINE','simple'),
        'tavus': tavus.configured,
        'tts': bool(os.getenv('TTS_URL')),
        'persona': 'neeraj-ai-career-companion',
        'performance_director': True,
        'capabilities': ['conversation', 'multilingual', 'voice', 'lip_sync', 'facial_expression', 'gesture', 'full_body_performance'],
    }

@app.post('/api/tavus/conversation')
async def tavus_conversation(payload: dict = {}):
    """Create a real-time Tavus CVI room; the Tavus secret stays on the backend."""
    language = str(payload.get('language', 'en-IN'))
    return await asyncio.to_thread(tavus.create_conversation, language)

@app.post('/api/performance')
async def performance_direct(payload: dict = {}):
    """Return animation-neutral performance metadata for a spoken response."""
    return performance.direct(str(payload.get('text', ''))).json()

@app.websocket('/ws')
async def ws(websocket: WebSocket):
    await websocket.accept()
    history=[]
    try:
        while True:
            data=json.loads(await websocket.receive_text())
            typ=data.get('type')
            language=data.get('language', 'en-IN')
            if typ=='text':
                user_text=data.get('text','').strip()
            elif typ=='audio':
                raw=base64.b64decode(data.get('audio',''))
                with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as f:
                    f.write(raw); path=f.name
                try: user_text=stt.transcribe(path)
                finally:
                    try: os.unlink(path)
                    except OSError: pass
                await websocket.send_json({'type':'transcription','text':user_text})
            else: continue
            if not user_text: continue
            history.append({'role':'user','content':user_text})
            answer=await asyncio.to_thread(brain.reply, history, language)
            history.append({'role':'assistant','content':answer})

            # One shared performance contract drives the face, gesture and body
            # layers. This avoids random gestures and keeps animation semantic.
            performance_data = await asyncio.to_thread(performance.direct, answer)
            await websocket.send_json({'type':'message','role':'assistant','content':answer})
            await websocket.send_json({'type':'performance','performance':performance_data.json()})

            audio_path=await asyncio.to_thread(tts.synthesize, answer, language)
            if audio_path:
                await websocket.send_json({'type':'audio','audio':base64.b64encode(Path(audio_path).read_bytes()).decode(),'mime':'audio/wav'})
                video_path=await asyncio.to_thread(avatar.generate, audio_path)
                if video_path:
                    await websocket.send_json({'type':'avatar_video','video':base64.b64encode(Path(video_path).read_bytes()).decode(),'mime':'video/mp4'})
            await websocket.send_json({'type':'done'})
    except WebSocketDisconnect:
        return
