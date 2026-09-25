import React, { useState } from 'react';
import { Mic, Search, MessageSquare, Compass, Eye, BookOpen, Send, MicOff } from 'lucide-react';
import { OperatingMode } from '../types/assistant';

interface QuickVoiceActionsProps {
  onAskQuery: (query: string) => void;
  activeMode: OperatingMode;
  onSetMode: (mode: OperatingMode) => void;
  isAnalyzing: boolean;
  highContrast?: boolean;
}

export const QuickVoiceActions: React.FC<QuickVoiceActionsProps> = ({
  onAskQuery,
  activeMode,
  onSetMode,
  isAnalyzing,
  highContrast = false,
}) => {
  const [customText, setCustomText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  // Quick action templates conforming to the ACTIVE prompt requirements
  const QUICK_PROMPTS = [
    { label: 'Что передо мной?', icon: Eye, query: 'Что передо мной?' },
    { label: 'Прочитай надпись', icon: BookOpen, query: 'Прочитай текст или табличку в кадре.' },
    { label: 'Где свободное место?', icon: Search, query: 'Где свободное место или скамейка?' },
    { label: 'Где свободный проход?', icon: Compass, query: 'Где свободный проход и путь для обхода?' },
  ];

  // Speech Recognition support in browser without alert()
  const startVoiceInput = () => {
    setSpeechError(null);
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError('Голосовой микрофон недоступен в этом браузере. Выберите готовый вопрос ниже.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ru-RU';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const spoken = event.results?.[0]?.[0]?.transcript;
        if (spoken) {
          setCustomText(spoken);
          if (activeMode !== 'ACTIVE') {
            onSetMode('ACTIVE');
          }
          onAskQuery(spoken);
        }
      };

      recognition.onerror = (err: any) => {
        console.warn('SpeechRecognition error:', err);
        setIsListening(false);
        if (err.error === 'not-allowed') {
          setSpeechError('Микрофон заблокирован. Разрешите доступ в браузере.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
      setSpeechError('Не удалось запустить микрофон.');
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim() || isAnalyzing) return;
    if (activeMode !== 'ACTIVE') {
      onSetMode('ACTIVE');
    }
    onAskQuery(customText.trim());
  };

  return (
    <div
      className={`rounded-3xl p-5 border ${
        highContrast
          ? 'bg-black border-yellow-400 text-yellow-300'
          : 'bg-slate-900 border-slate-800 text-slate-100 shadow-xl'
      }`}
    >
      <div className="flex items-center justify-between mb-3 text-xs tracking-wider uppercase font-bold">
        <span className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-amber-400" />
          Режим ACTIVE · Голосовой вопрос
        </span>
        <span className="text-slate-400 font-mono text-[11px]">
          {activeMode === 'ACTIVE' ? 'АКТИВЕН' : 'ФОНОВЫЙ МОНИТОРИНГ'}
        </span>
      </div>

      {/* Voice / Text input form */}
      <form onSubmit={handleCustomSubmit} className="flex gap-2 mb-3">
        <input
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="Спросите: 'Что передо мной?', 'Прочитай номер'..."
          aria-label="Текст вопроса для ассистента"
          className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 transition"
        />

        {/* Mic voice button */}
        <button
          type="button"
          onClick={startVoiceInput}
          title="Сказать голосом через микрофон"
          aria-label="Включить микрофон"
          className={`p-3 rounded-2xl border transition min-w-11 min-h-11 flex items-center justify-center ${
            isListening
              ? 'bg-red-500 text-white border-red-400 animate-pulse'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
          }`}
        >
          {isListening ? <Mic className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Send button */}
        <button
          type="submit"
          disabled={!customText.trim() || isAnalyzing}
          aria-label="Отправить вопрос"
          className="px-5 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-2xl text-xs flex items-center gap-1.5 transition active:scale-95"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Спросить</span>
        </button>
      </form>

      {speechError && (
        <div className="mb-3 text-[11px] text-amber-300/90 bg-amber-950/40 p-2.5 rounded-xl border border-amber-800/40">
          {speechError}
        </div>
      )}

      {/* Large Quick Access Touch Buttons for Visually Impaired Users */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {QUICK_PROMPTS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={() => {
                setCustomText(item.query);
                if (activeMode !== 'ACTIVE') {
                  onSetMode('ACTIVE');
                }
                onAskQuery(item.query);
              }}
              disabled={isAnalyzing}
              className="flex items-center gap-2.5 p-3 bg-slate-950/80 hover:bg-slate-800/90 active:scale-95 border border-slate-800/80 rounded-2xl text-xs font-semibold text-slate-200 transition text-left min-h-12"
            >
              <div className="p-1.5 rounded-xl bg-slate-850 text-amber-400 shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <span className="line-clamp-1">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
