import React from 'react';
import { Volume2, VolumeX, RotateCcw, AlertTriangle, ShieldAlert, Info, Activity, Key } from 'lucide-react';
import { HazardLevel } from '../types/assistant';

interface LiveTranscriptBoxProps {
  ttsMessage: string;
  hazardLevel: HazardLevel;
  hazardType: string;
  clockDirection: string;
  distanceText: string;
  isSpeaking: boolean;
  onReplay: () => void;
  onStopSpeech: () => void;
  onOpenApiKey?: () => void;
  lang?: 'en' | 'ru';
}

export const LiveTranscriptBox: React.FC<LiveTranscriptBoxProps> = ({
  ttsMessage,
  hazardLevel,
  hazardType,
  clockDirection,
  distanceText,
  isSpeaking,
  onReplay,
  onStopSpeech,
  onOpenApiKey,
  lang = 'en',
}) => {
  const isRu = lang === 'ru';
  const isKeyIssue =
    hazardType === 'API_KEY_ERROR' ||
    hazardType === 'READY_AWAITING_KEY' ||
    hazardType === 'QUOTA_ERROR';

  const getTierBadge = () => {
    if (isKeyIssue) {
      return {
        label: isRu ? 'ТРЕБУЕТСЯ API КЛЮЧ' : 'API KEY REQUIRED',
        bg: 'bg-amber-400 text-black border-amber-300 animate-pulse',
        icon: Key,
      };
    }

    switch (hazardLevel) {
      case 1:
        return {
          label: isRu ? 'УРОВЕНЬ 1 · КРИТИЧЕСКИЙ' : 'TIER 1 · CRITICAL',
          bg: 'bg-red-600 text-white border-red-500',
          icon: ShieldAlert,
        };
      case 2:
        return {
          label: isRu ? 'УРОВЕНЬ 2 · ПРЕДУПРЕЖДЕНИЕ' : 'TIER 2 · WARNING',
          bg: 'bg-amber-500 text-black border-amber-400',
          icon: AlertTriangle,
        };
      case 3:
      case 4:
        return {
          label: isRu ? 'УРОВЕНЬ 3 · ОРИЕНТИР' : 'TIER 3 · INFORMATIONAL',
          bg: 'bg-[#FFEE00] text-black border-[#FFEE00]',
          icon: Info,
        };
      default:
        return {
          label: isRu ? 'ТРАЕКТОРИЯ ЧИСТА' : 'PATH CLEAR',
          bg: 'bg-zinc-800 text-zinc-300 border-zinc-700',
          icon: Activity,
        };
    }
  };

  const badge = getTierBadge();
  const BadgeIcon = badge.icon;

  return (
    <section
      aria-label="Live Voice Announcement Transcript"
      className="rounded-3xl p-5 sm:p-6 border-2 border-[#FFEE00] bg-black shadow-2xl space-y-4"
    >
      {/* Transcript Header with Tier Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#FFEE00]/30 pb-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-wider ${badge.bg}`}
          >
            <BadgeIcon className="w-4 h-4 stroke-[2.5]" />
            <span>{badge.label}</span>
          </span>

          {clockDirection && clockDirection !== 'NONE' && (
            <span className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-[#FFEE00] font-mono text-xs font-bold">
              {clockDirection} {isRu ? 'ЧАСОВ' : "O'CLOCK"}
            </span>
          )}

          {distanceText && (
            <span className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white font-mono text-xs font-bold">
              {distanceText}
            </span>
          )}
        </div>

        {/* Live Audio Speaking Indicator */}
        <div className="flex items-center gap-2">
          {isSpeaking ? (
            <div className="flex items-center gap-2 text-black bg-[#FFEE00] px-3 py-1 rounded-full font-black text-xs uppercase animate-pulse">
              <Volume2 className="w-4 h-4" />
              <span>{isRu ? 'ОЗВУЧИВАЕТСЯ' : 'SPEAKING NOW'}</span>
            </div>
          ) : (
            <span className="text-zinc-500 font-mono text-xs uppercase">
              {isRu ? 'СИНТЕЗАТОР ГОТОВ' : 'TTS READY'}
            </span>
          )}
        </div>
      </div>

      {/* Main Live Announcement in Giant 24px Bold Text */}
      <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800">
        <p
          className="text-2xl sm:text-3xl font-extrabold text-[#FFEE00] leading-snug tracking-tight"
          aria-live="polite"
        >
          {ttsMessage || (isRu ? 'Направьте камеру устройства вперед.' : 'Point camera forward to begin orientation.')}
        </p>

        {isKeyIssue && onOpenApiKey && (
          <div className="mt-4 pt-3 border-t border-zinc-800 flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenApiKey}
              className="flex items-center gap-2 px-5 py-3 bg-[#FFEE00] hover:bg-[#ffe600] text-black font-black rounded-xl text-xs uppercase tracking-wider transition min-h-[48px]"
            >
              <Key className="w-4 h-4 stroke-[3]" />
              <span>{isRu ? 'ВВЕСТИ КЛЮЧ GEMINI В 1 КЛИК' : 'ENTER GEMINI KEY IN 1 CLICK'}</span>
            </button>
            <span className="text-xs text-zinc-400">
              {isRu
                ? 'Ключ бесплатный на aistudio.google.com/apikey и сохраняется в вашем браузере.'
                : 'Free key from aistudio.google.com/apikey, saved directly in your browser.'}
            </span>
          </div>
        )}
      </div>

      {/* Action Buttons (All >= 64px min-height) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="text-xs text-zinc-400 font-mono hidden sm:inline">
          {isRu ? 'Пробел: Повторить · Esc: Остановить' : 'Space: Repeat · Esc: Stop speech'}
        </div>

        <div className="flex items-center gap-3">
          {/* Replay Speech Button (Min 64x64px) */}
          <button
            onClick={onReplay}
            aria-label="Repeat Announcement"
            className="flex items-center gap-2 px-6 py-4 bg-zinc-900 hover:bg-zinc-800 text-[#FFEE00] border-2 border-[#FFEE00] rounded-2xl text-xs font-extrabold uppercase tracking-wider transition active:scale-95 min-h-[64px] min-w-[64px]"
          >
            <RotateCcw className="w-5 h-5 stroke-[2.5]" />
            <span>{isRu ? 'ПОВТОРИТЬ (ПРОБЕЛ)' : 'REPEAT (SPACE)'}</span>
          </button>

          {/* Cancel / Stop Speech Button (Min 64x64px) */}
          {isSpeaking && (
            <button
              onClick={onStopSpeech}
              aria-label="Silence Speech"
              className="flex items-center gap-2 px-6 py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl text-xs font-extrabold uppercase tracking-wider transition active:scale-95 min-h-[64px] min-w-[64px]"
            >
              <VolumeX className="w-5 h-5 stroke-[2.5]" />
              <span>{isRu ? 'ЗАГЛУШИТЬ (ESC)' : 'SILENCE (ESC)'}</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
