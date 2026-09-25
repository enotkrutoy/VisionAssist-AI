import React, { useState } from 'react';
import { Key, Check, X, ShieldCheck } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveKey: (key: string) => void;
  lang?: 'en' | 'ru';
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveKey,
  lang = 'en',
}) => {
  const [inputVal, setInputVal] = useState(apiKey);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const isRu = lang === 'ru';

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveKey(inputVal.trim());
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const handleClear = () => {
    setInputVal('');
    onSaveKey('');
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
    >
      <div className="relative w-full max-w-lg bg-black border-2 border-[#FFEE00] rounded-3xl p-6 sm:p-8 shadow-2xl text-white space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#FFEE00] text-black flex items-center justify-center font-bold">
              <Key className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h2 id="api-modal-title" className="text-xl font-extrabold text-[#FFEE00]">
                {isRu ? 'Настройка Gemini API Key' : 'Gemini API Configuration'}
              </h2>
              <p className="text-xs text-zinc-400">
                {isRu ? 'Сохраняется локально в браузере' : 'Persisted locally in browser'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-700 text-[#FFEE00] flex items-center justify-center hover:bg-zinc-800 transition"
          >
            <X className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>

        <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 text-xs text-zinc-300 space-y-2">
          <div className="flex items-center gap-2 text-[#FFEE00] font-bold text-sm">
            <ShieldCheck className="w-4 h-4" />
            <span>{isRu ? 'Встроенный серверный прокси активен' : 'Built-in Server Proxy Active'}</span>
          </div>
          <p>
            {isRu
              ? 'По умолчанию приложение работает через встроенный серверный ключ. Если вы хотите использовать собственный Gemini API ключ, введите его ниже.'
              : 'By default, VisionAssist AI uses the server proxy route with no setup needed. If you want to use your own Gemini Flash API key, enter it below.'}
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="custom-key-input" className="block text-xs font-bold text-[#FFEE00] uppercase tracking-wider">
            {isRu ? 'Пользовательский API Ключ (опционально)' : 'Custom Gemini API Key (Optional)'}
          </label>
          <input
            id="custom-key-input"
            type="password"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full px-4 py-3.5 bg-zinc-900 border-2 border-zinc-700 focus:border-[#FFEE00] text-white rounded-2xl text-sm font-mono focus:outline-none transition min-h-[56px]"
          />
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-[#FFEE00] hover:bg-[#ffe600] text-black font-extrabold rounded-2xl text-xs uppercase tracking-wider transition shadow-lg shadow-[#FFEE00]/20 min-h-[64px]"
          >
            {savedSuccess ? <Check className="w-5 h-5 stroke-[3]" /> : <Key className="w-5 h-5" />}
            <span>{savedSuccess ? (isRu ? 'СОХРАНЕНО' : 'SAVED') : isRu ? 'СОХРАНИТЬ' : 'SAVE KEY'}</span>
          </button>

          {inputVal && (
            <button
              onClick={handleClear}
              className="px-5 py-4 bg-zinc-900 hover:bg-zinc-800 text-red-400 border border-red-500/50 font-bold rounded-2xl text-xs uppercase transition min-h-[64px]"
            >
              {isRu ? 'СБРОСИТЬ' : 'RESET'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
