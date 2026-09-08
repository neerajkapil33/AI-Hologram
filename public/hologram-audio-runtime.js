(() => {
  const apply = (level) => {
    const stage = document.querySelector('.avatar-stage');
    if (!stage) return;
    const value = Math.max(0, Math.min(1, Number(level) || 0));
    stage.style.setProperty('--hud-level', String(value));
    stage.dataset.audioActive = value > 0.035 ? 'true' : 'false';
  };
  window.addEventListener('neeraj-audio-level', (event) => apply(event.detail));
  document.addEventListener('DOMContentLoaded', () => apply(0));
})();
