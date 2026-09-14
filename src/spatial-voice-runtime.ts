const TTS_BASE_URL = String(import.meta.env.VITE_TTS_URL || 'http://localhost:8000').replace(/\/$/, '');
const INTRO = 'Hi, my name is Neeraj Kapil. Nice to meet you.';

let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
let originalSpeak: SpeechSynthesis['speak'] | null = null;
let originalCancel: SpeechSynthesis['cancel'] | null = null;
let patched = false;

const asSpeechEvent = (utterance: SpeechSynthesisUtterance, type: 'start' | 'end') => {
  const event = new Event(type) as SpeechSynthesisEvent;
  Object.defineProperty(event, 'utterance', { value: utterance });
  return event;
};

const asSpeechErrorEvent = (utterance: SpeechSynthesisUtterance, error: SpeechSynthesisErrorCode) => {
  const event = new Event('error') as SpeechSynthesisErrorEvent;
  Object.defineProperties(event, {
    utterance: { value: utterance },
    error: { value: error },
  });
  return event;
};

const stopAudio = () => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio = null;
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
};

const playClone = async (utterance: SpeechSynthesisUtterance) => {
  stopAudio();
  try {
    const response = await fetch(`${TTS_BASE_URL}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: utterance.text || INTRO,
        language_id: 'en',
        response_format: 'wav',
      }),
    });
    if (!response.ok) throw new Error(`Chatterbox HTTP ${response.status}`);

    const blob = await response.blob();
    currentUrl = URL.createObjectURL(blob);
    const audio = new Audio(currentUrl);
    currentAudio = audio;
    utterance.onstart?.(asSpeechEvent(utterance, 'start'));
    audio.onended = () => {
      if (currentAudio === audio) {
        currentAudio = null;
        utterance.onend?.(asSpeechEvent(utterance, 'end'));
      }
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
        currentUrl = null;
      }
    };
    audio.onerror = () => {
      if (currentAudio === audio) currentAudio = null;
      utterance.onerror?.(asSpeechErrorEvent(utterance, 'audio-busy'));
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
        currentUrl = null;
      }
    };
    await audio.play();
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

  synth.speak = ((utterance: SpeechSynthesisUtterance) => {
    void playClone(utterance);
  }) as SpeechSynthesis['speak'];

  synth.cancel = (() => {
    stopAudio();
  }) as SpeechSynthesis['cancel'];
  patched = true;
};

patchSpeech();

window.addEventListener('neeraj:spatial-breakout', event => {
  const active = Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active);
  if (!active) stopAudio();
});

window.addEventListener('beforeunload', () => {
  stopAudio();
  if (patched && 'speechSynthesis' in window && originalSpeak && originalCancel) {
    window.speechSynthesis.speak = originalSpeak;
    window.speechSynthesis.cancel = originalCancel;
  }
});
