import { useCallback, useEffect, useRef, useState } from 'react';

// Change if your backend runs somewhere other than localhost:8000
// (see backend/main.py / start_windows.ps1).
const BACKEND_WS_URL = 'ws://127.0.0.1:8000/ws';

type ServerMessage =
  | { type: 'transcription'; text: string }
  | { type: 'message'; role: 'assistant'; content: string }
  | { type: 'audio'; audio: string; mime: string }
  | { type: 'avatar_video'; video: string; mime: string }
  | { type: 'done' };

export type BrainStatus = 'connecting' | 'ready' | 'offline';

/**
 * Owns the WebSocket to backend/main.py and decodes the audio replies it
 * sends back into an AudioBufferSourceNode, exposing a live 0..1 amplitude
 * value each frame so the caller can drive viseme/mouth-open commands on
 * the Three.js avatar in sync with the actual cloned voice.
 */
export function useHologramBrain(opts: {
  onAssistantText: (text: string) => void;
  onSpeechStart: () => void;
  onSpeechEnd: () => void;
  onAmplitude: (level: number) => void;
}) {
  const { onAssistantText, onSpeechStart, onSpeechEnd, onAmplitude } = opts;
  const socketRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [status, setStatus] = useState<BrainStatus>('connecting');

  useEffect(() => {
    const socket = new WebSocket(BACKEND_WS_URL);
    socketRef.current = socket;

    socket.onopen = () => setStatus('ready');
    socket.onclose = () => setStatus('offline');
    socket.onerror = () => setStatus('offline');

    socket.onmessage = async (event) => {
      const data: ServerMessage = JSON.parse(event.data);
      if (data.type === 'message') {
        onAssistantText(data.content);
      } else if (data.type === 'audio') {
        await playBase64Audio(data.audio);
      }
      // 'transcription' (server-side STT) and 'avatar_video' (MuseTalk) are
      // available from the backend but not consumed here yet — the current
      // Three.js avatar is driven by amplitude, not a generated video frame.
    };

    return () => socket.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ensureAudioCtx = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    return audioCtxRef.current;
  };

  const playBase64Audio = async (base64: string) => {
    const ctx = ensureAudioCtx();
    await ctx.resume();
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    currentSourceRef.current = source;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    source.connect(analyser);
    analyser.connect(ctx.destination);

    onSpeechStart();
    source.start();

    let raf = 0;
    const tick = () => {
      analyser.getByteFrequencyData(freqData);
      const avg = freqData.reduce((sum, v) => sum + v, 0) / freqData.length;
      onAmplitude(Math.min(1, avg / 90));
      raf = requestAnimationFrame(tick);
    };
    tick();

    await new Promise<void>((resolve) => {
      source.onended = () => resolve();
    });
    currentSourceRef.current = null;
    cancelAnimationFrame(raf);
    onAmplitude(0);
    onSpeechEnd();
  };

  const sendText = useCallback((text: string) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'text', text }));
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    // .onended fires on manual stop() too, so this naturally triggers
    // onAmplitude(0) + onSpeechEnd() via the same path as a normal finish.
    currentSourceRef.current?.stop();
  }, []);

  return { status, sendText, stopSpeaking };
}
