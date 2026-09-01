import { useMemo } from 'react';
import { common, d } from 'typegpu';
import { useConfigureContext, useFrame, useRoot } from '@typegpu/react';

function App() {
  const root = useRoot();

  const renderPipeline = useMemo(
    () =>
      root.createRenderPipeline({
        vertex: common.fullScreenTriangle,
        fragment: ({ uv }) => {
          'use gpu';

          return d.vec4f(
            0.005,
            0.025 + uv.y * 0.015,
            0.045 + uv.x * 0.025,
            1,
          );
        },
      }),
    [root],
  );

  const { ref, ctxRef } = useConfigureContext({
    autoResize: true,
    alphaMode: 'premultiplied',
  });

  useFrame(() => {
    if (!ctxRef.current) return;

    renderPipeline
      .withColorAttachment({ view: ctxRef.current })
      .draw(3);
  });

  return (
    <main className="hologram-app">
      <canvas ref={ref} className="hologram-canvas" />

      <div className="hud">
        <header className="top-bar">
          <div className="brand">
            <span className="status-dot" />
            NEERAJ AI
          </div>

          <div className="system-status">
            WEBGPU <span>●</span>
          </div>
        </header>

        <section className="center-content">
          <div className="avatar-frame">
            <div className="scanline" />

            <div className="avatar-placeholder">
              <div className="avatar-ring" />
              <div className="avatar-ring ring-two" />

              <div className="avatar-core">N</div>
            </div>
          </div>

          <h1>NEERAJ</h1>

          <p className="subtitle">
            AI CAREER INTELLIGENCE
          </p>

          <p className="message">
            Your intelligent career companion
          </p>

          <button className="talk-button">
            <span className="mic">●</span>
            TALK TO NEERAJ
          </button>
        </section>

        <footer className="bottom-bar">
          <span>HOLOGRAM SYSTEM v1.0</span>
          <span>READY</span>
        </footer>
      </div>
    </main>
  );
}

export default App;