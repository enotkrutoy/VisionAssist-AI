import React from 'react';
import { Compass, Sun, Volume2, VolumeX, Smartphone, Eye, Lightbulb } from 'lucide-react';
import { DeviceSensorState } from '../types/assistant';

interface TelemetryBarProps {
  sensors: DeviceSensorState;
  onUpdateSensors: (patch: Partial<DeviceSensorState>) => void;
  clipContext?: string;
  highContrast?: boolean;
}

export const TelemetryBar: React.FC<TelemetryBarProps> = ({
  sensors,
  onUpdateSensors,
  clipContext = 'Окружающее пространство',
  highContrast = false,
}) => {
  return (
    <div
      className={`rounded-3xl p-5 border ${
        highContrast
          ? 'bg-black border-yellow-400 text-yellow-300'
          : 'bg-slate-900 border-slate-800 text-slate-100 shadow-xl'
      }`}
    >
      <div className="flex items-center justify-between mb-4 text-xs tracking-wider uppercase font-bold">
        <span className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-cyan-400" />
          Сенсоры устройства и окружение
        </span>
        <span className="flex items-center gap-1 text-emerald-400 font-mono text-[11px] bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-800/40">
          <Eye className="w-3 h-3" />
          {clipContext}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Real Gyroscope / Pitch Orientation */}
        <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              Наклон камеры
            </span>
            <span className="font-mono font-bold text-amber-400 text-xs">
              {Math.round(sensors.pitch)}°
            </span>
          </div>
          <div className="text-sm font-bold text-white mb-1">
            {sensors.tiltZone === 'HEAD'
              ? 'Уровень головы'
              : sensors.tiltZone === 'GROUND'
              ? 'Под ногами (земля)'
              : 'Прямо перед собой'}
          </div>
          <p className="text-[11px] text-slate-500 leading-tight">
            Ориентация определяется встроенным гироскопом устройства
          </p>
        </div>

        {/* Real Video Luminance & Light sensor */}
        <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-400 flex items-center gap-1.5 font-medium">
              <Sun className="w-3.5 h-3.5 text-yellow-400" />
              Освещенность сцены
            </span>
            <span className="font-mono font-bold text-xs text-yellow-300">
              {Math.round(sensors.luminance)} / 255
            </span>
          </div>
          <div className="text-sm font-bold text-white mb-1">
            {sensors.isLensBlocked ? (
              <span className="text-red-400">Камера перекрыта</span>
            ) : sensors.isLowLight ? (
              <span className="text-amber-400">Недостаток света</span>
            ) : (
              <span className="text-emerald-400">Нормальное освещение</span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 leading-tight">
            Расчет экспозиции и слепых зон в реальном времени
          </p>
        </div>

        {/* Tactile & Auditory settings */}
        <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-400 font-medium">Обратная связь</span>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {/* Audio beeps toggle */}
            <button
              onClick={() =>
                onUpdateSensors({ audioBeepsEnabled: !sensors.audioBeepsEnabled })
              }
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                sensors.audioBeepsEnabled
                  ? 'bg-cyan-950 text-cyan-200 border-cyan-800/80'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
            >
              {sensors.audioBeepsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>Сонар</span>
            </button>

            {/* Haptics vibration toggle */}
            <button
              onClick={() =>
                onUpdateSensors({ hapticsEnabled: !sensors.hapticsEnabled })
              }
              className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                sensors.hapticsEnabled
                  ? 'bg-purple-950 text-purple-200 border-purple-800/80'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Вибро</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
