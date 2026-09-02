import { useMemo, useRef, useState } from 'react';
import { common, d } from 'typegpu';
import { useConfigureContext, useFrame, useRoot } from '@typegpu/react';
import { AvatarEngine, type AvatarCommand } from './AvatarEngine';
import { useHologramBrain } from './useHologramBrain';

type Recognition = {
  start: () => void;
  stop: () => void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

function App() {
  const root = useRoot();
  const apiRef = useRef<{ command: (c: AvatarCommand) => void } | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const [status, setStatus] = useState('INITIALIZING NEERAJ AVATAR');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('Ask Neeraj anything.');
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const renderPipeline = useMemo(
    () =>
      root.createRenderPipeline({
        vertex: common.fullScreenTriangle,
        fragment: ({ uv }) => {
          'use gpu';
          return d.vec4f(0.005, 0.025 + uv.y * 0.015, 0.045 + uv.x * 0.025, 1);
        },
      }),
    [root],
  );

  const { ref, ctxRef } = useConfigureContext({ autoResize: true, alphaMode: 'premultiplied' });

  useFrame(() => {
    if (!ctxRef.current) return;
    renderPipeline.withColorAttachment({ view: ctxRef.current }).draw(3);
  });

  const command = (c: AvatarCommand) => apiRef.current?.command(c);

  // Real backend connection: sends your question to backend/main.py, which
  // routes it through Claude (brain.py) and your cloned voice (tts.py), and
  // streams the reply text + synthesized audio back over the WebSocket.
  const { status: brainStatus, sendText, stopSpeaking } = useHologramBrain({
    onAssistantText: (text) => setResponse(text),
    onSpeechStart: () => {
      setSpeaking(true);
      setStatus('NEERAJ SPEAKING • EXPRESSION + LIP MOTION ACTIVE');
      command({ type: 'expression', value: 'speaking' });
    },
    onSpeechEnd: () => {
      setSpeaking(false);
      command({ type: 'expression', value: 'neutral' });
      command({ type: 'gesture', value: 'idle' });
      setStatus('BRAIN READY • LISTENING FOR NEXT QUESTION');
    },
    onAmplitude: (level) => command({ type: 'viseme', value: 'mouthOpen', amount: level }),
  });

  const processQuestion = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    if (brainStatus !== 'ready') {
      setStatus('BACKEND OFFLINE • RUN start_windows.ps1 (or backend/main.py) FIRST');
      return;
    }
    setTranscript(clean);
    setStatus('NEERAJ THINKING • BRAIN RESPONSE IN PROGRESS');
    command({ type: 'expression', value: 'thinking' });
    command({ type: 'gesture', value: 'nod' });
    sendText(clean);
  };

  const startListening = () => {
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setStatus('VOICE INPUT NOT SUPPORTED • TYPE A QUESTION BELOW');
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const result = event.results[0]?.[0]?.transcript ?? '';
      processQuestion(result);
    };
    recognition.onerror = () => {
      setListening(false);
      command({ type: 'expression', value: 'neutral' });
      setStatus('VOICE INPUT ERROR • TRY AGAIN');
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    setStatus('LISTENING • SPEAK TO NEERAJ');
    command({ type: 'expression', value: 'neutral' });
    recognition.start();
  };

  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    startListening();
  };

  return (
    <main className="hologram-app">
      <canvas ref={ref} className="hologram-canvas" />
      <div className="hud">
        <header className="top-bar">
          <div className="brand"><span className="status-dot" /> NEERAJ AI</div>
          <div className="system-status">
            WEBGPU <span>●</span>&nbsp;&nbsp; AVATAR <span>●</span>&nbsp;&nbsp;
            BRAIN <span className={brainStatus === 'ready' ? 'status-ok' : 'status-bad'}>●</span>
          </div>
        </header>

        <section className="center-content">
          <div className="avatar-frame">
            <div className="avatar-engine-wrap"><AvatarEngine apiRef={apiRef} onStatus={setStatus} /></div>
            <div className="scanline" />
            <div className="avatar-ring" />
            <div className="avatar-ring ring-two" />
          </div>

          <h1>NEERAJ</h1>
          <p className="subtitle">AI CAREER INTELLIGENCE • DIGITAL HUMAN TEST</p>
          <p className="message">{status}</p>
          <p className="response">{response}</p>
          {transcript && <p className="transcript">YOU: {transcript}</p>}

          <div className="control-row">
            <button className="talk-button" onClick={toggleVoice}>{listening ? 'STOP LISTENING' : '🎙 TALK TO NEERAJ'}</button>
            <button className="mini-button" onClick={() => command({ type: 'expression', value: 'happy' })}>SMILE</button>
            <button className="mini-button" onClick={() => command({ type: 'expression', value: 'thinking' })}>THINK</button>
            <button className="mini-button" onClick={() => command({ type: 'gesture', value: 'wave' })}>WAVE</button>
            <button className="mini-button" onClick={() => processQuestion('Run a quick voice, body movement, expression and eye blink test.')}>VOICE TEST</button>
            {speaking && <button className="mini-button" onClick={stopSpeaking}>STOP VOICE</button>}
          </div>
        </section>

        <footer className="bottom-bar">
          <span>HOLOGRAM ENGINE v2.0</span>
          <span>VOICE • BODY • BLINK • EXPRESSION • BRAIN</span>
        </footer>
      </div>
    </main>
  );
}

export default App;
