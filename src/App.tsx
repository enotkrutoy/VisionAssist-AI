/**
 * VisionAssist AI - Smart Real-Time Multimodal Assistance System
 * Designed for visually impaired and blind users.
 * WCAG 2.1 AAA Compliant. Default Language: Russian (Русский интерфейс).
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  OperatingMode,
  AssistiveChannel,
  SpatialAnalysis,
  DeviceSensorState,
  SpeechHistoryItem,
} from './types/assistant';
import { analyzeScene } from './services/apiClient';
import {
  speechManager,
  playHazardTone,
  triggerHapticFeedback,
  unlockAudio,
  lightSonar,
} from './services/audioEngine';
import { voiceInputManager } from './services/voiceInput';
import { AccessibleHeader } from './components/AccessibleHeader';
import { ChannelSelectorBar } from './components/ChannelSelectorBar';
import { ClockRadarHud } from './components/ClockRadarHud';
import { CameraStream } from './components/CameraStream';
import { LiveTranscriptBox } from './components/LiveTranscriptBox';
import { TactileControlDeck } from './components/TactileControlDeck';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ProtocolGuideModal } from './components/ProtocolGuideModal';

export default function App() {
  // Russian interface default
  const [lang, setLang] = useState<'en' | 'ru'>('ru');
  const isRu = lang === 'ru';

  const [currentMode, setCurrentMode] = useState<OperatingMode>('PASSIVE');
  const [currentChannel, setCurrentChannel] = useState<AssistiveChannel>('EXPLORE');
  const [targetSearchObject, setTargetSearchObject] = useState<string>('дверь');

  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const [masterSoundEnabled, setMasterSoundEnabled] = useState<boolean>(true);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isApiKeyOpen, setIsApiKeyOpen] = useState<boolean>(false);
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('visionassist_gemini_api_key')) || '';
  });
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);

  // Screen Reader Live Regions
  const [criticalAriaAlert, setCriticalAriaAlert] = useState<string>('');
  const [politeAriaAlert, setPoliteAriaAlert] = useState<string>('');

  // Device Sensors
  const [sensors, setSensors] = useState<DeviceSensorState>({
    pitch: 75,
    tiltZone: 'FORWARD',
    luminance: 120,
    isLowLight: false,
    isLensBlocked: false,
    isTorchOn: false,
    hasTorch: false,
    audioBeepsEnabled: true,
    hapticsEnabled: true,
    speechRate: 1.05,
    highContrast: true,
  });

  // Current analysis state
  const [lastAnalysis, setLastAnalysis] = useState<SpatialAnalysis>({
    ttsMessage: 'VisionAssist AI готова к работе. Направьте камеру устройства вперед.',
    hazardLevel: 0,
    hazardType: 'CLEAR',
    clockDirection: '12',
    distanceMeters: 0,
    distanceText: 'чисто',
    verticalZone: 'GENERAL',
    clipContext: 'Городское пространство',
    suggestedAction: 'CONTINUE',
    shouldSpeak: false,
    detectedObjects: [],
  });

  const lastSpokenTextRef = useRef<string>('');
  const lastFrameBase64Ref = useRef<string>('');
  const isAnalyzingRef = useRef<boolean>(false);
  const touchStartXRef = useRef<number | null>(null);

  // Save API key to localStorage
  const handleSaveApiKey = (key: string) => {
    setCustomApiKey(key);
    if (typeof window !== 'undefined') {
      if (key) {
        localStorage.setItem('visionassist_gemini_api_key', key);
      } else {
        localStorage.removeItem('visionassist_gemini_api_key');
      }
    }
  };

  // Toggle Language
  const handleToggleLang = () => {
    const nextLang = lang === 'en' ? 'ru' : 'en';
    setLang(nextLang);
    const msg = nextLang === 'ru' ? 'Выбран русский интерфейс' : 'Switched to English';
    speechManager.speak(msg, { lang: nextLang, level: 3 });
  };

  // Light Sonar
  useEffect(() => {
    if (currentChannel === 'LIGHT_SONAR' && masterSoundEnabled && !isPaused) {
      lightSonar.start();
      lightSonar.updateLuminance(sensors.luminance);
    } else {
      lightSonar.stop();
    }
    return () => {
      lightSonar.stop();
    };
  }, [currentChannel, masterSoundEnabled, isPaused, sensors.luminance]);

  // Audio unlock on first user gesture
  useEffect(() => {
    const handleFirstGesture = () => {
      unlockAudio();
    };
    window.addEventListener('click', handleFirstGesture, { passive: true });
    window.addEventListener('touchstart', handleFirstGesture, { passive: true });
    window.addEventListener('keydown', handleFirstGesture, { passive: true });
    return () => {
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
  }, []);

  // Device orientation (gyro tilt)
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta !== null) {
        const pitch = e.beta;
        let tiltZone: 'HEAD' | 'FORWARD' | 'GROUND' = 'FORWARD';
        if (pitch < 45 && pitch > -30) {
          tiltZone = 'GROUND';
        } else if (pitch > 105 || pitch < -45) {
          tiltZone = 'HEAD';
        } else {
          tiltZone = 'FORWARD';
        }

        setSensors((prev) => ({
          ...prev,
          pitch,
          tiltZone,
        }));
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, []);

  // Deliver Speech & Earcons
  const executeSpeechOutput = useCallback(
    (text: string, level: number, clockDirection: string = '12') => {
      if (!text || !masterSoundEnabled || isPaused) return;

      lastSpokenTextRef.current = text;

      // Update ARIA live regions
      if (level === 1) {
        setCriticalAriaAlert(text);
      } else {
        setPoliteAriaAlert(text);
      }

      // 1. Play 3D Spatial Audio Earcon (880Hz square wave for Tier 1)
      if (sensors.audioBeepsEnabled) {
        playHazardTone(level, clockDirection);
      }

      // 2. Tactical haptic vibration
      if (sensors.hapticsEnabled) {
        triggerHapticFeedback(level);
      }

      // 3. Speech Synthesis
      speechManager.speak(text, {
        lang,
        level,
        rate: sensors.speechRate,
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    },
    [masterSoundEnabled, isPaused, lang, sensors.audioBeepsEnabled, sensors.hapticsEnabled, sensors.speechRate]
  );

  // Spoken feedback for mode transitions
  const handleSelectMode = (mode: OperatingMode) => {
    setCurrentMode(mode);
    const announcementsRu: Record<OperatingMode, string> = {
      PASSIVE: 'Пассивный режим: тишина до обнаружения препятствий.',
      ACTIVE: 'Активный режим: готов к голосовому вопросу.',
      NAVIGATION: 'Режим навигации: ведение по циферблату часов.',
    };
    const announcementsEn: Record<OperatingMode, string> = {
      PASSIVE: 'Passive Mode: silent until hazard detected.',
      ACTIVE: 'Active Mode: ready for voice question.',
      NAVIGATION: 'Navigation Mode: wayfinding active.',
    };

    const text = isRu ? announcementsRu[mode] : announcementsEn[mode];
    executeSpeechOutput(text, 3, '12');
  };

  // Spoken feedback for channel transitions
  const handleSelectChannel = (channel: AssistiveChannel) => {
    setCurrentChannel(channel);
    const channelAnnouncementsRu: Record<AssistiveChannel, string> = {
      EXPLORE: 'Канал навигация: часы и препятствия.',
      TEXT_OCR: 'Канал быстрый текст: наведите камеру на вывеску.',
      CURRENCY: 'Канал купюры: поднесите банкноту к камере.',
      FIND_OBJECT: `Канал поиск цели: ищу ${targetSearchObject}.`,
      LIGHT_SONAR: 'Канал световой сонар: тональный сигнал освещенности включен.',
    };
    const channelAnnouncementsEn: Record<AssistiveChannel, string> = {
      EXPLORE: 'Explore Channel: obstacles and clock directions.',
      TEXT_OCR: 'Text OCR Channel: point camera at sign or text.',
      CURRENCY: 'Currency Channel: hold banknote in front of camera.',
      FIND_OBJECT: `Find Object Channel: locating ${targetSearchObject}.`,
      LIGHT_SONAR: 'Light Sonar Channel: acoustic light tone active.',
    };

    const text = isRu ? channelAnnouncementsRu[channel] : channelAnnouncementsEn[channel];
    executeSpeechOutput(text, 3, '12');
  };

  const handleSelectTargetObject = (target: string) => {
    setTargetSearchObject(target);
    const msg = isRu ? `Цель поиска: ${target}.` : `Target set: ${target}.`;
    executeSpeechOutput(msg, 3, '12');
  };

  // Analyze Frame
  const handleAnalyzeFrame = useCallback(
    async (imageBase64: string, explicitQuery: string = '') => {
      if (!imageBase64 || isAnalyzingRef.current || isPaused) return;

      lastFrameBase64Ref.current = imageBase64;
      isAnalyzingRef.current = true;
      setIsAnalyzing(true);

      try {
        const analysis = await analyzeScene({
          imageBase64,
          mode: currentMode,
          channel: currentChannel,
          targetObject: targetSearchObject,
          userQuery: explicitQuery,
          sensors,
          lastSpokenText: lastSpokenTextRef.current,
          apiKey: customApiKey,
          lang,
        });

        setLastAnalysis(analysis);

        // Speaking logic:
        // PASSIVE: speaks ONLY if obstacle on path (<2m) or Tier 1/2 hazard
        // ACTIVE / NAVIGATION: speaks all results
        const isSpecialChannel =
          currentChannel === 'TEXT_OCR' ||
          currentChannel === 'CURRENCY' ||
          currentChannel === 'FIND_OBJECT';

        const mustSpeak =
          isSpecialChannel ||
          currentMode === 'ACTIVE' ||
          currentMode === 'NAVIGATION' ||
          analysis.hazardLevel === 1 ||
          analysis.hazardLevel === 2 ||
          analysis.shouldSpeak;

        if (mustSpeak && analysis.ttsMessage) {
          executeSpeechOutput(analysis.ttsMessage, analysis.hazardLevel, analysis.clockDirection);
        }
      } catch (err: any) {
        if (err.message && !err.message.includes('superseded')) {
          console.warn('Frame analysis notice:', err.message);
        }
      } finally {
        isAnalyzingRef.current = false;
        setIsAnalyzing(false);
      }
    },
    [currentMode, currentChannel, targetSearchObject, sensors, customApiKey, lang, isPaused, executeSpeechOutput]
  );

  // Hold to Talk
  const handleActiveHoldStart = () => {
    if (voiceInputManager.isSupported()) {
      setIsListening(true);
      playHazardTone(3, '12');
      voiceInputManager.startListening(
        lang,
        (transcript) => {
          setIsListening(false);
          if (lastFrameBase64Ref.current) {
            handleAnalyzeFrame(lastFrameBase64Ref.current, transcript);
          }
        },
        () => {
          setIsListening(false);
        }
      );
    } else {
      // Instant query fallback
      if (lastFrameBase64Ref.current) {
        handleAnalyzeFrame(lastFrameBase64Ref.current, isRu ? 'Что передо мной?' : 'What is in front of me?');
      }
    }
  };

  const handleActiveHoldEnd = () => {
    if (isListening) {
      voiceInputManager.stopListening();
      setIsListening(false);
    }
  };

  const handleReplayCurrent = useCallback(() => {
    if (lastAnalysis.ttsMessage) {
      executeSpeechOutput(lastAnalysis.ttsMessage, lastAnalysis.hazardLevel, lastAnalysis.clockDirection);
    }
  }, [lastAnalysis.ttsMessage, lastAnalysis.hazardLevel, lastAnalysis.clockDirection, executeSpeechOutput]);

  const handleStopSpeech = useCallback(() => {
    speechManager.stop();
    setIsSpeaking(false);
  }, []);

  // Full-Screen Gestures (Swipe Left: Passive Mode; Swipe Right: Navigation Mode)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchEndX - touchStartXRef.current;

    if (Math.abs(diffX) > 75) {
      if (diffX < 0) {
        // Swipe Left: Passive Mode
        handleSelectMode('PASSIVE');
      } else {
        // Swipe Right: Navigation Mode
        handleSelectMode('NAVIGATION');
      }
    }
    touchStartXRef.current = null;
  };

  // Keypad support: Spacebar = Instant Scan / Stop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (speechManager.getSpeakingState()) {
          handleStopSpeech();
        } else if (lastFrameBase64Ref.current) {
          handleAnalyzeFrame(lastFrameBase64Ref.current);
        } else {
          handleReplayCurrent();
        }
      } else if (e.code === 'Escape') {
        e.preventDefault();
        handleStopSpeech();
      } else if (e.key === '1') {
        handleSelectMode('PASSIVE');
      } else if (e.key === '2') {
        handleSelectMode('ACTIVE');
      } else if (e.key === '3') {
        handleSelectMode('NAVIGATION');
      } else if (e.key === '4') {
        handleSelectChannel('EXPLORE');
      } else if (e.key === '5') {
        handleSelectChannel('TEXT_OCR');
      } else if (e.key === '6') {
        handleSelectChannel('CURRENCY');
      } else if (e.key === '7') {
        handleSelectChannel('FIND_OBJECT');
      } else if (e.key === '8') {
        handleSelectChannel('LIGHT_SONAR');
      } else if (e.key.toLowerCase() === 'm' || e.key.toLowerCase() === 'ь') {
        setMasterSoundEnabled((prev) => !prev);
      } else if (e.key.toLowerCase() === 't' || e.key.toLowerCase() === 'е') {
        setIsTorchOn((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleReplayCurrent, handleStopSpeech, handleAnalyzeFrame]);

  // Luminance & Occlusion Callback
  const handleLuminanceChange = useCallback(
    (luminance: number, isLowLight: boolean, isBlocked: boolean) => {
      if (currentChannel === 'LIGHT_SONAR') {
        lightSonar.updateLuminance(luminance);
      }

      setSensors((prev) => {
        if (
          Math.abs(prev.luminance - luminance) > 6 ||
          prev.isLowLight !== isLowLight ||
          prev.isLensBlocked !== isBlocked
        ) {
          return {
            ...prev,
            luminance,
            isLowLight,
            isLensBlocked: isBlocked,
          };
        }
        return prev;
      });

      // Safety announcements if dark or blocked
      if (isBlocked && !lastSpokenTextRef.current.includes('Камера перекрыта') && !lastSpokenTextRef.current.includes('Camera is covered')) {
        const msg = isRu ? 'Камера перекрыта.' : 'Camera is covered.';
        executeSpeechOutput(msg, 1, '12');
      } else if (isLowLight && !lastSpokenTextRef.current.includes('Недостаточно света') && !lastSpokenTextRef.current.includes('Too dark')) {
        const msg = isRu ? 'Недостаточно света для обзора, иди осторожно.' : 'Too dark to see, proceed with caution.';
        executeSpeechOutput(msg, 2, '12');
      }
    },
    [currentChannel, isRu, executeSpeechOutput]
  );

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="min-h-screen flex flex-col font-sans bg-black text-white selection:bg-[#FFEE00] selection:text-black"
    >
      {/* WCAG AAA Screen Reader Live Regions */}
      <div aria-live="assertive" role="alert" className="sr-only">
        {criticalAriaAlert}
      </div>
      <div aria-live="polite" className="sr-only">
        {politeAriaAlert}
      </div>

      {/* Top Header */}
      <AccessibleHeader
        currentMode={currentMode}
        onSelectMode={handleSelectMode}
        masterSoundEnabled={masterSoundEnabled}
        onToggleMasterSound={() => setMasterSoundEnabled(!masterSoundEnabled)}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenApiKey={() => setIsApiKeyOpen(true)}
        hasCustomKey={Boolean(customApiKey)}
        isTorchOn={isTorchOn}
        onToggleTorch={() => setIsTorchOn(!isTorchOn)}
        lang={lang}
        onToggleLang={handleToggleLang}
      />

      {/* Main Single Page Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Specialized Channels Bar */}
        <ChannelSelectorBar
          activeChannel={currentChannel}
          onSelectChannel={handleSelectChannel}
          targetObject={targetSearchObject}
          onSelectTargetObject={handleSelectTargetObject}
          lang={lang}
        />

        {/* Live Transcript Box in Large 24px Bold Text */}
        <LiveTranscriptBox
          ttsMessage={lastAnalysis.ttsMessage}
          hazardLevel={lastAnalysis.hazardLevel}
          hazardType={lastAnalysis.hazardType}
          clockDirection={lastAnalysis.clockDirection}
          distanceText={lastAnalysis.distanceText}
          isSpeaking={isSpeaking}
          onReplay={handleReplayCurrent}
          onStopSpeech={handleStopSpeech}
          lang={lang}
        />

        {/* Center Viewport + 360 Clock Radar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Camera Viewport (7 cols) */}
          <div className="lg:col-span-7">
            <CameraStream
              onCaptureFrame={(base64) => handleAnalyzeFrame(base64)}
              isAnalyzing={isAnalyzing}
              detectedObjects={lastAnalysis.detectedObjects}
              hazardLevel={lastAnalysis.hazardLevel}
              autoScanInterval={1.5}
              highContrast={true}
              lang={lang}
              onLuminanceChange={handleLuminanceChange}
              isTorchOn={isTorchOn}
              onToggleTorch={setIsTorchOn}
            />
          </div>

          {/* Clock-Face Spatial Radar HUD (5 cols) */}
          <div className="lg:col-span-5">
            <ClockRadarHud
              clockDirection={lastAnalysis.clockDirection}
              distanceMeters={lastAnalysis.distanceMeters}
              hazardLevel={lastAnalysis.hazardLevel}
              verticalZone={lastAnalysis.verticalZone}
              suggestedAction={lastAnalysis.suggestedAction}
              detectedValue={lastAnalysis.detectedValue}
              activeChannel={currentChannel}
              lang={lang}
            />
          </div>
        </div>

        {/* Bottom Tactile Control Deck: 3 Giant Tactile Mode Buttons & Emergency Pause */}
        <TactileControlDeck
          currentMode={currentMode}
          onSelectMode={handleSelectMode}
          isPaused={isPaused}
          onTogglePause={() => {
            const next = !isPaused;
            setIsPaused(next);
            executeSpeechOutput(
              next
                ? (isRu ? 'Ассистент приостановлен.' : 'Assistant paused.')
                : (isRu ? 'Ассистент возобновлен.' : 'Assistant resumed.'),
              3,
              '12'
            );
          }}
          onActiveHoldStart={handleActiveHoldStart}
          onActiveHoldEnd={handleActiveHoldEnd}
          isListening={isListening}
          lang={lang}
        />
      </main>

      {/* Production Footer */}
      <footer className="py-4 px-6 border-t-2 border-[#FFEE00] bg-black text-center text-xs text-zinc-400">
        VisionAssist AI · Стандарт доступности WCAG 2.1 AAA · 3D Пространственный звук (880 Гц) · Мультимодальный ИИ Gemini Flash
      </footer>

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={isApiKeyOpen}
        onClose={() => setIsApiKeyOpen(false)}
        apiKey={customApiKey}
        onSaveKey={handleSaveApiKey}
        lang={lang}
      />

      {/* Protocol Guide Specification Modal */}
      <ProtocolGuideModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  );
}
