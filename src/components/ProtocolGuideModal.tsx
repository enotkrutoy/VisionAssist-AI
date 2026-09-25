import React from 'react';
import { X, ShieldAlert, Clock, Mic, CheckCircle, AlertOctagon } from 'lucide-react';

interface ProtocolGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProtocolGuideModal: React.FC<ProtocolGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
    >
      <div className="relative w-full max-w-2xl bg-black border-2 border-[#FFEE00] rounded-3xl p-6 sm:p-8 max-h-[85vh] overflow-y-auto text-white shadow-2xl space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Закрыть справку"
          className="absolute top-5 right-5 w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-700 text-[#FFEE00] flex items-center justify-center hover:bg-zinc-800 transition min-h-[48px] min-w-[48px]"
        >
          <X className="w-6 h-6 stroke-[2.5]" />
        </button>

        {/* Modal Title */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#FFEE00] text-black flex items-center justify-center font-bold">
            <ShieldAlert className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h2 id="guide-modal-title" className="text-xl font-extrabold text-[#FFEE00]">
              Спецификация протокола VisionAssist AI
            </h2>
            <p className="text-xs text-zinc-400">
              Стандарт безопасности WCAG 2.1 AAA и пространственная навигация
            </p>
          </div>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed">
          Автономное ядро пространственной ориентации и безопасности в системе Smart Real-Time Multimodal Assistance для незрячих и слабовидящих пользователей.
        </p>

        {/* Section 1: TTS Requirements */}
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
            <h3 className="font-extrabold text-[#FFEE00] uppercase text-xs tracking-wider flex items-center gap-2">
              <Mic className="w-4 h-4 stroke-[2.5]" />
              Жесткие требования к формату синтеза речи (TTS)
            </h3>
            <ul className="space-y-1.5 text-zinc-300 list-disc list-inside">
              <li>Исключительно готовый для озвучивания текст на русском языке.</li>
              <li>
                <strong className="text-red-400">Категорически запрещено:</strong> markdown-разметка (#, *, _), списки, нумерация, скобки, кавычки, смайлы, латинские аббревиатуры и спецсимволы.
              </li>
              <li>Разрешены только буквы русского алфавита, цифры словами или простыми числами, точки и запятые для речевых пауз.</li>
              <li>Без вводных фраз («Я вижу», «Перед вами находится», «Внимание, я зафиксировал»). Сразу суть.</li>
              <li>Спокойный, четкий, директивный тон без паники.</li>
            </ul>
          </div>

          {/* Section 2: Spatial Coordinates */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
            <h3 className="font-extrabold text-[#FFEE00] uppercase text-xs tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 stroke-[2.5]" />
              Пространственная система координат (Циферблат относительно груди)
            </h3>
            <div className="grid grid-cols-2 gap-3 text-zinc-300">
              <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
                <strong>12 часов:</strong> строго прямо перед вами.<br />
                <strong>1–2 часа:</strong> впереди справа.<br />
                <strong>3 часа:</strong> строго справа.
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
                <strong>9 часов:</strong> строго слева.<br />
                <strong>10–11 часов:</strong> впереди слева.<br />
                <strong>6 часов:</strong> позади.
              </div>
            </div>
            <div className="text-zinc-400 pt-1">
              Дистанция в метрах или шагах: «полметра», «один метр», «два шага», «пять метров». Вертикаль: «на уровне головы», «под ногами».
            </div>
          </div>

          {/* Section 3: Hazard Levels */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
            <h3 className="font-extrabold text-[#FFEE00] uppercase text-xs tracking-wider flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 stroke-[2.5]" />
              Иерархия опасностей и лимиты слов
            </h3>
            <div className="space-y-2">
              <div className="p-3 bg-red-950/60 rounded-xl border border-red-500/80">
                <span className="font-black text-red-400">Уровень 1 (Критический, &lt; 1.5м):</span> Ступени вниз, бордюр, яма, открытый люк, транспорт, ветка на уровне головы. Реакция: немедленная остановка, сигнал 880 Гц. Лимит: <strong>2–5 слов</strong>. Шаблон: <em>«Стоп, [препятствие] на [часы] в [дистанция]»</em>.
              </div>
              <div className="p-3 bg-amber-950/60 rounded-xl border border-amber-500/80">
                <span className="font-black text-amber-400">Уровень 2 (Предупреждение, 2–4м):</span> Столбы, урны, встречные пешеходы, закрытые двери. Лимит: <strong>4–7 слов</strong>. Шаблон: <em>«Впереди [препятствие], обход [направление]»</em>.
              </div>
              <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-700">
                <span className="font-black text-[#FFEE00]">Уровень 3 (Информационный):</span> Свободные проходы, двери, скамейки, чтение вывесок. Лимит: <strong>до 12 слов</strong>. Текст с префиксом <em>«Текст: [содержание]»</em>.
              </div>
            </div>
          </div>

          {/* Section 4: Fault Tolerance */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
            <h3 className="font-extrabold text-[#FFEE00] uppercase text-xs tracking-wider flex items-center gap-2">
              <CheckCircle className="w-4 h-4 stroke-[2.5]" />
              Протокол отказоустойчивости и слепых зон
            </h3>
            <p className="text-zinc-300">
              <strong>Недостаток света (&lt;25 люкс):</strong> «Недостаточно света для обзора, иди осторожно.»
            </p>
            <p className="text-zinc-300">
              <strong>Объектив перекрыт:</strong> «Камера перекрыта, проверь объектив.»
            </p>
            <p className="text-zinc-300">
              <strong>Неизвестная преграда:</strong> «Впереди препятствие неизвестного типа, притормози.»
            </p>
          </div>
        </div>

        <div className="pt-2">
          <button
            onClick={onClose}
            className="w-full py-4 bg-[#FFEE00] hover:bg-[#ffe600] text-black font-black rounded-2xl text-xs uppercase tracking-wider transition min-h-[56px]"
          >
            ПОНЯТНО
          </button>
        </div>
      </div>
    </div>
  );
};
