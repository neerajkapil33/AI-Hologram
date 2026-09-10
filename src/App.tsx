import { useMemo, useRef, useState } from 'react';
import { common, d } from 'typegpu';
import { useConfigureContext, useFrame, useRoot } from '@typegpu/react';
import AvatarEngine, { type AvatarCommand } from './AvatarEngine';
import { useHologramBrain, type AvatarPerformance } from './useHologramBrain';

type Recognition = { start: () => void; stop: () => void; continuous: boolean; interimResults: boolean; lang: string; onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null };
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
type Mode = 'profile' | 'companion';
type LiveRoom = { conversation_url?: string; conversation_id?: string; error?: string; message?: string; configured?: boolean };

const API_BASE_URL = (import.meta.env.VITE_BACKEND_HTTP_URL ?? '').replace(/\/$/, '');
const TELEMETRY_ENDPOINT = API_BASE_URL ? `${API_BASE_URL}/api/v1/analyze` : '';

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
  'People First': 'Focus on people, leadership, communication, and sustainable career growth in your career advice.',
};

const localCareerReply = (question: string) => {
  const q = question.toLowerCase();
  if (q.includes('resume') || q.includes('linkedin')) return 'Start with a sharp value proposition, quantify 3–5 achievements, align keywords to the target role, and make LinkedIn headline + About + Featured tell the same career story.';
  if (q.includes('interview')) return 'Interview mode: answer with Situation → Action → Result, then add what you learned. Practice one role-specific story for leadership, conflict, failure, impact and problem solving.';
  if (q.includes('global') || q.includes('country') || q.includes('opportun')) return 'Global strategy: choose 2–3 target markets, map 20 target companies, identify skill gaps, build warm connections, and tailor your profile to each market rather than applying everywhere.';
  if (q.includes('technology') || q.includes('fintech') || q.includes('healthcare') || q.includes('telecom') || q.includes('energy') || q.includes('startup') || q.includes('mnc')) return 'Focus on the intersection of domain + technology + measurable business impact. Pick one high-value capability, build visible proof through projects, and target roles where that capability solves a real business problem.';
  if (q.includes('data-driven')) return 'Use a simple decision scorecard: learning potential, compensation, brand value, role scope, manager quality, location and long-term optionality. Score each 1–10 before choosing.';
  if (q.includes('empathetic') || q.includes('people first')) return 'People-first coaching: protect your energy, choose environments where you can learn and contribute, and treat relationships and communication as career assets—not side skills.';
  return 'A strong next move is usually a focused one: define the role you want, identify the top 3 skills it rewards, build evidence for those skills, and create a 30-day action plan. Connect the AI brain to unlock personalized live responses.';
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
  const [activeCategory, setActiveCategory] = useState('Career Guidance');

  const renderPipeline = useMemo(() => root.createRenderPipeline({ vertex: common.fullScreenTriangle, fragment: ({ uv }) => { 'use gpu'; return d.vec4f(0.003, 0.018 + uv.y * 0.015, 0.04 + uv.x * 0.025, 1); } }), [root]);
  const { ref, ctxRef } = useConfigureContext({ autoResize: true, alphaMode: 'premultiplied' });
  useFrame(() => { if (ctxRef.current) renderPipeline.withColorAttachment({ view: ctxRef.current }).draw(3); });
  const command = (c: AvatarCommand) => apiRef.current?.command(c);

  const { status: brainStatus, sendText, stopSpeaking } = useHologramBrain({
    onAssistantText: (text) => setResponse(text),
    onPerformance: (p) => { setPerformance(p); command({ type: 'performance', value: p }); setStatus(`NEERAJ ${p.emotion.toUpperCase()} • ${p.gesture.toUpperCase()} • ${p.body.toUpperCase()}`); },
    onSpeechStart: () => { setSpeaking(true); setStatus('NEERAJ SPEAKING • LIVE AI VOICE + EXPRESSION'); command({ type: 'expression', value: 'speaking' }); },
    onSpeechEnd: () => { setSpeaking(false); setStatus('NEERAJ READY • LISTENING'); command({ type: 'expression', value: 'neutral' }); command({ type: 'gesture', value: 'idle' }); command({ type: 'performance', value: { amplitude: 0, speaking: false } }); },
    onAmplitude: (level) => { command({ type: 'performance', value: { amplitude: level, voiceLevel: level, intensity: Math.max(0.15, level), speaking: level > 0.02 } }); command({ type: 'viseme', value: 'mouthOpen', weight: level }); },
    onAvatarVideo: (src) => setAvatarVideo(src),
  });

  const processQuestion = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setMode('companion');
    setTranscript(clean);
    setResponse('');
    command({ type: 'expression', value: 'thinking' });
    command({ type: 'gesture', value: 'nod' });
    if (brainStatus !== 'ready') {
      setResponse(localCareerReply(clean));
      setStatus('LOCAL CAREER MODE • AI BRAIN READY TO CONNECT');
      return;
    }
    setStatus('NEERAJ THINKING • FORMING YOUR RESPONSE');
    sendText(clean, language);
  };

  const dispatchTelemetry = async (domain: string) => {
    if (!TELEMETRY_ENDPOINT) return null;
    try {
      const res = await fetch(TELEMETRY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: 'NEERAJ-WEB', domain, client_timestamp: new Date().toISOString(), system_metrics: { health: 950, agility: 42, power: 68 } }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json() as { recommended_speed?: number };
    } catch {
      return null;
    }
  };

  const activateCategory = async (name: string) => {
    setActiveCategory(name);
    setStatus(`CATEGORY • ${name.toUpperCase()}`);
    const telemetry = await dispatchTelemetry(name);
    const shouldRun = telemetry?.recommended_speed ? telemetry.recommended_speed > 1000 : /opportunities|interview/i.test(name);
    command({ type: 'gesture', value: shouldRun ? 'run' : 'idle' });
    processQuestion(categoryPrompts[name] ?? `Tell me about ${name} for my career.`);
  };

  const activateProfile = () => {
    setMode('profile');
    setResponse('Career strategist • Technology • FinTech • Healthcare • Energy • Telecom • Global professional network');
    setTranscript('PROFILE MODE');
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
    if (!API_BASE_URL) {
      setResponse('Video Call needs a configured Tavus/backend endpoint. Set VITE_BACKEND_HTTP_URL in the deployment environment to launch a real call.');
      setStatus('VIDEO CALL • BACKEND ENDPOINT NOT CONFIGURED');
      return;
    }
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
    <canvas ref={ref} className="hologram-canvas" /><div className="screen-grid" />
    <header className="neeraj-header"><div className="brand-lockup"><div className="brand-orb">N</div><div><div className="brand-name">NEERAJ <span>AI</span></div><div className="brand-line">Career. Growth. Global.</div></div></div><div className="system-pill"><i /> WEBGL STABLE <b>│</b> TYPEGPU <b>│</b> REACT</div></header>
    <section className="hero-grid">
      <aside className="left-rail">
        <div className="speech-card"><div className="eyebrow">AI CAREER COMPANION</div><h2>Hi, I'm Neeraj!</h2><strong>Your AI Career Companion.</strong><p>Navigate career decisions with clarity, skills, opportunities and strategy — with local fallback actions when the AI brain is offline.</p><button type="button" onClick={() => { setMode('companion'); setStatus('READY • ASK NEERAJ ANYTHING'); chatInputRef.current?.focus(); }}>Ask me anything →</button></div>
        {['Career Guidance|Plan • Pivot • Progress','Global Opportunities|75+ Countries','Resume & LinkedIn|Optimize • Stand Out','Interview Prep|Practice • Succeed','Market Insights|Trends • Skills • Roles'].map((x) => { const [a,b]=x.split('|'); return <button type="button" className={`feature-row ${activeCategory === a ? 'active' : ''}`} key={a} onClick={() => void activateCategory(a)} aria-label={`Open ${a}`}><span>{a.slice(0,1)}</span><div><b>{a}</b><small>{b}</small></div></button>; })}
      </aside>
      <section className="avatar-stage">
        <div className="stage-label"><span>●</span> {liveRoom?.conversation_url ? 'LIVE VIDEO CALL • NEERAJ AI' : 'LIVE 3D AI CAREER COMPANION'}</div>
        {liveRoom?.conversation_url ? <div className="live-call-stage"><iframe title="Neeraj AI live video career companion" src={liveRoom.conversation_url} allow="camera; microphone; autoplay; fullscreen; display-capture" /><div className="call-badge">● LIVE • AI REPRESENTATION</div></div> : <div className="live-avatar">{avatarVideo ? <video src={avatarVideo} autoPlay playsInline onEnded={() => setAvatarVideo(null)} /> : <AvatarEngine onApi={(api) => { apiRef.current = api; }} onStatus={setStatus} />}<div className="live-ring" /><div className="live-floor" /></div>}
        {performance && <div className="performance-strip"><span>FACE: {performance.expression}</span><span>GESTURE: {performance.gesture}</span><span>BODY: {performance.body}</span><span>GAZE: {performance.gaze}</span></div>}
        <div className="conversation">{mode === 'profile' && <div className="profile-mode-card"><b>NEERAJ PROFILE</b><span>Career strategist • Global professional network</span></div>}{response && <div className="response">{response}</div>}{transcript && <div className="transcript">YOU: {transcript}</div>}</div>
      </section>
      <aside className="right-rail">
        <button type="button" className="map-card focus-button" onClick={() => void activateCategory('Global Opportunities')} aria-label="Explore global opportunities"><div className="eyebrow">GLOBAL REACH</div><strong>75+<small>Countries</small></strong><div className="map-lines">✦　◌　✧　◌　✦</div></button>
        <div className="dual-card"><div><div className="eyebrow">FOCUS AREAS</div>{['Technology','FinTech','Healthcare','Energy & Power','Telecom','Startups','MNCs'].map((name) => <button type="button" className={`focus-button ${activeCategory === name ? 'active' : ''}`} key={name} onClick={() => void activateCategory(name)}>◈ {name}</button>)}</div><button type="button" className="quote focus-button" onClick={() => processQuestion('Give me career advice inspired by the idea that success is about growing through the journey, not only reaching the destination.')}>“Success is not just about reaching the destination, but growing in the journey.”<em>— Neeraj</em></button></div>
        <div className="approach"><div className="eyebrow">MY APPROACH</div><div className="approach-grid">{['Empathetic','Strategic','Data-Driven','People First'].map((name) => <button type="button" className={`approach-button ${activeCategory === name ? 'active' : ''}`} key={name} onClick={() => void activateCategory(name)}><span>{name === 'Empathetic' ? '♡' : name === 'Strategic' ? '♧' : name === 'Data-Driven' ? '▥' : '♙'}<small>{name}</small></span></button>)}</div></div>
      </aside>
    </section>
    <section className="control-deck"><div className="mode-switch"><button type="button" className={mode === 'companion' ? 'active' : ''} onClick={() => { setMode('companion'); setStatus('READY • 3D NEERAJ AVATAR'); }}>3D AVATAR</button><button type="button" className={mode === 'profile' ? 'active' : ''} onClick={activateProfile}>PROFILE</button></div><div className="chat-input"><span>◌</span><input ref={chatInputRef} placeholder="Type to Chat with Neeraj" onKeyDown={(e) => { if (e.key==='Enter') { processQuestion(e.currentTarget.value); e.currentTarget.value=''; } }} /><button type="button" onClick={toggleVoice} aria-label={listening ? 'Stop voice input' : 'Start voice input'}>{listening ? 'STOP' : '🎙'}</button></div><select aria-label="Conversation language" value={language} onChange={(e) => { setLanguage(e.target.value); setStatus(`LANGUAGE READY • ${e.target.options[e.target.selectedIndex].text}`); }}><option value="en-IN">English</option><option value="hi-IN">हिन्दी</option><option value="ta-IN">தமிழ்</option><option value="te-IN">తెలుగు</option><option value="bn-IN">বাংলা</option><option value="mr-IN">मराठी</option></select><button type="button" className="call-button" disabled={startingCall} onClick={startVideoCall}>{startingCall ? 'CONNECTING…' : 'VIDEO CALL'}</button>{liveRoom?.conversation_url && <button type="button" className="stop-button" onClick={() => { setLiveRoom(null); setStatus('VIDEO CALL ENDED • 3D NEERAJ AI READY'); }}>END CALL</button>}{speaking && <button type="button" className="stop-button" onClick={stopSpeaking}>STOP VOICE</button>}</section>
    <footer className="neeraj-footer"><span>AI CAREER INTELLIGENCE</span><span>VOICE • FACE • EXPRESSION • BODY • BRAIN • MULTILINGUAL</span><span>HOLOGRAM SYSTEM v3.2</span></footer>
  </main>;
}
export default App;
