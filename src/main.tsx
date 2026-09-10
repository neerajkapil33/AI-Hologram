import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// oxlint-disable-next-line import/no-unassigned-import -- imported for side effects
import './index.css';
// oxlint-disable-next-line import/no-unassigned-import -- responsive layout overrides
import './responsive.css';
import App from './App.tsx';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
