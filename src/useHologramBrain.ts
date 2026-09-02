import { useCallback, useEffect, useRef, useState } from 'react';

const BACKEND_WS_URL = import.meta.env.VITE_BACKEND_WS_URL ?? 'ws://127.0.0.1:8000/ws';

type ServerMessage =
  | { type: 'transcription'; text: string }
  | { type: 'message'; role: 'assistant'; content: string }
  | { type: 'audio'; audio: string; mime: string }
  | { type: 'avatar_video'; video: string; mime: string }
  | { type: 'done' };

export type BrainStatus = 'connecting' | 'ready' | 'offline';

export function useHologramBrain(opts: {
  onAssistantText: (text: string) => void;
  onSpeechStart: () => void;
  onSpeechEnd: () => void;
  onAmplitude: (level: number) => void;
  onAvatarVideo?: (src: string | null) => void;
}) {
  const { onAssistantText, onSpeechStart, onSpeechEnd, onAmplitude, onAvatarVideo } = opts;
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
      if (data.type === 'message') onAssistantText(data.content);
      else if (data.type === 'audio') await playBase64Audio(data.audio);
      else if (data.type === 'avatar_video') {
        const bytes = Uint8Array.from(atob(data.video), (c) => c.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: data.mime || 'video/mp4' }));
        onAvatarVideo?.(url);
      }
    };

    return () => {
      socket.close();
      if (currentSourceRef.current) currentSourceRef.current.stop();
    };
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

    await new Promise<void>((resolve) => { source.onended = () => resolve(); });
    currentSourceRef.current = null;
    cancelAnimationFrame(raf);
    onAmplitude(0);
    onSpeechEnd();
  };

  const sendText = useCallback((text: string, language = 'en') => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'text', text, language }));
  }, []);

  const stopSpeaking = useCallback(() => currentSourceRef.current?.stop(), []);

  return { status, sendText, stopSpeaking };
}
