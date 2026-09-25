import React from 'react';
import { Eye, Key, HelpCircle, Volume2, VolumeX, Flashlight, FlashlightOff, Globe } from 'lucide-react';
import { OperatingMode } from '../types/assistant';

interface AccessibleHeaderProps {
  currentMode: OperatingMode;
  onSelectMode: (mode: OperatingMode) => void;
  masterSoundEnabled: boolean;
  onToggleMasterSound: () => void;
  onOpenHelp: () => void;
  onOpenApiKey: () => void;
  hasCustomKey: boolean;
  isTorchOn: boolean;
  onToggleTorch: () => void;
  lang: 'en' | 'ru';
  onToggleLang: () => void;
}

export const AccessibleHeader: React.FC<AccessibleHeaderProps> = ({
  masterSoundEnabled,
  onToggleMasterSound,
  onOpenHelp,
  onOpenApiKey,
  hasCustomKey,
  isTorchOn,
  onToggleTorch,
  lang,
  onToggleLang,
}) => {
  const isRu = lang === 'ru';

  return (
    <header className="flex flex-col md:flex-row items-center justify-between gap-4 py-4 px-6 border-b-2 border-[#FFEE00] bg-black sticky top-0 z-40">
      {/* Brand & Subtitle */}
      <div className="flex items-center gap-3.5 w-full md:w-auto justify-between md:justify-start">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#FFEE00] text-black flex items-center justify-center font-extrabold shadow-md">
            <Eye className="w-7 h-7 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-white">
                VisionAssist AI
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FFEE00] text-black uppercase font-black">
                WCAG AAA
              </span>
            </div>
            <p className="text-xs text-[#FFEE00] font-bold">
              {isRu
                ? 'Система Мультимодальной Ассистивной Ориентации'
                : 'Smart Real-Time Multimodal Assistance System'}
            </p>
          </div>
        </div>

        {/* Mobile quick actions */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            onClick={onToggleLang}
            aria-label="Toggle Language"
            className="p-3 rounded-xl bg-zinc-900 border border-[#FFEE00] text-[#FFEE00] font-mono text-xs font-black min-h-[48px] min-w-[48px] flex items-center justify-center"
          >
            {lang.toUpperCase()}
          </button>
          <button
            onClick={onToggleMasterSound}
            aria-label="Sound Mute/Unmute"
            className="p-3 rounded-xl bg-zinc-900 border border-[#FFEE00] text-[#FFEE00] min-h-[48px] min-w-[48px] flex items-center justify-center"
          >
            {masterSoundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-zinc-500" />}
          </button>
        </div>
      </div>

      {/* Desktop Controls */}
      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
        {/* Language Toggle */}
        <button
          onClick={onToggleLang}
          aria-label={isRu ? 'Переключить на английский' : 'Switch to Russian'}
          className="hidden md:flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-[#FFEE00] border-2 border-[#FFEE00] font-black text-xs transition min-h-[50px]"
        >
          <Globe className="w-4 h-4" />
          <span>{lang.toUpperCase()}</span>
        </button>

        {/* API Key Modal Config Button */}
        <button
          onClick={onOpenApiKey}
          aria-label="API Key Settings"
          title="API Key Configuration"
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-black text-xs transition min-h-[50px] ${
            hasCustomKey
              ? 'bg-[#FFEE00] text-black border-[#FFEE00]'
              : 'bg-zinc-900 hover:bg-zinc-800 text-[#FFEE00] border-[#FFEE00]'
          }`}
        >
          <Key className="w-4 h-4 stroke-[2.5]" />
          <span>{hasCustomKey ? (isRu ? 'КЛЮЧ ЗАДАН' : 'CUSTOM KEY') : isRu ? 'API КЛЮЧ' : 'API KEY'}</span>
        </button>

        {/* Torch Toggle */}
        <button
          onClick={onToggleTorch}
          aria-label="Flashlight Torch"
          title="Flashlight / Torch"
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-black text-xs transition min-h-[50px] ${
            isTorchOn
              ? 'bg-[#FFEE00] text-black border-[#FFEE00]'
              : 'bg-zinc-900 hover:bg-zinc-800 text-white border-zinc-700'
          }`}
        >
          {isTorchOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
          <span>{isTorchOn ? (isRu ? 'СВЕТ ВКЛ' : 'TORCH ON') : isRu ? 'ФОНАРИК' : 'TORCH'}</span>
        </button>

        {/* Sound Toggle */}
        <button
          onClick={onToggleMasterSound}
          aria-label={masterSoundEnabled ? 'Disable Audio' : 'Enable Audio'}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-black text-xs transition min-h-[50px] ${
            masterSoundEnabled
              ? 'bg-zinc-900 text-[#FFEE00] border-[#FFEE00]'
              : 'bg-zinc-900 text-zinc-500 border-zinc-700'
          }`}
        >
          {masterSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          <span>{masterSoundEnabled ? (isRu ? 'ЗВУК ВКЛ' : 'AUDIO ON') : isRu ? 'ТИШИНА' : 'MUTED'}</span>
        </button>

        {/* Help Specification Guide */}
        <button
          onClick={onOpenHelp}
          aria-label="Help Guide"
          title="Protocol Specification Guide"
          className="flex items-center gap-1.5 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white border-2 border-zinc-700 rounded-xl font-bold text-xs transition min-h-[50px]"
        >
          <HelpCircle className="w-4 h-4 text-[#FFEE00]" />
          <span>{isRu ? 'СПРАВКА' : 'GUIDE'}</span>
        </button>
      </div>
    </header>
  );
};
