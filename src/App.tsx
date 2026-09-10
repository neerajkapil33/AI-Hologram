import { useMemo, useRef, useState } from 'react';
import { common, d } from 'typegpu';
import { useConfigureContext, useFrame, useRoot } from '@typegpu/react';
import AvatarEngine, { type AvatarCommand } from './AvatarEngine';
import { useHologramBrain, type AvatarPerformance } from './useHologramBrain';

type Recognition = { start: () => void; stop: () => void; continuous: boolean; interimResults: boolean; lang: string; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null };
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
type Mode = 'profile' | 'companion';
type LiveRoom = { conversation_url?: string; conversation_id?: string; error?: string; message?: string; configured?: boolean };
const PROFILE_IMAGE = '/profile/neeraj-profile.jpg';
const API_BASE_URL = (import.meta.env.VITE_BACKEND_HTTP_URL ?? '').replace(/\/$/, '');

const categoryPrompts: Record<string, string> = {
  'Career Guidance': 'Give me practical career guidance: help me plan, pivot, and progress based on my current goals.',
  'Global Opportunities': 'Show me how to identify global career opportunities, target countries, and roles that fit my skills.',
  'Resume & LinkedIn': 'Help me improve my resume and LinkedIn profile so I stand out to recruiters.',
  'Interview Prep': 'Start an interview-prep session with me. Ask me a realistic question and coach my answer.',
  'Market Insights': 'Give me current career market insights: high-demand skills, roles, and trends I should watch.',
  Technology: 'Help me explore career opportunities and skills in Technology.',
  FinTech: 'Help me explore career opportunities and skills in FinTech.',
  Healthcare: 'Help me explore career opportunities and skills in Healthcare.',
  'Energy & Power': 'Help me explore career opportunities and skills in Energy & Power.',
  Telecom: 'Help me explore career opportunities and skills in Telecom.',
  Startups: 'Help me explore career opportunities in startups and how to evaluate them.',
  MNCs: 'Help me explore career opportunities in multinational companies and how to target them.',
  Empathetic: 'Use an empathetic, people-first approach while coaching me through my career question.',
  Strategic: 'Give me a strategic, structured approach to my career question.',
  'Data-Driven': 'Use a data-driven approach to help me make a better career decision.',
  'People First': 'Focus on people, leadership, communication, and sustainable career growth in your advice.',
};

