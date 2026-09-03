export type VisemeKeyframe = {
  t: number;
  value: string;
  weight?: number;
};

export type AvatarPerformanceEvent = {
  emotion: string;
  expression: 'neutral' | 'happy' | 'thinking' | 'speaking' | string;
  gesture: string;
  head: string;
  body: string;
  gaze: 'camera' | 'direct' | 'away' | string;
  intensity: number;
};

/** Backend-to-runtime contract. Timing is relative to the beginning of the audio clip. */
export type AvatarAudioEnvelope = {
  type: 'audio';
  audio: string;
  mime: string;
  durationMs?: number;
  visemes?: VisemeKeyframe[];
  language?: string;
};

export type AvatarBackendEvent =
  | { type: 'transcription'; text: string; language?: string }
  | { type: 'message'; role: 'assistant'; content: string; language?: string }
  | { type: 'performance'; performance: AvatarPerformanceEvent }
  | AvatarAudioEnvelope
  | { type: 'done' };

export const SUPPORTED_UI_LANGUAGES = [
  'en','hi','bn','ta','te','mr','gu','kn','ml','pa','ur','fr','de','es','pt','ar','ja'
] as const;

export type SupportedUiLanguage = typeof SUPPORTED_UI_LANGUAGES[number];
