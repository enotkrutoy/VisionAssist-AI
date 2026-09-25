export type OperatingMode = 'PASSIVE' | 'ACTIVE' | 'NAVIGATION';

export type AssistiveChannel =
  | 'EXPLORE'      // Навигация, циферблат, препятствия (Seeing AI Explore / Lookout)
  | 'TEXT_OCR'     // Мгновенное чтение текста, вывесок, ценников (Seeing AI Short Text)
  | 'CURRENCY'     // Распознавание купюр и монет (Lookout Currency)
  | 'FIND_OBJECT'  // Поиск конкретных предметов (ключи, стул, дверь)
  | 'LIGHT_SONAR'; // Непрерывный акустический сонар освещенности (Seeing AI Light)

export type HazardLevel = 0 | 1 | 2 | 3 | 4;

export type VerticalZone = 'HEAD' | 'CHEST' | 'GROUND' | 'GENERAL';

export interface DetectedObject {
  label: string;
  confidence: number;
  box2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] нормированные 0-1000
  clockDirection: string;
  distance: string;
  hazardLevel: number;
}

export interface SpatialAnalysis {
  ttsMessage: string;
  hazardLevel: HazardLevel;
  hazardType: string;
  clockDirection: string;
  distanceMeters: number;
  distanceText: string;
  verticalZone: VerticalZone;
  detectedObjects?: DetectedObject[];
  clipContext: string;
  suggestedAction: string;
  shouldSpeak: boolean;
  blindZoneIssue?: string;
  channel?: AssistiveChannel;
  detectedValue?: string; // Например "1000 рублей", "Вывеска: Аптека 24"
}

export interface DeviceSensorState {
  pitch: number; // Угол наклона в градусах (-90 до +90)
  tiltZone: 'HEAD' | 'FORWARD' | 'GROUND';
  luminance: number; // Яркость сцены (0 - 255)
  isLowLight: boolean;
  isLensBlocked: boolean;
  isTorchOn: boolean;
  hasTorch: boolean;
  audioBeepsEnabled: boolean;
  hapticsEnabled: boolean;
  speechRate: number; // 0.8 до 1.5
  highContrast: boolean;
}

export interface SpeechHistoryItem {
  id: string;
  timestamp: number;
  text: string;
  hazardLevel: HazardLevel;
  clockDirection: string;
  distanceText: string;
  mode: OperatingMode;
  channel?: AssistiveChannel;
  context?: string;
}
