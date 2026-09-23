import { useCallback, useEffect, useRef, useState } from 'react';

const getBackendWsUrl = () => {
  const configured = String(import.meta.env.VITE_BACKEND_WS_URL ?? '').trim();
  if (configured) return configured.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.hostname}:8000/ws`;
  }
  return 'ws://127.0.0.1:8000/ws';
};

export type AvatarPerformance = {
  emotion: string;
  expression: string;
  gesture: string;
  head: string;
  body: string;
  gaze: string;
  intensity: number;
};

type ServerMessage =
  | { type: 'transcription'; text: string }
  | { type: 'message'; role: 'assistant'; content: string }
  | { type: 'performance'; performance: AvatarPerformance }
  | { type: 'audio'; audio: string; mime: string }
  | { type: 'avatar_video'; video: string; mime: string }
  | { type: 'done' };

export type BrainStatus = 'connecting' | 'ready' | 'offline';

export function useHologramBrain(opts: {
  onAssistantText: (text: string) => void;
  onSpeechStart: () => void;
  onSpeechEnd: () => void;
  onAmplitude: (level: number) => void;
  onPerformance?: (performance: AvatarPerformance) => void;
  onAvatarVideo?: (src: string | null) => void;
}) {
  const { onAssistantText, onSpeechStart, onSpeechEnd, onAmplitude, onPerformance, onAvatarVideo } = opts;
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [status, setStatus] = useState<BrainStatus>('connecting');

  useEffect(() => {
    let disposed = false;
    let retryMs = 1000;

    const connect = () => {
      if (disposed) return;
      setStatus('connecting');
      const socket = new WebSocket(getBackendWsUrl());
      socketRef.current = socket;

      socket.onopen = () => {
        retryMs = 1000;
        setStatus('ready');
      };

      socket.onclose = () => {
        if (disposed) return;
        setStatus('offline');
        reconnectRef.current = window.setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, 10000);
      };

      socket.onerror = () => {
        setStatus('offline');
      };

      socket.onmessage = async (event) => {
        try {
          const data: ServerMessage = JSON.parse(event.data);
          if (data.type === 'message') onAssistantText(data.content);
          else if (data.type === 'performance') onPerformance?.(data.performance);
          else if (data.type === 'audio') await playBase64Audio(data.audio);
          else if (data.type === 'avatar_video') {
            const bytes = Uint8Array.from(atob(data.video), (c) => c.charCodeAt(0));
            const url = URL.createObjectURL(new Blob([bytes], { type: data.mime || 'video/mp4' }));
            onAvatarVideo?.(url);
          }
        } catch (error) {
          console.error('Neeraj AI websocket message error', error);
        }
      };
    };

    const playBase64Audio = async (base64: string) => {
      const ctx = audioCtxRef.current ?? (audioCtxRef.current = new AudioContext());
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
      let smoothed = 0;
      const tick = () => {
        analyser.getByteFrequencyData(freqData);
        const avg = freqData.reduce((sum, v) => sum + v, 0) / freqData.length;
        const raw = Math.min(1, avg / 90);
        smoothed += (raw - smoothed) * 0.22;
        onAmplitude(smoothed);
        window.dispatchEvent(new CustomEvent('neeraj:audio-spectrum', {
          detail: { bytes: new Uint8Array(freqData), amplitude: smoothed },
        }));
        raf = requestAnimationFrame(tick);
      };
      tick();

      await new Promise<void>((resolve) => { source.onended = () => resolve(); });
      currentSourceRef.current = null;
      cancelAnimationFrame(raf);
      onAmplitude(0);
      window.dispatchEvent(new CustomEvent('neeraj:audio-spectrum', {
        detail: { bytes: new Uint8Array(freqData), amplitude: 0, ended: true },
      }));
      onSpeechEnd();
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectRef.current !== null) window.clearTimeout(reconnectRef.current);
      socketRef.current?.close();
      if (currentSourceRef.current) currentSourceRef.current.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendText = useCallback((text: string, language = 'en-IN') => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'text', text, language }));
      return true;
    }
    return false;
  }, []);

  const sendAudio = useCallback((blob: Blob, language = 'en-IN') => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return false;
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      socket.send(JSON.stringify({ type: 'audio', audio: base64, language }));
    };
    reader.readAsDataURL(blob);
    return true;
  }, []);

  const stopSpeaking = useCallback(() => currentSourceRef.current?.stop(), []);

  return { status, sendText, sendAudio, stopSpeaking };
}
