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
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };

type Mode = 'profile' | 'companion';

const PROFILE_IMAGE = 'https://raw.githubusercontent.com/neerajkapil33/AI-Hologram/main/assets_private/neeraj.jpg';

function App() {
  const root = useRoot();
  const apiRef = useRef<{ command: (c: AvatarCommand) => void } | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const [mode, setMode] = useState<Mode>('profile');
  const [language, setLanguage] = useState('en-IN');
  const [status, setStatus] = useState('NEERAJ AI • READY');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('Choose Talk to Neeraj to enter the live AI Career Companion.');
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [avatarVideo, setAvatarVideo] = useState<string | null>(null);

  const renderPipeline = useMemo(() => root.createRenderPipeline({
    vertex: common.fullScreenTriangle,
    fragment: ({ uv }) => { 'use gpu'; return d.vec4f(0.003, 0.018 + uv.y * 0.015, 0.04 + uv.x * 0.025, 1); },
  }), [root]);
  const { ref, ctxRef } = useConfigureContext({ autoResize: true, alphaMode: 'premultiplied' });
  useFrame(() => { if (ctxRef.current) renderPipeline.withColorAttachment({ view: ctxRef.current }).draw(3); });
  const command = (c: AvatarCommand) => apiRef.current?.command(c);

  const { status: brainStatus, sendText, stopSpeaking } = useHologramBrain({
    onAssistantText: (text) => setResponse(text),
    onSpeechStart: () => { setSpeaking(true); setStatus('NEERAJ SPEAKING • LIVE AI VOICE + EXPRESSION'); command({ type: 'expression', value: 'speaking' }); },
    onSpeechEnd: () => { setSpeaking(false); setStatus('ONLINE • NEERAJ IS LISTENING'); command({ type: 'expression', value: 'neutral' }); command({ type: 'gesture', value: 'idle' }); },
    onAmplitude: (level) => command({ type: 'viseme', value: 'mouthOpen', amount: level }),
    onAvatarVideo: (src) => setAvatarVideo(src),
  });

  const processQuestion = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setMode('companion');
    if (brainStatus !== 'ready') { setStatus('BRAIN OFFLINE • START backend/main.py'); return; }
    setTranscript(clean);
    setStatus('NEERAJ THINKING • FORMING YOUR RESPONSE');
    command({ type: 'expression', value: 'thinking' });
    command({ type: 'gesture', value: 'nod' });
    sendText(clean, language);
  };

  const startListening = () => {
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) { setStatus('VOICE INPUT NOT SUPPORTED • USE THE TEXT BOX'); return; }
    const recognition = new Recognition();
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => processQuestion(event.results[0]?.[0]?.transcript ?? '');
    recognition.onerror = () => { setListening(false); setStatus('VOICE INPUT ERROR • TRY AGAIN'); };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    setMode('companion');
    setStatus(`LISTENING • ${language}`);
    command({ type: 'expression', value: 'neutral' });
    recognition.start();
  };

  const toggleVoice = () => {
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    startListening();
  };

  return (
    <main className="neeraj-screen">
      <canvas ref={ref} className="hologram-canvas" />
      <div className="screen-grid" />
      <header className="neeraj-header">
        <div className="brand-lockup"><div className="brand-orb">N</div><div><div className="brand-name">NEERAJ <span>AI</span></div><div className="brand-line">Career. Growth. Global.</div></div></div>
        <div className="system-pill"><i /> ONLINE <b>│</b> WEBGPU <b>│</b> TYPEGPU <b>│</b> REACT</div>
      </header>

      <section className="hero-grid">
        <aside className="left-rail">
          <div className="speech-card"><div className="eyebrow">AI CAREER COMPANION</div><h2>Hi, I'm Neeraj!</h2><strong>Your AI Career Companion.</strong><p>I help professionals navigate their career journey — with clarity, skills, opportunities and the right strategy.</p><button onClick={() => { setMode('companion'); setStatus('READY • TALK TO NEERAJ'); }}>Ask me anything…</button></div>
          {['Career Guidance|Plan • Pivot • Progress','Global Opportunities|75+ Countries','Resume & LinkedIn|Optimize • Stand Out','Interview Prep|Practice • Succeed','Market Insights|Trends • Skills • Roles'].map((x) => { const [a,b]=x.split('|'); return <div className="feature-row" key={a}><span>{a.slice(0,1)}</span><div><b>{a}</b><small>{b}</small></div></div>; })}
        </aside>

        <section className="avatar-stage">
          <div className="stage-label"><span>●</span> {mode === 'profile' ? 'CAREER COACH PROFILE' : 'LIVE AI CAREER COMPANION'}</div>
          {mode === 'profile' ? (
            <div className="profile-avatar"><img src={PROFILE_IMAGE} alt="Neeraj Kapil professional AI coach reference" /><div className="profile-glow" /></div>
          ) : (
            <div className="live-avatar">
              {avatarVideo ? <video src={avatarVideo} autoPlay playsInline onEnded={() => setAvatarVideo(null)} /> : <AvatarEngine apiRef={apiRef} onStatus={setStatus} />}
              <div className="live-ring" /><div className="live-floor" />
            </div>
          )}
          <div className="avatar-name">NEERAJ</div>
          <div className="avatar-sub">AI CAREER INTELLIGENCE • DIGITAL HUMAN</div>
          <div className="stage-message">{status}</div>
          {mode === 'companion' && <div className="conversation"><div className="response">{response}</div>{transcript && <div className="transcript">YOU: {transcript}</div>}</div>}
        </section>

        <aside className="right-rail">
          <div className="map-card"><div className="eyebrow">GLOBAL REACH</div><strong>75+<small>Countries</small></strong><div className="map-lines">✦　◌　✧　◌　✦</div></div>
          <div className="dual-card"><div><div className="eyebrow">FOCUS AREAS</div><p>◈ Technology</p><p>◇ FinTech</p><p>♡ Healthcare</p><p>ϟ Energy & Power</p><p>◉ Telecom</p><p>♙ Startups</p><p>▣ MNCs</p></div><div className="quote">“Success is not just about reaching the destination, but growing in the journey.”<em>— Neeraj</em></div></div>
          <div className="approach"><div className="eyebrow">MY APPROACH</div><div className="approach-grid"><span>♡<small>Empathetic</small></span><span>♧<small>Strategic</small></span><span>▥<small>Data-Driven</small></span><span>♙<small>People First</small></span></div></div>
        </aside>
      </section>

      <section className="control-deck">
        <div className="mode-switch"><button className={mode==='profile'?'active':''} onClick={() => setMode('profile')}>PROFILE</button><button className={mode==='companion'?'active':''} onClick={() => setMode('companion')}>AI CAREER COMPANION</button></div>
        <div className="chat-input"><span>◌</span><input placeholder="Type to Chat with Neeraj" onKeyDown={(e) => { if (e.key==='Enter') processQuestion(e.currentTarget.value); }} /><button onClick={toggleVoice}>{listening ? 'STOP' : '🎙'}</button></div>
        <select aria-label="Conversation language" value={language} onChange={(e) => setLanguage(e.target.value)}><option value="en-IN">English</option><option value="hi-IN">हिन्दी</option><option value="ta-IN">தமிழ்</option><option value="te-IN">తెలుగు</option><option value="bn-IN">বাংলা</option><option value="mr-IN">मराठी</option></select>
        <button className="call-button" onClick={() => { setMode('companion'); setStatus('VIDEO CALL READY • NEERAJ IS HERE'); }}>VIDEO CALL</button>
        {speaking && <button className="stop-button" onClick={stopSpeaking}>STOP VOICE</button>}
      </section>

      <footer className="neeraj-footer"><span>AI CAREER INTELLIGENCE</span><span>VOICE • FACE • EXPRESSION • BODY • BRAIN • MULTILINGUAL</span><span>HOLOGRAM SYSTEM v3.0</span></footer>
      <div className="ai-disclosure">AI representation of Neeraj Kapil • generated responses are not statements made by the physical Neeraj.</div>
    </main>
  );
}

export default App;
