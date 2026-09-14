const TTS_BASE_URL = String(import.meta.env.VITE_TTS_URL || 'http://localhost:8000').replace(/\/$/, '');
const INTRO = 'Hi, my name is Neeraj Kapil. Nice to meet you.';

let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
let originalSpeak: SpeechSynthesis['speak'] | null = null;
let originalCancel: SpeechSynthesis['cancel'] | null = null;
let patched = false;

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
    utterance.onstart?.(new Event('start'));
    audio.onended = () => {
      if (currentAudio === audio) {
        currentAudio = null;
        utterance.onend?.(new Event('end'));
      }
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
        currentUrl = null;
      }
    };
    audio.onerror = () => {
      if (currentAudio === audio) currentAudio = null;
      utterance.onerror?.(new SpeechSynthesisErrorEvent('error', { error: 'audio-busy' }));
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
        currentUrl = null;
      }
    };
    await audio.play();
  } catch (error) {
    console.error('Neeraj Chatterbox voice unavailable:', error);
    // Do not silently substitute a different voice. The existing AvatarEngine
    // callback will receive an error and can leave the avatar quiet instead of
    // unexpectedly switching to robotic browser speech.
    utterance.onerror?.(new SpeechSynthesisErrorEvent('error', { error: 'voice-unavailable' }));
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
