/**
 * VisionAssist AI - Web Audio API and Speech Synthesis Engine
 * Features:
 * - 3D Spatial Stereo Panning based on 12-hour clock direction (-0.85 left to +0.85 right)
 * - TIER 1 Critical emergency alert: 880Hz square wave with rapid collision stop pulses
 * - TIER 2 Warning & TIER 3 Informational acoustic earcons
 * - Continuous Light Sonar (frequency rises with luminance)
 * - Tactical haptic pulses
 * - Garbage-collection-safe Speech Synthesis with EN and RU voice selection
 */

let audioCtx: AudioContext | null = null;
const activeUtterances = new Set<SpeechSynthesisUtterance>();
let isAudioUnlocked = false;

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Unlocks Web Audio on first user interaction
 */
export function unlockAudio() {
  if (isAudioUnlocked) return;
  isAudioUnlocked = true;

  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const silent = new SpeechSynthesisUtterance(' ');
      silent.volume = 0.01;
      silent.rate = 1.0;
      window.speechSynthesis.speak(silent);
    }
  } catch {
    // ignore
  }
}

/**
 * Maps clock coordinate to stereo pan value (-1.0 left to +1.0 right)
 */
function getClockPan(clockDirection?: string): number {
  if (!clockDirection) return 0;
  switch (clockDirection) {
    case '9':
      return -0.85; // Directly left
    case '10':
      return -0.55;
    case '11':
      return -0.25;
    case '12':
      return 0.0; // Straight ahead
    case '1':
      return 0.25;
    case '2':
      return 0.55;
    case '3':
      return 0.85; // Directly right
    default:
      return 0.0;
  }
}

function connectSpatialPanner(ctx: AudioContext, sourceNode: AudioNode, clockDirection?: string) {
  const panValue = getClockPan(clockDirection);
  if (typeof ctx.createStereoPanner === 'function') {
    try {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(panValue, ctx.currentTime);
      sourceNode.connect(panner);
      panner.connect(ctx.destination);
      return;
    } catch {
      // fallback
    }
  }
  sourceNode.connect(ctx.destination);
}

/**
 * Play 3D spatialized earcon based on hazard level & clock direction
 * TIER 1 uses 880Hz square wave for immediate collision stops
 */
export function playHazardTone(level: number, clockDirection: string = '12') {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    if (level === 1) {
      // TIER 1 - CRITICAL EMERGENCY: 880Hz square wave with dual sharp pulses
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now); // 880Hz square wave per spec

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

      osc.connect(gain);
      connectSpatialPanner(ctx, gain, clockDirection);

      osc.start(now);
      osc.stop(now + 0.28);

      // Second urgent echo pulse
      setTimeout(() => {
        try {
          const secondNow = ctx.currentTime;
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'square';
          osc2.frequency.setValueAtTime(880, secondNow);
          gain2.gain.setValueAtTime(0.45, secondNow);
          gain2.gain.exponentialRampToValueAtTime(0.01, secondNow + 0.25);
          osc2.connect(gain2);
          connectSpatialPanner(ctx, gain2, clockDirection);
          osc2.start(secondNow);
          osc2.stop(secondNow + 0.25);
        } catch {}
      }, 120);
    } else if (level === 2) {
      // TIER 2 - WARNING: 580Hz down to 440Hz alert ping
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.25);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.connect(gain);
      connectSpatialPanner(ctx, gain, clockDirection);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (level === 3 || level === 4) {
      // TIER 3 - INFORMATIONAL: Gentle pleasant chime (523Hz C5 to 659Hz E5)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.2);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.connect(gain);
      connectSpatialPanner(ctx, gain, clockDirection);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (err) {
    console.warn('Audio synthesis warning:', err);
  }
}

/**
 * Continuous Light Sonar Tone Engine (Seeing AI Light Channel)
 * Pitch rises from 200 Hz to 1350 Hz based on luminance
 */
class LightSonarEngine {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private isRunning: boolean = false;

  public start() {
    if (this.isRunning) return;
    try {
      const ctx = getAudioContext();
      this.ctx = ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      this.osc = osc;
      this.gain = gain;
      this.isRunning = true;
    } catch {}
  }

