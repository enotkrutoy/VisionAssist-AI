import React from 'react';
import { Compass, FileText, Banknote, Search, SunMedium, Check } from 'lucide-react';
import { AssistiveChannel } from '../types/assistant';

interface ChannelSelectorBarProps {
  activeChannel: AssistiveChannel;
  onSelectChannel: (channel: AssistiveChannel) => void;
  targetObject?: string;
  onSelectTargetObject?: (target: string) => void;
  lang?: 'en' | 'ru';
}

export const ChannelSelectorBar: React.FC<ChannelSelectorBarProps> = ({
  activeChannel,
  onSelectChannel,
  targetObject = 'door',
  onSelectTargetObject,
  lang = 'en',
}) => {
  const isRu = lang === 'ru';

  const CHANNELS: {
    id: AssistiveChannel;
    label: string;
    description: string;
    icon: React.FC<any>;
    hotkey: string;
  }[] = [
    {
      id: 'EXPLORE',
      label: isRu ? 'Навигация' : 'Explore',
      description: isRu ? 'Часы и препятствия' : 'Obstacles & Clock-Face',
      icon: Compass,
      hotkey: '4',
    },
    {
      id: 'TEXT_OCR',
      label: isRu ? 'Быстрый текст' : 'Text OCR',
      description: isRu ? 'Вывески и ценники' : 'Signs & Price tags',
      icon: FileText,
      hotkey: '5',
    },
    {
      id: 'CURRENCY',
      label: isRu ? 'Купюры' : 'Currency',
      description: isRu ? 'Банкноты и деньги' : 'Banknotes & Money',
      icon: Banknote,
      hotkey: '6',
    },
    {
      id: 'FIND_OBJECT',
      label: isRu ? 'Поиск цели' : 'Find Object',
      description: isRu ? 'Ключи, стул, дверь' : 'Door, chair, keys',
      icon: Search,
      hotkey: '7',
    },
    {
      id: 'LIGHT_SONAR',
      label: isRu ? 'Сонар света' : 'Light Sonar',
      description: isRu ? 'Тон яркости окна' : 'Acoustic light tone',
      icon: SunMedium,
      hotkey: '8',
    },
  ];

  const QUICK_TARGETS = isRu
    ? ['дверь', 'ручка двери', 'стул / место', 'ключи', 'лестница', 'пешеходный переход']
    : ['door', 'door handle', 'chair / seat', 'keys', 'stairs', 'crosswalk'];

  return (
    <nav
      aria-label="Assistive Channels"
      className="rounded-3xl p-3 border-2 border-[#FFEE00] bg-black shadow-xl"
    >
      <div className="flex items-center justify-between px-3 py-1.5 text-xs font-black uppercase text-[#FFEE00]">
        <span>{isRu ? 'СПЕЦИАЛИЗИРОВАННЫЕ КАНАЛЫ' : 'SPECIALIZED ASSISTIVE CHANNELS'}</span>
        <span className="font-mono text-zinc-400 text-xs hidden sm:inline">
          {isRu ? 'Клавиши: 4 - 8' : 'Hotkeys: 4 - 8'}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-2">
        {CHANNELS.map((ch) => {
          const Icon = ch.icon;
          const isActive = activeChannel === ch.id;

          return (
            <button
              key={ch.id}
              onClick={() => onSelectChannel(ch.id)}
              aria-pressed={isActive}
              aria-label={`${ch.label}: ${ch.description}`}
              className={`flex items-center gap-2.5 p-3 rounded-2xl border-2 text-left transition min-h-[64px] active:scale-95 ${
                isActive
                  ? 'bg-[#FFEE00] text-black border-[#FFEE00] font-black shadow-lg shadow-[#FFEE00]/25'
                  : 'bg-zinc-950 text-white border-zinc-800 hover:border-[#FFEE00]'
              }`}
            >
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  isActive ? 'bg-black text-[#FFEE00]' : 'bg-zinc-900 text-[#FFEE00]'
                }`}
              >
                <Icon className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black leading-tight truncate">{ch.label}</div>
                <div
                  className={`text-[10px] leading-tight truncate ${
                    isActive ? 'text-black font-extrabold' : 'text-zinc-400'
                  }`}
                >
                  {ch.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {activeChannel === 'FIND_OBJECT' && (
        <div className="mt-3 pt-3 border-t border-zinc-800 flex flex-wrap items-center gap-2 px-1">
          <span className="text-xs font-black text-[#FFEE00] mr-1">
            {isRu ? 'Искать предмет:' : 'Locate Target:'}
          </span>
          {QUICK_TARGETS.map((item) => {
            const isSelected = targetObject.toLowerCase() === item.toLowerCase();
            return (
              <button
                key={item}
                onClick={() => onSelectTargetObject?.(item)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black border-2 transition active:scale-95 min-h-[44px] ${
                  isSelected
                    ? 'bg-[#FFEE00] text-black border-[#FFEE00]'
                    : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:border-[#FFEE00]'
                }`}
              >
                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                <span>{item.toUpperCase()}</span>
              </button>
            );
          })}
        </div>
      )}
    </nav>
  );
};
