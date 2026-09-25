import React from 'react';
import { HazardLevel, AssistiveChannel } from '../types/assistant';

interface ClockRadarHudProps {
  clockDirection: string;
  distanceMeters: number;
  hazardLevel: HazardLevel;
  verticalZone?: string;
  suggestedAction?: string;
  detectedValue?: string;
  activeChannel?: AssistiveChannel;
  lang?: 'en' | 'ru';
}

const CLOCK_ANGLES: Record<string, number> = {
  '12': 0,
  '1': 30,
  '2': 60,
  '3': 90,
  '4': 120,
  '5': 150,
  '6': 180,
  '7': 210,
  '8': 240,
  '9': 270,
  '10': 300,
  '11': 330,
};

export const ClockRadarHud: React.FC<ClockRadarHudProps> = ({
  clockDirection,
  distanceMeters,
  hazardLevel,
  verticalZone,
  suggestedAction,
  detectedValue,
  activeChannel = 'EXPLORE',
  lang = 'en',
}) => {
  const isRu = lang === 'ru';
  const size = 320;
  const center = size / 2;
  const maxRadarDist = 6.0;
  const maxRadius = center - 30;

  const hasBlip = clockDirection && clockDirection !== 'NONE' && CLOCK_ANGLES[clockDirection] !== undefined;
  const angleDeg = hasBlip ? CLOCK_ANGLES[clockDirection] : 0;
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const clampedDist = Math.max(0.4, Math.min(maxRadarDist, distanceMeters || 2.5));
  const blipRadius = (clampedDist / maxRadarDist) * maxRadius;
  const blipX = center + blipRadius * Math.cos(rad);
  const blipY = center + blipRadius * Math.sin(rad);

  const getLevelColor = (lvl: HazardLevel) => {
    switch (lvl) {
      case 1:
        return { stroke: '#EF4444', fill: '#DC2626', ring: 'rgba(239, 68, 68, 0.4)' };
      case 2:
        return { stroke: '#F59E0B', fill: '#D97706', ring: 'rgba(245, 158, 11, 0.35)' };
      case 3:
      case 4:
        return { stroke: '#FFEE00', fill: '#FFEE00', ring: 'rgba(255, 238, 0, 0.3)' };
      default:
        return { stroke: '#71717A', fill: '#52525B', ring: 'transparent' };
    }
  };

  const levelColor = getLevelColor(hazardLevel);

  const CLOCK_HOURS = [
    { hour: '12', deg: 0, label: '12h' },
    { hour: '1', deg: 30, label: '1h' },
    { hour: '2', deg: 60, label: '2h' },
    { hour: '3', deg: 90, label: '3h' },
    { hour: '6', deg: 180, label: '6h' },
    { hour: '9', deg: 270, label: '9h' },
    { hour: '10', deg: 300, label: '10h' },
    { hour: '11', deg: 330, label: '11h' },
  ];

  return (
    <section
      aria-label="360 Spatial Clock-Face Radar"
      className="flex flex-col items-center p-5 rounded-3xl border-2 border-[#FFEE00] bg-black shadow-2xl text-white"
    >
      <div className="w-full flex items-center justify-between pb-3 border-b border-[#FFEE00]/40 text-xs font-black uppercase text-[#FFEE00]">
        <span>{isRu ? '360° ЦИФЕРБЛАТ ОРИЕНТАЦИИ' : '360° CLOCK-FACE RADAR'}</span>
        <span className="font-mono text-zinc-400">
          {distanceMeters > 0 ? `${distanceMeters.toFixed(1)}m` : isRu ? 'ЧИСТО' : 'CLEAR'}
        </span>
      </div>

      <div className="relative my-4 flex items-center justify-center">
        <svg width={size} height={size} className="overflow-visible select-none">
          <circle cx={center} cy={center} r={maxRadius} fill="#09090b" stroke="#FFEE00" strokeWidth="2.5" />
          <circle cx={center} cy={center} r={maxRadius * 0.66} fill="none" stroke="#27272a" strokeWidth="1.5" strokeDasharray="4 4" />
          <circle cx={center} cy={center} r={maxRadius * 0.33} fill="none" stroke="#27272a" strokeWidth="1.5" strokeDasharray="4 4" />

          {/* Axes */}
          <line x1={center} y1={28} x2={center} y2={size - 28} stroke="#27272a" strokeWidth="1.5" />
          <line x1={28} y1={center} x2={size - 28} y2={center} stroke="#27272a" strokeWidth="1.5" />

          {/* User Center Node (Chest) */}
          <circle cx={center} cy={center} r={10} fill="#FFEE00" stroke="#000000" strokeWidth="2.5" />

          {/* Clock Labels */}
          {CLOCK_HOURS.map(({ hour, deg }) => {
            const radVal = ((deg - 90) * Math.PI) / 180;
            const textR = maxRadius + 16;
            const tx = center + textR * Math.cos(radVal);
            const ty = center + textR * Math.sin(radVal);
            const isHighlight = hour === clockDirection;

            return (
              <text
                key={hour}
                x={tx}
                y={ty + 4}
                textAnchor="middle"
                className={`text-xs font-mono font-black ${
                  isHighlight ? 'fill-[#FFEE00] font-black text-sm' : 'fill-zinc-500'
                }`}
              >
                {hour}
              </text>
            );
          })}

          {/* Spatial Blip */}
          {hasBlip && (
            <g>
              <line
                x1={center}
                y1={center}
                x2={blipX}
                y2={blipY}
                stroke={levelColor.stroke}
                strokeWidth="2.5"
                strokeDasharray="3 3"
              />
              <circle cx={blipX} cy={blipY} r={18} fill={levelColor.ring} />
              <circle
                cx={blipX}
                cy={blipY}
                r={10}
                fill={levelColor.fill}
                stroke="#000000"
                strokeWidth="2.5"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Detected Value Badge */}
      {detectedValue && (
        <div className="w-full mb-3 p-3 rounded-2xl bg-zinc-950 border-2 border-[#FFEE00] text-[#FFEE00] text-xs font-black flex items-center justify-between">
          <span className="text-[11px] uppercase font-mono">
            {activeChannel === 'CURRENCY'
              ? (isRu ? '💵 НОМИНАЛ' : '💵 DENOMINATION')
              : activeChannel === 'TEXT_OCR'
              ? (isRu ? '📖 ТЕКСТ' : '📖 TEXT OCR')
              : (isRu ? '🎯 ЦЕЛЬ' : '🎯 TARGET')}
          </span>
          <span className="text-right text-white font-mono text-sm">{detectedValue}</span>
        </div>
      )}

      {/* Suggested Action Bar */}
      {suggestedAction && suggestedAction !== 'CONTINUE' && (
        <div
          className={`w-full py-2.5 px-4 rounded-xl text-xs font-black text-center uppercase tracking-wider ${
            hazardLevel === 1
              ? 'bg-red-600 text-white animate-pulse'
              : hazardLevel === 2
              ? 'bg-amber-500 text-black'
              : 'bg-[#FFEE00] text-black'
          }`}
        >
          {suggestedAction}
        </div>
      )}

      {verticalZone && verticalZone !== 'GENERAL' && (
        <div className="w-full mt-2 text-center text-xs font-mono text-[#FFEE00]">
          {verticalZone === 'HEAD'
            ? (isRu ? '⚠️ НА УРОВНЕ ГОЛОВЫ' : '⚠️ HAZARD AT HEAD LEVEL')
            : (isRu ? '⚠️ ПОД НОГАМИ / СТУПЕНИ' : '⚠️ HAZARD AT GROUND LEVEL')}
        </div>
      )}
    </section>
  );
};
