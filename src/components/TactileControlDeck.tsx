import React, { useState } from 'react';
import { Shield, MessageSquare, Compass, Pause, Play, Mic, MicOff } from 'lucide-react';
import { OperatingMode } from '../types/assistant';

interface TactileControlDeckProps {
  currentMode: OperatingMode;
  onSelectMode: (mode: OperatingMode) => void;
  isPaused: boolean;
  onTogglePause: () => void;
  onActiveHoldStart: () => void;
  onActiveHoldEnd: () => void;
  isListening: boolean;
  lang?: 'en' | 'ru';
}

export const TactileControlDeck: React.FC<TactileControlDeckProps> = ({
  currentMode,
  onSelectMode,
  isPaused,
  onTogglePause,
  onActiveHoldStart,
  onActiveHoldEnd,
  isListening,
  lang = 'en',
}) => {
  const isRu = lang === 'ru';
  const [touchActive, setTouchActive] = useState(false);

  const handlePointerDownActive = () => {
    setTouchActive(true);
    onActiveHoldStart();
  };

  const handlePointerUpActive = () => {
    setTouchActive(false);
    onActiveHoldEnd();
  };

  return (
    <section
      aria-label="Tactile Navigation Control Deck"
      className="space-y-4 rounded-3xl p-5 sm:p-6 border-2 border-[#FFEE00] bg-black shadow-2xl"
    >
      <div className="flex items-center justify-between text-xs font-black uppercase text-[#FFEE00] tracking-wider px-1">
        <span>{isRu ? 'ТАКТИЛЬНЫЙ ВЫБОР РЕЖИМА (СВАЙП / КЛИК)' : 'TACTILE MODE SELECTOR (SWIPE / TAP)'}</span>
        <span className="font-mono text-zinc-400 hidden sm:inline">
          {isRu ? 'Клавиши: 1 / 2 / 3' : 'Hotkeys: 1 / 2 / 3'}
        </span>
      </div>

      {/* 3 Giant Tactile Mode Selector Buttons (All >= 64px min-height) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* 1. PASSIVE MODE */}
        <button
          onClick={() => onSelectMode('PASSIVE')}
          aria-pressed={currentMode === 'PASSIVE'}
          aria-label={isRu ? 'Режим пассивного мониторинга' : 'Passive Guardian Mode'}
          className={`flex flex-col items-center justify-center p-4 rounded-3xl border-3 text-center transition min-h-[96px] active:scale-95 ${
            currentMode === 'PASSIVE'
              ? 'bg-[#FFEE00] text-black border-[#FFEE00] font-black shadow-xl shadow-[#FFEE00]/25'
              : 'bg-zinc-950 text-white border-zinc-700 hover:border-[#FFEE00]'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-6 h-6 stroke-[2.5]" />
            <span className="text-base font-black tracking-wider uppercase">
              {isRu ? 'ПАССИВНЫЙ' : 'PASSIVE'}
            </span>
          </div>
          <span
            className={`text-xs ${
              currentMode === 'PASSIVE' ? 'text-black font-extrabold' : 'text-zinc-400'
            }`}
          >
            {isRu ? 'Тишина до опасности (<2м)' : 'Silent until obstacle (<2m)'}
          </span>
          <span className="text-[10px] uppercase font-mono mt-1 text-zinc-500">
            {isRu ? 'Свайп влево' : 'Swipe Left'}
          </span>
        </button>

        {/* 2. ACTIVE MODE (HOLD TO TALK) */}
        <button
          onPointerDown={handlePointerDownActive}
          onPointerUp={handlePointerUpActive}
          onPointerCancel={handlePointerUpActive}
          onClick={() => onSelectMode('ACTIVE')}
          aria-pressed={currentMode === 'ACTIVE'}
          aria-label={isRu ? 'Активный режим: удерживайте для вопроса' : 'Active Mode: Hold to talk or tap to query'}
          className={`relative flex flex-col items-center justify-center p-4 rounded-3xl border-3 text-center transition min-h-[96px] active:scale-95 ${
            currentMode === 'ACTIVE'
              ? 'bg-[#FFEE00] text-black border-[#FFEE00] font-black shadow-xl shadow-[#FFEE00]/25'
              : 'bg-zinc-950 text-white border-zinc-700 hover:border-[#FFEE00]'
          }`}
        >
          {isListening && (
            <span className="absolute -top-3 px-3 py-0.5 rounded-full bg-red-600 text-white font-mono text-[10px] font-black uppercase animate-bounce">
              {isRu ? 'СЛУШАЮ...' : 'LISTENING...'}
            </span>
          )}
          <div className="flex items-center gap-2 mb-1">
            {isListening ? (
              <Mic className="w-6 h-6 stroke-[3] text-red-600 animate-pulse" />
            ) : (
              <MessageSquare className="w-6 h-6 stroke-[2.5]" />
            )}
            <span className="text-base font-black tracking-wider uppercase">
              {isRu ? 'АКТИВНЫЙ' : 'ACTIVE'}
            </span>
          </div>
          <span
            className={`text-xs ${
              currentMode === 'ACTIVE' ? 'text-black font-extrabold' : 'text-zinc-400'
            }`}
          >
            {isRu ? 'Удерживайте для вопроса' : 'Hold to Talk / Tap to Ask'}
          </span>
          <span className="text-[10px] uppercase font-mono mt-1 text-zinc-500">
            {isRu ? 'Тап по центру' : 'Tap Center'}
          </span>
        </button>

        {/* 3. NAVIGATION MODE */}
        <button
          onClick={() => onSelectMode('NAVIGATION')}
          aria-pressed={currentMode === 'NAVIGATION'}
          aria-label={isRu ? 'Режим пошаговой навигации' : 'Turn-by-turn Navigation Mode'}
          className={`flex flex-col items-center justify-center p-4 rounded-3xl border-3 text-center transition min-h-[96px] active:scale-95 ${
            currentMode === 'NAVIGATION'
              ? 'bg-[#FFEE00] text-black border-[#FFEE00] font-black shadow-xl shadow-[#FFEE00]/25'
              : 'bg-zinc-950 text-white border-zinc-700 hover:border-[#FFEE00]'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Compass className="w-6 h-6 stroke-[2.5]" />
            <span className="text-base font-black tracking-wider uppercase">
              {isRu ? 'НАВИГАЦИЯ' : 'NAVIGATION'}
            </span>
          </div>
          <span
            className={`text-xs ${
              currentMode === 'NAVIGATION' ? 'text-black font-extrabold' : 'text-zinc-400'
            }`}
          >
            {isRu ? 'Ведение по часам к проходу' : 'Wayfinding via Clock-Face'}
          </span>
          <span className="text-[10px] uppercase font-mono mt-1 text-zinc-500">
            {isRu ? 'Свайп вправо' : 'Swipe Right'}
          </span>
        </button>
      </div>

      {/* Big Emergency Pause / Resume Button (Min 64x64px) */}
      <button
        onClick={onTogglePause}
        aria-label={isPaused ? 'Resume Assistant' : 'Emergency Pause Assistant'}
        className={`w-full flex items-center justify-center gap-3 p-4 rounded-2xl border-3 text-sm font-black uppercase tracking-wider transition min-h-[64px] active:scale-98 shadow-xl ${
          isPaused
            ? 'bg-emerald-500 hover:bg-emerald-400 text-black border-emerald-400'
            : 'bg-red-600 hover:bg-red-500 text-white border-red-500 shadow-red-600/30'
        }`}
      >
        {isPaused ? (
          <>
            <Play className="w-6 h-6 stroke-[3]" />
            <span>{isRu ? 'ВОЗОБНОВИТЬ РАБОТУ АССИСТЕНТА' : 'RESUME ASSISTANCE'}</span>
          </>
        ) : (
          <>
            <Pause className="w-6 h-6 stroke-[3]" />
            <span>{isRu ? 'ЭКСТРЕННАЯ ПАУЗА (ОСТАНОВИТЬ СКАНИРОВАНИЕ)' : 'EMERGENCY PAUSE ALL SCANS'}</span>
          </>
        )}
      </button>
    </section>
  );
};