  public updateLuminance(luminance: number) {
    if (!this.isRunning || !this.osc || !this.ctx) return;
    const clamped = Math.max(0, Math.min(255, luminance));
    const targetFreq = 200 + (clamped / 255) * 1150;
    try {
      this.osc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.08);
    } catch {}
  }

  public stop() {
    if (!this.isRunning) return;
    try {
      if (this.osc) {
        this.osc.stop();
        this.osc.disconnect();
      }
      if (this.gain) {
        this.gain.disconnect();
      }
    } catch {}
    this.osc = null;
    this.gain = null;
    this.isRunning = false;
  }
}

export const lightSonar = new LightSonarEngine();

/**
 * Tactile vibration feedback
 */
export function triggerHapticFeedback(level: number) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (level === 1) {
        navigator.vibrate([350, 100, 350, 100, 450]);
      } else if (level === 2) {
        navigator.vibrate([200, 100, 200]);
      } else {
        navigator.vibrate([80]);
      }
    } catch {}
  }
}

/**
 * Speech Synthesis TTS Manager with English & Russian voice discovery
 */
class SpeechManager {
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isSpeaking = false;
  private voices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.loadVoices();
      if (typeof window.speechSynthesis.addEventListener === 'function') {
        window.speechSynthesis.addEventListener('voiceschanged', () => this.loadVoices());
      } else if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.voices = window.speechSynthesis.getVoices();
  }

  public getVoice(lang: 'en' | 'ru' = 'en'): SpeechSynthesisVoice | null {
    if (!this.voices || this.voices.length === 0) {
      this.loadVoices();
    }
    const prefix = lang === 'ru' ? 'ru' : 'en';

    // Prefer high quality natural voices
    const naturalVoice = this.voices.find(
      (v) =>
        v.lang.toLowerCase().replace('_', '-').startsWith(prefix) &&
        (v.name.includes('Natural') ||
          v.name.includes('Google') ||
          v.name.includes('Samantha') ||
          v.name.includes('Daniel') ||
          v.name.includes('Yuri') ||
          v.default)
    );

    if (naturalVoice) return naturalVoice;

    const anyMatchingVoice = this.voices.find((v) =>
      v.lang.toLowerCase().replace('_', '-').startsWith(prefix)
    );

    return anyMatchingVoice || this.voices[0] || null;
  }

  public speak(
    text: string,
    options: {
      lang?: 'en' | 'ru';
      level?: number;
      rate?: number;
      pitch?: number;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
    } = {}
  ): boolean {
    if (!text || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return false;
    }

    const { lang = 'en', level = 2, rate = 1.05, pitch = 1.0, onStart, onEnd, onError } = options;

    // TIER 1 immediately cancels any ongoing speech to deliver collision alert
    if (level === 1 || window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === 'ru' ? 'ru-RU' : 'en-US';
      utterance.rate = Math.max(0.7, Math.min(1.6, rate));
      utterance.pitch = Math.max(0.7, Math.min(1.4, pitch));

      const voice = this.getVoice(lang);
      if (voice) {
        utterance.voice = voice;
      }

      // GC reference fix
      activeUtterances.add(utterance);

      utterance.onstart = () => {
        this.isSpeaking = true;
        onStart?.();
      };

      utterance.onend = () => {
        activeUtterances.delete(utterance);
        this.isSpeaking = false;
        this.currentUtterance = null;
        onEnd?.();
      };

      utterance.onerror = (e) => {
        activeUtterances.delete(utterance);
        this.isSpeaking = false;
        this.currentUtterance = null;
        onError?.(e);
      };

      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
      return true;
    } catch (err) {
      console.error('Speech synthesis error:', err);
      onError?.(err);
      return false;
    }
  }

  public stop() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      activeUtterances.clear();
      this.isSpeaking = false;
      this.currentUtterance = null;
    }
  }

  public getSpeakingState(): boolean {
    return this.isSpeaking || (typeof window !== 'undefined' && window.speechSynthesis?.speaking);
  }
}

export const speechManager = new SpeechManager();
