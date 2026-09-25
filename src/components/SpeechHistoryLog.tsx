import React from 'react';
import { History, Volume2, Trash2, Clock, CheckCircle } from 'lucide-react';
import { SpeechHistoryItem } from '../types/assistant';

interface SpeechHistoryLogProps {
  history: SpeechHistoryItem[];
  onReplayItem: (text: string, level: number) => void;
  onClearHistory: () => void;
  highContrast?: boolean;
}

export const SpeechHistoryLog: React.FC<SpeechHistoryLogProps> = ({
  history,
  onReplayItem,
  onClearHistory,
  highContrast = false,
}) => {
  if (history.length === 0) return null;

  return (
    <div
      className={`rounded-2xl p-5 border ${
        highContrast
          ? 'bg-black border-yellow-400 text-yellow-300'
          : 'bg-slate-900 border-slate-800 text-slate-100 shadow-xl'
      }`}
    >
      <div className="flex items-center justify-between mb-3 text-xs tracking-wider uppercase font-semibold">
        <span className="flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-cyan-400" />
          Журнал речевых сообщений ядра ({history.length})
        </span>
        <button
          onClick={onClearHistory}
          className="text-slate-500 hover:text-slate-300 flex items-center gap-1 text-[11px] transition"
        >
          <Trash2 className="w-3 h-3" />
          Очистить
        </button>
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {history.map((item) => {
          const timeStr = new Date(item.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });

          const levelColor =
            item.hazardLevel === 1
              ? 'border-l-red-500 bg-red-950/20'
              : item.hazardLevel === 2
              ? 'border-l-amber-500 bg-amber-950/20'
              : item.hazardLevel === 3
              ? 'border-l-blue-500 bg-blue-950/20'
              : 'border-l-emerald-500 bg-emerald-950/20';

          return (
            <div
              key={item.id}
              className={`flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-800/80 border-l-4 ${levelColor} transition`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 text-[11px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timeStr}
                  </span>
                  <span>·</span>
                  <span className="text-amber-400 font-semibold">
                    {item.clockDirection ? `${item.clockDirection}ч` : '12ч'}
                  </span>
                  {item.distanceText && (
                    <>
                      <span>·</span>
                      <span className="text-cyan-400">{item.distanceText}</span>
                    </>
                  )}
                  <span>·</span>
                  <span className="text-slate-500">{item.mode}</span>
                </div>

                <p className="text-xs font-semibold text-slate-200 leading-snug">
                  {item.text}
                </p>
              </div>

              <button
                onClick={() => onReplayItem(item.text, item.hazardLevel)}
                title="Озвучить"
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition shrink-0"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