function App() {
  const root = useRoot();
  const apiRef = useRef<{ command: (c: AvatarCommand) => void } | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<Mode>('companion');
  const [language, setLanguage] = useState('en-IN');
  const [status, setStatus] = useState('LOADING • NEERAJ 3D AVATAR');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [avatarVideo, setAvatarVideo] = useState<string | null>(null);
  const [liveRoom, setLiveRoom] = useState<LiveRoom | null>(null);
  const [startingCall, setStartingCall] = useState(false);
  const [performance, setPerformance] = useState<AvatarPerformance | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('');

  const renderPipeline = useMemo(() => root.createRenderPipeline({ vertex: common.fullScreenTriangle, fragment: ({ uv }) => { 'use gpu'; return d.vec4f(0.003, 0.018 + uv.y * 0.015, 0.04 + uv.x * 0.025, 1); } }), [root]);
  const { ref, ctxRef } = useConfigureContext({ autoResize: true, alphaMode: 'premultiplied' });
  useFrame(() => { if (ctxRef.current) renderPipeline.withColorAttachment({ view: ctxRef.current }).draw(3); });
  const command = (c: AvatarCommand) => apiRef.current?.command(c);
  const { status: brainStatus, sendText, stopSpeaking } = useHologramBrain({
    onAssistantText: (text) => setResponse(text),
    onPerformance: (p) => { setPerformance(p); command({ type: 'performance', value: p }); setStatus(`NEERAJ ${p.emotion.toUpperCase()} • ${p.gesture.toUpperCase()} • ${p.body.toUpperCase()}`); },
    onSpeechStart: () => { setSpeaking(true); setStatus('NEERAJ SPEAKING • LIVE AI VOICE + EXPRESSION'); command({ type: 'expression', value: 'speaking' }); },
    onSpeechEnd: () => { setSpeaking(false); setStatus('ONLINE • NEERAJ IS LISTENING'); command({ type: 'expression', value: 'neutral' }); command({ type: 'gesture', value: 'idle' }); command({ type: 'performance', value: { amplitude: 0, speaking: false } }); },
    onAmplitude: (level) => { command({ type: 'performance', value: { amplitude: level, voiceLevel: level, intensity: Math.max(0.15, level), speaking: level > 0.02 } }); command({ type: 'viseme', value: 'mouthOpen', weight: level }); },
    onAvatarVideo: (src) => setAvatarVideo(src),
  });

  const processQuestion = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setMode('companion');
    setSelectedCategory('');
    if (brainStatus !== 'ready') { setStatus('BRAIN OFFLINE • START backend/main.py'); return; }
    setTranscript(clean);
    setResponse('');
    setStatus('NEERAJ THINKING • FORMING YOUR RESPONSE');
    command({ type: 'expression', value: 'thinking' });
    command({ type: 'gesture', value: 'nod' });
    sendText(clean, language);
  };

  const activateCategory = (name: string) => {
    setSelectedCategory(name);
    const prompt = categoryPrompts[name] ?? `Tell me about ${name} for my career.`;
    setTranscript(name);
    chatInputRef.current?.focus();
    processQuestion(prompt);
  };

  const activateProfile = () => {
    setMode('profile');
    setSelectedCategory('Profile');
    setResponse('Neeraj Kapil • Career strategist • Technology, FinTech, Healthcare, Energy, Telecom • Global professional network');
    setTranscript('PROFILE');
    setStatus('PROFILE MODE • NEERAJ CAREER INTELLIGENCE');
    command({ type: 'expression', value: 'neutral' });
    command({ type: 'gesture', value: 'idle' });
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

  const toggleVoice = () => { if (listening) { recognitionRef.current?.stop(); setListening(false); setStatus('VOICE INPUT STOPPED'); return; } startListening(); };

  const startVideoCall = async () => {
    setMode('companion');
    setStartingCall(true);
    setStatus('CONNECTING • HIGH-FIDELITY NEERAJ AI REPLICA');
    try {
      const res = await fetch(`${API_BASE_URL}/api/tavus/conversation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language }) });
      if (!res.ok) throw new Error(`LIVE API ${res.status}`);
      const room = await res.json() as LiveRoom;
      setLiveRoom(room);
      if (room.conversation_url) setStatus('LIVE VIDEO CALL • NEERAJ AI IS HERE');
      else setStatus(room.error ?? room.message ?? 'LIVE CALL IS NOT CONFIGURED YET');
    } catch (error) { setStatus(`VIDEO CALL ERROR • ${error instanceof Error ? error.message : 'TRY AGAIN'}`); }
    finally { setStartingCall(false); }
  };

  return <main className="neeraj-screen">
    <style>{`.header-center{display:none}.neeraj-header .system-pill{flex-shrink:0}.feature-row,.focus-button,.approach-button{font:inherit;text-align:left;cursor:pointer;color:inherit;width:100%;appearance:none}.feature-row{transition:transform .18s ease,border-color .18s ease,background .18s ease}.feature-row:hover,.feature-row:focus-visible{background:rgba(0,242,254,.09);outline:none}.focus-button,.approach-button{border:0;background:transparent}.focus-button:hover,.approach-button:hover{background:rgba(0,242,254,.055);outline:none}.focus-button:focus-visible,.approach-button:focus-visible{outline:1px solid var(--cyan);outline-offset:-1px}.mode-switch button:not(.active):hover{color:#b9efff;background:rgba(0,242,254,.07)}.chat-input button,.call-button,.stop-button{cursor:pointer}.call-button:disabled{cursor:wait;opacity:.6}`}</style>
    <canvas ref={ref} className="hologram-canvas" /><div className="screen-grid" />
    <header className="neeraj-header"><div className="brand-lockup"><div className="brand-orb">N</div><div><div className="brand-name">NEERAJ <span>AI</span></div><div className="brand-line">Career. Growth. Global.</div></div></div><div className="system-pill"><i /> ONLINE <b>│</b> WEBGPU <b>│</b> TYPEGPU <b>│</b> REACT</div></header>
    <section className="hero-grid">
      <aside className="left-rail">
        <div className="speech-card"><div className="eyebrow">AI CAREER COMPANION</div><h2>Hi, I'm Neeraj!</h2><strong>Your AI Career Companion.</strong><p>I help professionals navigate their career journey — with clarity, skills, opportunities and the right strategy.</p><button onClick={() => { setMode('companion'); setSelectedCategory('Ask'); setStatus('READY • ASK NEERAJ ANYTHING'); chatInputRef.current?.focus(); }}>Ask me anything…</button></div>
        {['Career Guidance|Plan • Pivot • Progress','Global Opportunities|75+ Countries','Resume & LinkedIn|Optimize • Stand Out','Interview Prep|Practice • Succeed','Market Insights|Trends • Skills • Roles'].map((x) => { const [a,b]=x.split('|'); return <button className="feature-row" key={a} onClick={() => activateCategory(a)} aria-label={`Open ${a}` }><span>{a.slice(0,1)}</span><div><b>{a}</b><small>{b}</small></div></button>; })}
      </aside>
      <section className="avatar-stage">
        <div className="stage-label"><span>●</span> {liveRoom?.conversation_url ? 'LIVE VIDEO CALL • NEERAJ AI' : 'LIVE 3D AI CAREER COMPANION'}</div>
        {liveRoom?.conversation_url ? <div className="live-call-stage"><iframe title="Neeraj AI live video career companion" src={liveRoom.conversation_url} allow="camera; microphone; autoplay; fullscreen; display-capture" /><div className="call-badge">● LIVE • AI REPRESENTATION</div></div> : <div className="live-avatar">{avatarVideo ? <video src={avatarVideo} autoPlay playsInline onEnded={() => setAvatarVideo(null)} /> : <AvatarEngine onApi={(api) => { apiRef.current = api; }} onStatus={setStatus} />}<div className="live-ring" /><div className="live-floor" /></div>}
        {performance && <div className="performance-strip"><span>FACE: {performance.expression}</span><span>GESTURE: {performance.gesture}</span><span>BODY: {performance.body}</span><span>GAZE: {performance.gaze}</span></div>}
        <div className="conversation">{response && <div className="response">{response}</div>}{transcript && <div className="transcript">YOU: {transcript}</div>}</div>
      </section>
      <aside className="right-rail">
        <button className="map-card focus-button" onClick={() => activateCategory('Global Opportunities')} aria-label="Explore global opportunities"><div className="eyebrow">GLOBAL REACH</div><strong>75+<small>Countries</small></strong><div className="map-lines">✦　◌　✧　◌　✦</div></button>
        <div className="dual-card"><div><div className="eyebrow">FOCUS AREAS</div>{['Technology','FinTech','Healthcare','Energy & Power','Telecom','Startups','MNCs'].map((name) => <button className="focus-button" key={name} onClick={() => activateCategory(name)}>◈ {name}</button>)}</div><button className="quote focus-button" onClick={() => processQuestion('Give me career advice inspired by the idea that success is about growing through the journey, not only reaching the destination.')}>“Success is not just about reaching the destination, but growing in the journey.”<em>— Neeraj</em></button></div>
        <div className="approach"><div className="eyebrow">MY APPROACH</div><div className="approach-grid">{['Empathetic','Strategic','Data-Driven','People First'].map((name) => <button className="approach-button" key={name} onClick={() => activateCategory(name)}><span>{name === 'Empathetic' ? '♡' : name === 'Strategic' ? '♧' : name === 'Data-Driven' ? '▥' : '♙'}<small>{name}</small></span></button>)}</div></div>
      </aside>
    </section>
    <section className="control-deck"><div className="mode-switch"><button className={mode === 'companion' ? 'active' : ''} onClick={() => { setMode('companion'); setSelectedCategory(''); setStatus('READY • 3D NEERAJ AVATAR'); }}>3D AVATAR</button><button className={mode === 'profile' ? 'active' : ''} onClick={activateProfile}>PROFILE</button></div><div className="chat-input"><span>◌</span><input ref={chatInputRef} placeholder="Type to Chat with Neeraj" onKeyDown={(e) => { if (e.key==='Enter') { processQuestion(e.currentTarget.value); e.currentTarget.value=''; } }} /><button onClick={toggleVoice} aria-label={listening ? 'Stop voice input' : 'Start voice input'}>{listening ? 'STOP' : '🎙'}</button></div><select aria-label="Conversation language" value={language} onChange={(e) => { setLanguage(e.target.value); setStatus(`LANGUAGE READY • ${e.target.options[e.target.selectedIndex].text}`); }}><option value="en-IN">English</option><option value="hi-IN">हिन्दी</option><option value="ta-IN">தமிழ்</option><option value="te-IN">తెలుగు</option><option value="bn-IN">বাংলা</option><option value="mr-IN">मराठी</option></select><button className="call-button" disabled={startingCall} onClick={startVideoCall}>{startingCall ? 'CONNECTING…' : 'VIDEO CALL'}</button>{liveRoom?.conversation_url && <button className="stop-button" onClick={() => { setLiveRoom(null); setStatus('VIDEO CALL ENDED • 3D NEERAJ AI READY'); }}>END CALL</button>}{speaking && <button className="stop-button" onClick={stopSpeaking}>STOP VOICE</button>}</section>
    <footer className="neeraj-footer"><span>AI CAREER INTELLIGENCE</span><span>VOICE • FACE • EXPRESSION • BODY • BRAIN • MULTILINGUAL</span><span>HOLOGRAM SYSTEM v3.2</span></footer><div className="ai-disclosure">AI representation of Neeraj Kapil • generated responses are not statements made by the physical Neeraj.</div>
  </main>;
}
export default App;
