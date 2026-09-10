/**
 * NEERAJ AI LOW-LATENCY AVATAR STREAM
 * Duplex WebSocket: text tokens + binary audio chunks.
 * The audio path publishes analyser frames through the same custom event
 * used by the live voice HUD, while AvatarEngine remains the real GLB avatar.
 */
let socketConnection = null;
const audioPlaybackQueue = [];
let isProcessingPlayback = false;
let audioContextInstance = null;
let audioAnalyserNode = null;

function initWebSocketAudioPipeline() {
  if (audioContextInstance) return;
  audioContextInstance = new (window.AudioContext || window.webkitAudioContext)();
  audioAnalyserNode = audioContextInstance.createAnalyser();
  audioAnalyserNode.fftSize = 512;
  audioAnalyserNode.smoothingTimeConstant = 0.78;
  audioAnalyserNode.connect(audioContextInstance.destination);
}

function publishAudioFrame() {
  if (!audioAnalyserNode) return;
  const bytes = new Uint8Array(audioAnalyserNode.frequencyBinCount);
  audioAnalyserNode.getByteFrequencyData(bytes);
  let sum = 0;
  for (const value of bytes) sum += value;
  const amplitude = Math.min(1, sum / (bytes.length * 255));
  window.dispatchEvent(new CustomEvent('neeraj:audio-spectrum', { detail: { bytes, amplitude } }));
}

async function processAudioQueue() {
  if (!audioPlaybackQueue.length) {
    isProcessingPlayback = false;
    window.dispatchEvent(new CustomEvent('neeraj:audio-spectrum', { detail: { amplitude: 0, ended: true } }));
    return;
  }
  isProcessingPlayback = true;
  const chunk = audioPlaybackQueue.shift();
  initWebSocketAudioPipeline();
  try {
    if (audioContextInstance.state === 'suspended') await audioContextInstance.resume();
    const decoded = await audioContextInstance.decodeAudioData(chunk.slice(0));
    const source = audioContextInstance.createBufferSource();
    source.buffer = decoded;
    source.connect(audioAnalyserNode);
    const timer = window.setInterval(publishAudioFrame, 32);
    source.onended = () => {
      window.clearInterval(timer);
      processAudioQueue();
    };
    source.start(0);
  } catch (error) {
    console.error('[AUDIO QUEUE] Could not decode binary voice chunk', error);
    processAudioQueue();
  }
}

function connectAvatarWebSocket(wsUrl = 'ws://127.0.0.1:8000/api/v1/avatar/stream') {
  if (socketConnection?.readyState === WebSocket.OPEN) return socketConnection;
  socketConnection = new WebSocket(wsUrl);
  socketConnection.binaryType = 'arraybuffer';
  socketConnection.onopen = () => console.log('[WEBSOCKET] Real-time avatar audio/text link operational.');
  socketConnection.onmessage = (event) => {
    if (typeof event.data === 'string') {
      window.dispatchEvent(new CustomEvent('neeraj:stream-token', { detail: { token: event.data } }));
      return;
    }
    if (event.data instanceof ArrayBuffer) {
      audioPlaybackQueue.push(event.data);
      if (!isProcessingPlayback) processAudioQueue();
    }
  };
  socketConnection.onerror = (error) => console.error('[WEBSOCKET ERROR] Stream transmission fault', error);
  socketConnection.onclose = () => console.log('[WEBSOCKET] Avatar stream closed.');
  return socketConnection;
}

function sendPromptPayload(messageString) {
  const prompt = String(messageString || '').trim();
  if (!prompt || socketConnection?.readyState !== WebSocket.OPEN) return false;
  socketConnection.send(JSON.stringify({ prompt }));
  return true;
}

window.NeerajAvatarWebSocket = {
  connectAvatarWebSocket,
  sendPromptPayload,
  close: () => socketConnection?.close(),
};
