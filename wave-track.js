(() => {
  let canvas = null;
  let ctx = null;
  let spectrum = new Uint8Array(0);
  let amplitude = 0;
  let lastFrame = 0;

  const ensureCanvas = () => {
    if (canvas?.isConnected) return true;
    const host = document.querySelector('.performance-strip');
    if (!host) return false;
    canvas = document.createElement('canvas');
    canvas.id = 'volume-spectrum-track';
    canvas.setAttribute('aria-label', 'Live voice frequency visualization');
    canvas.style.cssText = 'display:block;width:100%;height:28px;min-height:28px;margin:5px 0 0;opacity:.9;pointer-events:none;';
    host.appendChild(canvas);
    ctx = canvas.getContext('2d');
    return Boolean(ctx);
  };

  const resize = () => {
    if (!canvas || !ctx) return;
    const width = Math.max(1, Math.floor(canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2)));
    const height = Math.max(1, Math.floor(canvas.clientHeight * Math.min(window.devicePixelRatio || 1, 2)));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  };

  const draw = (timestamp) => {
    lastFrame = timestamp;
    if (!ensureCanvas()) { requestAnimationFrame(draw); return; }
    resize();
    if (!ctx || !canvas) { requestAnimationFrame(draw); return; }
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    const mid = height / 2;
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, 'rgba(6,182,212,.12)');
    gradient.addColorStop(.5, 'rgba(0,242,254,.88)');
    gradient.addColorStop(1, 'rgba(59,130,246,.18)');
    ctx.beginPath();
    ctx.lineWidth = Math.max(1, (window.devicePixelRatio || 1));
    ctx.strokeStyle = gradient;
    if (spectrum.length) {
      const step = width / Math.max(1, spectrum.length - 1);
      for (let i = 0; i < spectrum.length; i++) {
        const x = i * step;
        const value = spectrum[i] / 255;
        const offset = value * height * .42 * (.55 + amplitude * .9);
        if (i === 0) ctx.moveTo(x, mid - offset); else ctx.lineTo(x, mid - offset);
      }
      for (let i = spectrum.length - 1; i >= 0; i--) {
        const x = i * step;
        const value = spectrum[i] / 255;
        const offset = value * height * .42 * (.55 + amplitude * .9);
        ctx.lineTo(x, mid + offset);
      }
    } else {
      ctx.moveTo(0, mid); ctx.lineTo(width, mid);
    }
    ctx.stroke();
    requestAnimationFrame(draw);
  };

  window.addEventListener('neeraj:audio-spectrum', (event) => {
    const detail = event?.detail || {};
    if (detail.bytes instanceof Uint8Array) spectrum = new Uint8Array(detail.bytes);
    amplitude = Number(detail.amplitude ?? 0);
    if (detail.ended) { amplitude = 0; spectrum = new Uint8Array(0); }
  });
  window.addEventListener('resize', resize, { passive: true });
  const observer = new MutationObserver(() => ensureCanvas());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  requestAnimationFrame(draw);
  window.NeerajWaveTrack = { ensure: ensureCanvas, getAmplitude: () => amplitude, getLastFrame: () => lastFrame };
})();
