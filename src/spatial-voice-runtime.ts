const TTS_BASE_URL = String(import.meta.env.VITE_TTS_URL || 'http://localhost:8000').replace(/\/$/, '');
const INTRO = 'Hi, my name is Neeraj Kapil. Nice to meet you.';

type VoiceCallbacks = { onstart?: () => void; onend?: () => void; onerror?: (error: unknown) => void };
let currentSource: AudioBufferSourceNode | null = null;
let audioContext: AudioContext | null = null;
let originalSpeak: SpeechSynthesis['speak'] | null = null;
let originalCancel: SpeechSynthesis['cancel'] | null = null;
let patched = false;

const getAudioContext = () => { if (!audioContext) audioContext = new AudioContext(); return audioContext; };
const unlockAudio = () => { try { void getAudioContext().resume(); } catch (error) { console.warn('Neeraj audio context unavailable:', error); } };
const stopAudio = () => { if (currentSource) { try { currentSource.stop(); } catch { /* already stopped */ } currentSource.disconnect(); currentSource = null; } };

const asSpeechEvent = (utterance: SpeechSynthesisUtterance, type: 'start' | 'end') => {
  const event = new Event(type) as SpeechSynthesisEvent;
  Object.defineProperty(event, 'utterance', { value: utterance });
  return event;
};
const asSpeechErrorEvent = (utterance: SpeechSynthesisUtterance, error: SpeechSynthesisErrorCode) => {
  const event = new Event('error') as SpeechSynthesisErrorEvent;
  Object.defineProperties(event, { utterance: { value: utterance }, error: { value: error } });
  return event;
};

const fetchVoice = async (text: string) => {
  const response = await fetch(`${TTS_BASE_URL}/v1/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: text, language_id: 'en', response_format: 'wav' }),
  });
  if (!response.ok) throw new Error(`Chatterbox HTTP ${response.status}`);
  return response.blob();
};

const playBlob = async (blob: Blob, callbacks: VoiceCallbacks = {}) => {
  const context = getAudioContext();
  await context.resume();
  const buffer = await context.decodeAudioData((await blob.arrayBuffer()).slice(0));
  stopAudio();
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  currentSource = source;
  source.onended = () => { if (currentSource === source) currentSource = null; callbacks.onend?.(); };
  callbacks.onstart?.();
  source.start(0);
};

export const speakNeerajBreakout = async (callbacks: VoiceCallbacks = {}) => {
  unlockAudio();
  try { await playBlob(await fetchVoice(INTRO), callbacks); }
  catch (error) { console.error('Neeraj Chatterbox voice unavailable:', error); callbacks.onerror?.(error); }
};

const playClone = async (utterance: SpeechSynthesisUtterance) => {
  try {
    unlockAudio();
    await playBlob(await fetchVoice(utterance.text || INTRO), {
      onstart: () => utterance.onstart?.(asSpeechEvent(utterance, 'start')),
      onend: () => utterance.onend?.(asSpeechEvent(utterance, 'end')),
      onerror: error => utterance.onerror?.(asSpeechErrorEvent(utterance, error instanceof Error ? 'voice-unavailable' : 'audio-busy')),
    });
  } catch (error) {
    console.error('Neeraj Chatterbox voice unavailable:', error);
    utterance.onerror?.(asSpeechErrorEvent(utterance, 'voice-unavailable'));
  }
};

const patchSpeech = () => {
  if (patched || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  originalSpeak = synth.speak.bind(synth);
  originalCancel = synth.cancel.bind(synth);
  synth.speak = ((utterance: SpeechSynthesisUtterance) => { void playClone(utterance); }) as SpeechSynthesis['speak'];
  synth.cancel = (() => { stopAudio(); }) as SpeechSynthesis['cancel'];
  patched = true;
};
patchSpeech();

window.addEventListener('neeraj:spatial-breakout', event => {
  const active = Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active);
  if (active) unlockAudio(); else stopAudio();
});
window.addEventListener('beforeunload', () => {
  stopAudio();
  if (audioContext) void audioContext.close();
  if (patched && 'speechSynthesis' in window && originalSpeak && originalCancel) {
    window.speechSynthesis.speak = originalSpeak;
    window.speechSynthesis.cancel = originalCancel;
  }
});
