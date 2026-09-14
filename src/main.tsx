import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// oxlint-disable-next-line import/no-unassigned-import -- imported for side effects
import './index.css';
// oxlint-disable-next-line import/no-unassigned-import -- responsive layout overrides
import './responsive.css';
// oxlint-disable-next-line import/no-unassigned-import -- cinematic Spatial Breakout runtime
import './spatial-breach-runtime';
// oxlint-disable-next-line import/no-unassigned-import -- Chatterbox voice-clone bridge for the breakout introduction
import './spatial-voice-runtime';
// oxlint-disable-next-line import/no-unassigned-import -- hooks the loaded Three.js avatar skeleton and depth boundary
import './avatar/spatial-body-breakout';
import App from './App.tsx';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
