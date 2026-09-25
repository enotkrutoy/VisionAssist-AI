import React from 'react';
import { Volume2, VolumeX, RotateCcw, CheckCircle, ShieldAlert, Sparkles, Activity } from 'lucide-react';
import { HazardLevel } from '../types/assistant';

interface SpeechOutputBarProps {
  ttsMessage: string;
  hazardLevel: HazardLevel;
  hazardType?: string;
  isSpeaking: boolean;
  onReplay: () => void;
  onStopSpeech: () => void;
  speechRate: number;
  onRateChange: (rate: number) => void;
  highContrast?: boolean;
}

export const SpeechOutputBar: React.FC<SpeechOutputBarProps> = ({
  ttsMessage,
  hazardLevel,
  hazardType,
  isSpeaking,
  onReplay,
  onStopSpeech,
  speechRate,
  onRateChange,
  highContrast = false,
}) => {
  // Count words in speech output
  const wordCount = ttsMessage ? ttsMessage.trim().split(/\s+/).filter(Boolean).length : 0;

  // Verify compliance with prompt word limits:
  // L1: 2-5 words
  // L2: up to 7 words
  // L3: up to 8 words
  // L4: up to 15 words
  const isWordLimitCompliant =
    hazardLevel === 1
      ? wordCount >= 2 && wordCount <= 6 // allowed slight tolerance
      : hazardLevel === 2
      ? wordCount <= 8
      : hazardLevel === 3
      ? wordCount <= 9
      : wordCount <= 16;

  // Check for any forbidden markdown or illegal characters
  const hasForbiddenChars = /[#*_`~>|\\^\[\]\{\}\(\)"'«»–—]/.test(ttsMessage);

  return (
    <div
      role="region"
      aria-label="Речевой вывод ассистента"
      className={`rounded-2xl p-5 border transition-all ${
        hazardLevel === 1
          ? 'bg-red-950/70 border-red-500 shadow-2xl shadow-red-950/50'
          : hazardLevel === 2
          ? 'bg-amber-950/50 border-amber-600/70 shadow-xl'
          : highContrast
          ? 'bg-black border-yellow-400 text-yellow-300'
          : 'bg-slate-900 border-slate-800 shadow-xl text-slate-100'
      }`}
    >
      {/* Top Meta Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full flex items-center justify-center ${
              hazardLevel === 1
                ? 'bg-red-500 animate-ping'
                : hazardLevel === 2
                ? 'bg-amber-500'
                : hazardLevel === 3
                ? 'bg-blue-500'
                : 'bg-emerald-500'
            }`}
          />
          <span className="text-xs font-bold uppercase tracking-wider font-mono">
            {hazardLevel === 1
              ? 'Уровень 1: КРИТИЧЕСКИЙ (ОСТАНОВКА)'
              : hazardLevel === 2
              ? 'Уровень 2: ВЫСОКИЙ (ПРЕПЯТСТВИЕ)'
              : hazardLevel === 3
              ? 'Уровень 3: СРЕДНИЙ (ОРИЕНТИР)'
              : hazardLevel === 4
              ? 'Уровень 4: ИНФОРМАЦИОННЫЙ (НАДПИСЬ)'
              : 'ФОНОВЫЙ МОНИТОРИНГ (ТИШИНА)'}
          </span>
        </div>

        {/* TTS Validation Badges */}
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <span
            className={`px-2 py-0.5 rounded-full flex items-center gap-1 ${
              isWordLimitCompliant
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                : 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
            }`}
          >
            <CheckCircle className="w-3 h-3" />
            {wordCount} {wordCount === 1 ? 'слово' : wordCount < 5 ? 'слова' : 'слов'}
          </span>

          {!hasForbiddenChars && (
            <span className="px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              TTS Ready
            </span>
          )}
        </div>
      </div>

      {/* Main TTS Speech Display (Large, high legibility for low vision) */}
      <div
        className={`p-4 rounded-xl mb-4 font-sans tracking-wide text-lg sm:text-xl font-bold leading-relaxed border ${
          hazardLevel === 1
            ? 'bg-red-900/40 border-red-500/50 text-red-100'
            : hazardLevel === 2
            ? 'bg-amber-900/30 border-amber-500/40 text-amber-100'
            : highContrast
            ? 'bg-black text-yellow-300 border-yellow-500'
            : 'bg-slate-950/70 border-slate-800 text-slate-100'
        }`}
        aria-live={hazardLevel === 1 ? 'assertive' : 'polite'}
      >
        {ttsMessage || (
          <span className="text-slate-500 font-normal italic text-base">
            Траектория свободна. В фоновом режиме соблюдается режим тишины.
          </span>
        )}
      </div>

      {/* Controls & Sound Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
        <div className="flex items-center gap-2">
          {/* Replay Button */}
          <button
            onClick={onReplay}
            disabled={!ttsMessage}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition ${
              isSpeaking
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            } disabled:opacity-40`}
          >
            {isSpeaking ? (
              <>
                <Activity className="w-4 h-4 animate-spin text-slate-950" />
                Озвучивание...
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-amber-400" />
                Повторить речь
              </>
            )}
          </button>

          {/* Stop Audio Button */}
          {isSpeaking && (
            <button
              onClick={onStopSpeech}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-950 hover:bg-red-900 text-red-300 border border-red-800/80 rounded-xl text-xs font-bold transition"
            >
              <VolumeX className="w-4 h-4" />
              Стоп звук
            </button>
          )}
        </div>

        {/* Speech Rate Adjustment */}
        <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
          <span>Скорость: {speechRate.toFixed(1)}x</span>
          <input
            type="range"
            min="0.8"
            max="1.5"
            step="0.1"
            value={speechRate}
            onChange={(e) => onRateChange(parseFloat(e.target.value))}
            className="w-24 accent-amber-500 cursor-pointer"
            aria-label="Скорость синтеза речи"
          />
        </div>
      </div>
    </div>
  );
};
