import { useRef, useState } from 'react';
import AvatarEngine, { type AvatarCommand } from './AvatarEngine';
import { useHologramBrain } from './useHologramBrain';

type Recognition = { start: () => void; stop: () => void; continuous: boolean; interimResults: boolean; lang: string; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null };
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
type LiveRoom = { conversation_url?: string; error?: string; message?: string };

const API_BASE_URL = (import.meta.env.VITE_BACKEND_HTTP_URL ?? '').replace(/\/$/, '');

function App() {
  const apiRef = useRef<{ command: (c: AvatarCommand) => void } | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [language, setLanguage] = useState('en-IN');
  const [status, setStatus] = useState('LOADING • NEERAJ FBX AVATAR');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [liveRoom, setLiveRoom] = useState<LiveRoom | null>(null);
  const [startingCall, setStartingCall] = useState(false);
  const [spatial, setSpatial] = useState(false);
  const [commandTab, setCommandTab] = useState<'command' | 'quick'>('command');
  const [commandText, setCommandText] = useState('');

  const command = (c: AvatarCommand) => apiRef.current?.command(c);

  const { status: brainStatus, sendText, sendAudio, stopSpeaking } = useHologramBrain({
    onAssistantText: (text) => setResponse(text),
    onPerformance: (p) => {
      command({ type: 'performance', value: p });
      setStatus(`NEERAJ • ${p.emotion.toUpperCase()} • ${p.gesture.toUpperCase()} • ${p.body.toUpperCase()}`);
    },
    onSpeechStart: () => { setSpeaking(true); command({ type: 'expression', value: 'speaking' }); },
    onSpeechEnd: () => { setSpeaking(false); command({ type: 'expression', value: 'neutral' }); command({ type: 'gesture', value: 'idle' }); },
    onAmplitude: (level) => command({ type: 'viseme', value: 'mouthOpen', weight: level }),
    onAvatarVideo: () => {},
  });

  const processQuestion = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setTranscript(clean);
    setResponse('');
    command({ type: 'expression', value: 'thinking' });
    command({ type: 'gesture', value: 'nod' });
    if (brainStatus !== 'ready') {
      setResponse('The AI brain is offline. Connect the backend to receive a live personalized reply.');
      setStatus('LOCAL MODE • AI BRAIN NOT CONNECTED');
      return;
    }
    setStatus('NEERAJ THINKING • SPEAKING SOON');
    sendText(clean, language);
  };

  const startListening = async () => {
    if (brainStatus !== 'ready') { setStatus('AI BRAIN OFFLINE'); return; }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      const speechWindow = window as SpeechWindow;
      const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
      if (!Recognition) { setStatus('MICROPHONE NOT SUPPORTED'); return; }
      const recognition = new Recognition();
      recognition.lang = language;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = (event) => processQuestion(event.results[0]?.[0]?.transcript ?? '');
      recognition.onerror = () => { setListening(false); setStatus('VOICE INPUT ERROR'); };
      recognition.onend = () => setListening(false);
      recognitionRef.current = recognition;
      setListening(true);
      setStatus(`LISTENING • ${language}`);
      recognition.start();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const preferred = 'audio/webm;codecs=opus';
      const recorder = MediaRecorder.isTypeSupported(preferred)
        ? new MediaRecorder(stream, { mimeType: preferred })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        if (!blob.size) { setListening(false); setStatus('NO VOICE CAPTURED'); return; }
        setStatus('TRANSCRIBING • NEERAJ AI');
        if (!sendAudio(blob, language)) setStatus('AI BRAIN OFFLINE');
        setListening(false);
      };
      recorder.onerror = () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setListening(false);
        setStatus('MICROPHONE RECORDING ERROR');
      };
      recorder.start();
      setListening(true);
      setStatus(`SPEAK NOW • ${language}`);
      command({ type: 'expression', value: 'neutral' });
    } catch {
      setListening(false);
      setStatus('MICROPHONE PERMISSION REQUIRED');
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    else streamRef.current?.getTracks().forEach((track) => track.stop());
  };

  const startVideoCall = async () => {
    if (!API_BASE_URL) { setStatus('SPATIAL / LIVE CALL NEEDS BACKEND CONFIGURATION'); return; }
    setStartingCall(true);
    setStatus('CONNECTING • NEERAJ AI');
    try {
      const res = await fetch(`${API_BASE_URL}/api/tavus/conversation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const room = await res.json() as LiveRoom;
      setLiveRoom(room);
      setSpatial(true);
      setStatus(room.conversation_url ? 'LIVE SPATIAL AI CALL' : room.error ?? room.message ?? 'LIVE CALL NOT READY');
    } catch (error) { setStatus(`LIVE CALL ERROR • ${error instanceof Error ? error.message : 'TRY AGAIN'}`); }
    finally { setStartingCall(false); }
  };

  const action = (label: string, value: string) => (
    <button type="button" className="avatar-control" onClick={() => { command({ type: 'gesture', value }); setStatus(`GESTURE • ${label.toUpperCase()}`); }}>
      <span>{label}</span>
    </button>
  );

  const issueMotorCommand = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    command({ type: 'gesture', value: clean });
    setStatus(`MOTOR BRAIN • COMMAND • ${clean.toUpperCase()}`);
    setCommandText('');
  };

  const quickCommand = (label: string, value: string) => (
    <button type="button" className="avatar-control" onClick={() => issueMotorCommand(value)}>
      <span>{label}</span>
    </button>
  );

  return <main className="avatar-console">
    <div className="avatar-backdrop" />
    <section className="avatar-main">
      <div className="avatar-topline"><span className="avatar-brand">NEERAJ <b>AI</b></span><span className="avatar-status">● {status}</span></div>
      <div className="avatar-view">
        {liveRoom?.conversation_url ? <div className="live-call-stage"><iframe title="Neeraj AI live call" src={liveRoom.conversation_url} allow="camera; microphone; autoplay; fullscreen; display-capture" /></div> : <AvatarEngine onApi={(api) => { apiRef.current = api; }} onStatus={setStatus} />}
        {response && <div className="avatar-response"><small>NEERAJ</small>{response}</div>}
        {transcript && <div className="avatar-transcript">YOU: {transcript}</div>}
      </div>
    </section>

    <aside className="control-panel" aria-label="3D avatar controls">
      <div className="control-title">3D AVATAR CONTROLS</div>
      <div className="control-group">
        <div className="control-label">AVATAR</div>
        <button type="button" className="avatar-control active" onClick={() => { setSpatial(false); command({ type: 'gesture', value: 'idle' }); setStatus('3D AVATAR • READY'); }}>3D Avatar</button>
        <button type="button" className={`avatar-control ${spatial ? 'active' : ''}`} onClick={() => { setSpatial(true); setStatus('SPATIAL MODE • DEPTH VIEW'); command({ type: 'gesture', value: 'spatial' }); }}>Spatial</button>
        <button type="button" className="avatar-control" onClick={() => { command({ type: 'gesture', value: 'rotate' }); setStatus('3D AVATAR • ROTATING'); }}>Rotate 3D Avatar</button>
      </div>
      <div className="control-group"><div className="control-label">FACE & HEAD TESTS</div>
        {action('Neutral / Reset', 'idle')}{action('Smile', 'smile')}{action('Laugh', 'laugh')}{action('Face Emotions', 'happy')}{action('Blink / Eyes', 'eyes')}{action('Head Nod', 'nod')}{action('Head / Neck Look', 'look')}{action('Look Left', 'look-left')}{action('Look Right', 'look-right')}{action('Look Up', 'look-up')}{action('Look Down', 'look-down')}{action('Jaw / Talk', 'jaw')}{action('Blink Test', 'blink')}
      </div>
      <div className="control-group"><div className="control-label">HANDS & ARMS TESTS</div>
        {action('Wave', 'wave')}{action('Point', 'point')}{action('Present', 'present')}{action('Open Hands', 'open-hand')}{action('Handshake', 'handshake')}{action('Raise Left Arm', 'left-arm-up')}{action('Raise Right Arm', 'right-arm-up')}{action('Both Arms Up', 'arms-up')}{action('Cross Arms', 'cross-arms')}{action('Finger Test', 'fingers')}
      </div>
      <div className="control-group"><div className="control-label">BODY & LEGS TESTS</div>
        {action('Idle / Breathe', 'idle')}{action('Nod', 'nod')}{action('Shrug', 'shrug')}{action('Walk', 'walk')}{action('Run', 'run')}{action('Jump', 'jump')}{action('Sit', 'sit')}{action('Stand', 'stand')}{action('Full Body', 'full-body')}{action('Turn 45°', 'rotate')}{action('Face Front', 'front')}
      </div>
      <div className="control-group">
        <div className="control-label">MOTOR BRAIN • COMMAND CENTER</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button type="button" className={`avatar-control ${commandTab === 'command' ? 'active' : ''}`} onClick={() => setCommandTab('command')}>COMMAND</button>
          <button type="button" className={`avatar-control ${commandTab === 'quick' ? 'active' : ''}`} onClick={() => setCommandTab('quick')}>QUICK ORDERS</button>
        </div>
        {commandTab === 'command' ? (
          <div className="reply-row">
            <input
              value={commandText}
              placeholder="e.g. Sit on the chair"
              aria-label="Motor command"
              onChange={(e) => setCommandText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') issueMotorCommand(commandText); }}
            />
            <button type="button" className="avatar-control active" onClick={() => issueMotorCommand(commandText)}>EXECUTE</button>
          </div>
        ) : (
          <>
            {quickCommand('Sit on chair', 'sit on chair')}
            {quickCommand('Stand', 'stand up')}
            {quickCommand('Find chair', 'find chair')}
            {quickCommand('Hold chair & sit', 'hold chair and sit on chair')}
            {quickCommand('Sit upright', 'sit upright')}
            {quickCommand('Rest posture', 'rest')}
            {quickCommand('Walk North', 'walk north')}
            {quickCommand('Walk East', 'walk east')}
            {quickCommand('Walk South', 'walk south')}
            {quickCommand('Walk West', 'walk west')}
            {quickCommand('Run North', 'run north')}
            {quickCommand('Run East', 'run east')}
            {quickCommand('Run South', 'run south')}
            {quickCommand('Run West', 'run west')}
          </>
        )}
        <small style={{ display: 'block', marginTop: 8, opacity: 0.7 }}>
          Goal → locate object → approach → contact → posture → settle.
        </small>
      </div>
      <div className="control-group"><div className="control-label">VOICE</div>
        <button type="button" className={`avatar-control ${listening ? 'active' : ''}`} onClick={() => { if (listening) stopListening(); else startListening(); }}>{listening ? 'Stop Speaking' : '🎙 Speak'}</button>
        <div className="reply-row"><input ref={inputRef} placeholder="Type a reply…" onKeyDown={(e) => { if (e.key === 'Enter') { processQuestion(e.currentTarget.value); e.currentTarget.value = ''; } }} /><button type="button" className="avatar-control active" onClick={() => { const value = inputRef.current?.value ?? ''; processQuestion(value); if (inputRef.current) inputRef.current.value = ''; }}>Reply</button></div>
        {speaking && <button type="button" className="avatar-control" onClick={stopSpeaking}>Stop Voice</button>}
        <select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Language"><option value="en-IN">English</option><option value="hi-IN">हिन्दी</option><option value="ta-IN">தமிழ்</option><option value="te-IN">తెలుగు</option></select>
      </div>
      <div className="control-group"><div className="control-label">APPEARANCE & RIG</div>
        {action('Glasses ON', 'glasses-on')}{action('Glasses OFF', 'glasses-off')}{action('Clothes Test', 'clothes')}{action('Self-Check Rig', 'self-check')}
      </div>
      <div className="control-group"><button type="button" className="avatar-control call" disabled={startingCall} onClick={startVideoCall}>{startingCall ? 'Connecting…' : liveRoom ? 'End Spatial Call' : 'Spatial Live Call'}</button>{liveRoom && <button type="button" className="avatar-control" onClick={() => { setLiveRoom(null); setSpatial(false); setStatus('3D AVATAR • READY'); }}>Back to 3D</button>}</div>
    </aside>
  </main>;
}

export default App;
