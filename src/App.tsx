import { useMemo, useRef, useState } from 'react';
import { common, d } from 'typegpu';
import { useConfigureContext, useFrame, useRoot } from '@typegpu/react';
import { AvatarEngine, type AvatarCommand } from './AvatarEngine';

function App() {
  const root = useRoot();
  const apiRef = useRef<{ command: (c: AvatarCommand) => void } | null>(null);
  const [status, setStatus] = useState('INITIALIZING AVATAR ENGINE');
  const [speaking, setSpeaking] = useState(false);

  const pipeline = useMemo(() => root.createRenderPipeline({
    vertex: common.fullScreenTriangle,
    fragment: ({ uv }) => {
      'use gpu';
      return d.vec4f(0.005, 0.025 + uv.y * 0.015, 0.045 + uv.x * 0.025, 1);
    },
  }), [root]);

  const { ref, ctxRef } = useConfigureContext({ autoResize: true, alphaMode: 'premultiplied' });
  useFrame(() => { if (ctxRef.current) pipeline.withColorAttachment({ view: ctxRef.current }).draw(3); });

  const command = (c: AvatarCommand) => apiRef.current?.command(c);

  return <main className="hologram-app">
    <canvas ref={ref} className="hologram-canvas" />
    <div className="hud">
      <header className="top-bar">
        <div className="brand"><span className="status-dot" /> NEERAJ AI</div>
        <div className="system-status">WEBGPU <span>●</span>&nbsp;&nbsp; AVATAR <span>●</span></div>
      </header>
      <section className="center-content">
        <div className="avatar-frame">
          <div className="avatar-engine-wrap"><AvatarEngine apiRef={apiRef} onStatus={setStatus} /></div>
          <div className="scanline" />
          <div className="avatar-ring" /><div className="avatar-ring ring-two" />
        </div>
        <h1>NEERAJ</h1>
        <p className="subtitle">AI CAREER INTELLIGENCE</p>
        <p className="message">{status}</p>
        <div className="control-row">
          <button className="talk-button" onClick={() => { const next = !speaking; setSpeaking(next); command({ type: 'expression', value: next ? 'speaking' : 'neutral' }); }}>{speaking ? 'STOP SPEAKING' : 'TALK TO NEERAJ'}</button>
          <button className="mini-button" onClick={() => command({ type: 'expression', value: 'thinking' })}>THINK</button>
          <button className="mini-button" onClick={() => command({ type: 'gesture', value: 'wave' })}>WAVE</button>
          <button className="mini-button" onClick={() => command({ type: 'gesture', value: 'nod' })}>NOD</button>
        </div>
      </section>
      <footer className="bottom-bar"><span>HOLOGRAM ENGINE v2.0</span><span>GLB • MIXAMO • ARKIT • VISEMES READY</span></footer>
    </div>
  </main>;
}
export default App;
