/**
 * VisionAssist AI - Web Speech API Voice Recognition (Hold to Talk)
 */

export interface VoiceRecognitionResult {
  transcript: string;
  isFinal: boolean;
}

export class VoiceInputManager {
  private recognition: any = null;
  private isListening = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.maxAlternatives = 1;
      }
    }
  }

  public isSupported(): boolean {
    return Boolean(this.recognition);
  }

  public startListening(
    lang: 'en' | 'ru' = 'en',
    onResult: (text: string) => void,
    onError: (err: any) => void
  ): boolean {
    if (!this.recognition) return false;
    if (this.isListening) {
      try {
        this.recognition.abort();
      } catch {}
    }

    try {
      this.recognition.lang = lang === 'ru' ? 'ru-RU' : 'en-US';

      this.recognition.onstart = () => {
        this.isListening = true;
      };

      this.recognition.onresult = (event: any) => {
        const text = event.results?.[0]?.[0]?.transcript || '';
        onResult(text);
      };

      this.recognition.onerror = (event: any) => {
        this.isListening = false;
        onError(event.error);
      };

      this.recognition.onend = () => {
        this.isListening = false;
      };

      this.recognition.start();
      return true;
    } catch (e) {
      this.isListening = false;
      onError(e);
      return false;
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {}
    }
    this.isListening = false;
  }
}

export const voiceInputManager = new VoiceInputManager();
