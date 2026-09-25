import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  VideoOff,
  Zap,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Sliders,
  Maximize2,
  Activity,
} from 'lucide-react';
import { DetectedObject } from '../types/assistant';
import { playHazardTone, triggerHapticFeedback } from '../services/audioEngine';

interface CameraStreamProps {
  onCaptureFrame: (base64Image: string) => void;
  isAnalyzing: boolean;
  detectedObjects: DetectedObject[];
  hazardLevel: number;
  autoScanInterval?: number;
  highContrast?: boolean;
  lang?: 'en' | 'ru';
  onLuminanceChange?: (luminance: number, isLowLight: boolean, isBlocked: boolean) => void;
  isTorchOn?: boolean;
  onToggleTorch?: (state: boolean) => void;
}

export const CameraStream: React.FC<CameraStreamProps> = ({
  onCaptureFrame,
  isAnalyzing,
  detectedObjects,
  hazardLevel,
  autoScanInterval = 1.5,
  lang = 'ru',
  onLuminanceChange,
  isTorchOn = false,
  onToggleTorch,
}) => {
  const isRu = lang === 'ru';
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isDemoActive, setIsDemoActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraError, setCameraError] = useState<{
    title: string;
    message: string;
    isIframeBlocked?: boolean;
  } | null>(null);
  const [hasTorchCapability, setHasTorchCapability] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [isInIframe, setIsInIframe] = useState<boolean>(false);
  const [hasMotion, setHasMotion] = useState<boolean>(false);
  const [streamResolution, setStreamResolution] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const autoScanTimerRef = useRef<any>(null);
  const demoAnimationRef = useRef<any>(null);
  const isStartingRef = useRef<boolean>(false);
  const prevFrameSampleRef = useRef<Uint8Array | null>(null);
  const lastScanTimestampRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        setIsInIframe(window.self !== window.top);
      } catch {
        setIsInIframe(true);
      }
    }
  }, []);

  const refreshCameras = useCallback(async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      setAvailableCameras(videoInputs);
      return videoInputs;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    if (navigator?.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', refreshCameras);
      return () => navigator.mediaDevices.removeEventListener('devicechange', refreshCameras);
    }
  }, [refreshCameras]);

  /**
   * High-Fidelity WebRTC MediaStream Starter
   * Uses ideal 1280x720 / continuous autofocus constraints for razor-sharp CV & OCR
   */
  const startCamera = useCallback(
    async (targetFacing: 'environment' | 'user' = facingMode, specificDeviceId?: string) => {
      if (isStartingRef.current) return;
      isStartingRef.current = true;
      setIsStarting(true);
      setCameraError(null);
      setIsDemoActive(false);

      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error('navigator.mediaDevices.getUserMedia is not supported');
        }

        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }

        let stream: MediaStream | null = null;

        // Attempt 1: HD WebRTC Constraints with deviceId if provided
        const hdConstraints: MediaTrackConstraints = {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30, max: 30 },
          facingMode: { ideal: targetFacing },
        };

        if (specificDeviceId) {
          hdConstraints.deviceId = { exact: specificDeviceId };
        }

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: hdConstraints,
            audio: false,
          });
        } catch {}

        // Attempt 2: Relaxed Facing Mode
        if (!stream) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: { ideal: targetFacing } },
              audio: false,
            });
          } catch {}
        }

        // Attempt 3: Pure video fallback
        if (!stream) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        if (!stream) {
          throw new Error('Failed to acquire camera stream');
        }

        mediaStreamRef.current = stream;
        setIsCameraActive(true);
        setCameraError(null);

        // Apply continuous autofocus & exposure where supported
        const track = stream.getVideoTracks()[0];
        if (track) {
          if ((track as any).applyConstraints) {
            try {
              await (track as any).applyConstraints({
                advanced: [
                  { focusMode: 'continuous' },
                  { exposureMode: 'continuous' },
                  { whiteBalanceMode: 'continuous' },
                ],
              }).catch(() => {});
            } catch {}
          }

          const caps: any = track.getCapabilities ? track.getCapabilities() : {};
          setHasTorchCapability(Boolean(caps?.torch));

          const settings = track.getSettings?.();
          if (settings?.deviceId) {
            setSelectedDeviceId(settings.deviceId);
          }
          if (settings?.width && settings?.height) {
            setStreamResolution({ width: settings.width, height: settings.height });
          }
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch((playErr) => {
            console.warn('Video play error:', playErr);
          });
        }

        await refreshCameras();
        playHazardTone(3);
        triggerHapticFeedback(3);
      } catch (err: any) {
        setIsCameraActive(false);
        const errMsg = err?.message || String(err);
        const errName = err?.name || '';

        if (
          errName === 'NotAllowedError' ||
          errName === 'PermissionDeniedError' ||
          errMsg.includes('Permission denied')
        ) {
          setCameraError({
            title: isRu ? 'Камера заблокирована во фрейме' : 'Camera Blocked in Iframe',
            message: isRu
              ? 'Chrome блокирует доступ к камере во встроенном окне предпросмотра. Нажмите желтую кнопку «Открыть в отдельной вкладке» ниже.'
              : 'Chrome restricts camera access inside embedded preview iframes. Click "Open in Standalone Tab" below for direct 1-click access.',
            isIframeBlocked: true,
          });
        } else if (
          errName === 'NotReadableError' ||
          errName === 'TrackStartError' ||
          errMsg.includes('busy')
        ) {
          setCameraError({
            title: isRu ? 'Камера занята другим приложением' : 'Camera Busy',
            message: isRu
              ? 'Камера используется другим приложением. Закройте другие окна и нажмите кнопку повтора.'
              : 'Camera is in use by another application. Close it and retry.',
            isIframeBlocked: false,
          });
        } else {
          setCameraError({
            title: isRu ? 'Ошибка камеры' : 'Camera Access Error',
            message: errMsg || (isRu ? 'Не удалось запустить видеоустройство.' : 'Could not start camera.'),
            isIframeBlocked: false,
          });
        }
      } finally {
        isStartingRef.current = false;
        setIsStarting(false);
      }
    },
    [facingMode, isRu, refreshCameras]
  );

  const stopCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsDemoActive(false);
    if (demoAnimationRef.current) {
      cancelAnimationFrame(demoAnimationRef.current);
    }
  }, []);

  useEffect(() => {
    refreshCameras();
    return () => {
      stopCamera();
    };
  }, [refreshCameras, stopCamera]);

  // Torch control
  useEffect(() => {
    if (!mediaStreamRef.current) return;
    const track = mediaStreamRef.current.getVideoTracks()[0];
    if (track && (track as any).applyConstraints && hasTorchCapability) {
      try {
        (track as any).applyConstraints({
          advanced: [{ torch: isTorchOn }],
        }).catch(() => {});
      } catch {}
    }
  }, [isTorchOn, hasTorchCapability]);

  const switchFacingMode = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera(next);
  };

  const handleSelectCameraDevice = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    startCamera(facingMode, deviceId);
  };

  /**
   * Aspect-Ratio-Preserved HD Frame Grabber & Edge Motion Detector:
   * - Preserves true geometry (no squished aspect ratio distortion!)
   * - Scales to ideal 960px max dimension with high JPEG quality (0.85)
   * - Analyzes pixel luminance (<25 lux = dark; <6 = covered)
   * - Computes motion delta to trigger fast auto-scan when camera moves
   */
  const captureFrame = useCallback(
    (force: boolean = false) => {
      if (isAnalyzing || !canvasRef.current) return;

      if (isCameraActive && videoRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video.videoWidth === 0 || video.videoHeight === 0) return;

        // Preserve native aspect ratio!
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const aspect = vw / vh;

        let targetW = 960;
        let targetH = Math.round(960 / aspect);
        if (targetH > 720) {
          targetH = 720;
          targetW = Math.round(720 * aspect);
        }

        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        ctx.drawImage(video, 0, 0, targetW, targetH);

        // Edge Motion Detection & Luminance calculation on 32x32 sample
        try {
          const sampleW = 32;
          const sampleH = 32;
          const sampleCanvas = document.createElement('canvas');
          sampleCanvas.width = sampleW;
          sampleCanvas.height = sampleH;
          const sampleCtx = sampleCanvas.getContext('2d');
          if (sampleCtx) {
            sampleCtx.drawImage(canvas, 0, 0, sampleW, sampleH);
            const imgData = sampleCtx.getImageData(0, 0, sampleW, sampleH).data;

            let totalBrightness = 0;
            const currentSample = new Uint8Array(sampleW * sampleH);
            let pixelIdx = 0;

            for (let i = 0; i < imgData.length; i += 4) {
              const lum = Math.round(0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2]);
              totalBrightness += lum;
              currentSample[pixelIdx++] = lum;
            }

            const avgLuminance = totalBrightness / (sampleW * sampleH);
            const isLowLight = avgLuminance < 25;
            const isBlocked = avgLuminance < 6;
            onLuminanceChange?.(avgLuminance, isLowLight, isBlocked);

            // Motion Delta Check
            if (prevFrameSampleRef.current) {
              let diff = 0;
              for (let j = 0; j < currentSample.length; j++) {
                diff += Math.abs(currentSample[j] - prevFrameSampleRef.current[j]);
              }
              const avgDiff = diff / currentSample.length;
              const hasSceneMotion = avgDiff > 12;
              setHasMotion(hasSceneMotion);
            }
            prevFrameSampleRef.current = currentSample;
          }
        } catch {}

        // High fidelity JPEG output (0.85 quality)
        const base64 = canvas.toDataURL('image/jpeg', 0.85);
        lastScanTimestampRef.current = Date.now();
        onCaptureFrame(base64);
      } else if (isDemoActive && canvasRef.current) {
        const canvas = canvasRef.current;
        const base64 = canvas.toDataURL('image/jpeg', 0.85);
        lastScanTimestampRef.current = Date.now();
        onCaptureFrame(base64);
      }
    },
    [isAnalyzing, isCameraActive, isDemoActive, onCaptureFrame, onLuminanceChange]
  );

  // Demo simulation mode
  const startDemoSimulation = () => {
    stopCamera();
    setIsDemoActive(true);
    setCameraError(null);

    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 960;
    canvas.height = 540;

    let animStep = 0;
    const renderDemo = () => {
      animStep++;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 960, 540);

        // Corridor perspective
        const grad = ctx.createLinearGradient(0, 270, 0, 540);
        grad.addColorStop(0, '#111827');
        grad.addColorStop(1, '#1f2937');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 270, 960, 270);

        // Left wall
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(300, 270);
        ctx.lineTo(0, 540);
        ctx.fill();

        // Right wall
        ctx.beginPath();
        ctx.moveTo(960, 0);
        ctx.lineTo(660, 270);
        ctx.lineTo(960, 540);
        ctx.fill();

        // Door at 12 o'clock center
        ctx.fillStyle = '#334155';
        ctx.fillRect(410, 180, 140, 270);
        ctx.fillStyle = '#FFEE00';
        ctx.fillRect(525, 310, 10, 10);

        // Door handle & room sign
        ctx.fillStyle = '#FFEE00';
        ctx.fillRect(430, 130, 100, 32);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('КАБИНЕТ 101', 438, 152);

        // Chair on 10 o'clock
        ctx.fillStyle = '#475569';
        ctx.fillRect(180, 320, 80, 90);

        ctx.fillStyle = '#FFEE00';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('ДЕМО-ПОТОК: ДВЕРЬ НА 12 ЧАСОВ, СТУЛ НА 10 ЧАСОВ', 24, 40);
      }
      demoAnimationRef.current = requestAnimationFrame(renderDemo);
    };

    renderDemo();
    setTimeout(() => {
      const base64 = canvas.toDataURL('image/jpeg', 0.85);
      onCaptureFrame(base64);
    }, 250);
  };

  const handleNativeSnapshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUri = event.target?.result as string;
      if (dataUri) {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          const aspect = img.width / img.height;
          let targetW = 960;
          let targetH = Math.round(960 / aspect);
          if (targetH > 720) {
            targetH = 720;
            targetW = Math.round(720 * aspect);
          }
          c.width = targetW;
          c.height = targetH;
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, targetW, targetH);
            onCaptureFrame(c.toDataURL('image/jpeg', 0.85));
          }
        };
        img.src = dataUri;
      }
    };
    reader.readAsDataURL(file);
  };

  // Adaptive Auto-Scan Timer
  useEffect(() => {
    if ((isCameraActive || isDemoActive) && autoScanInterval > 0) {
      autoScanTimerRef.current = setInterval(() => {
        captureFrame();
      }, autoScanInterval * 1000);
    }
    return () => {
      if (autoScanTimerRef.current) {
        clearInterval(autoScanTimerRef.current);
      }
    };
  }, [isCameraActive, isDemoActive, autoScanInterval, captureFrame]);

  // Synchronized High-Contrast Bounding Box HUD Overlays
  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!overlay) return;

    if (video && video.videoWidth && video.videoHeight) {
      overlay.width = video.videoWidth;
      overlay.height = video.videoHeight;
    } else {
      overlay.width = 960;
      overlay.height = 540;
    }

    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, overlay.width, overlay.height);
    if (!detectedObjects || detectedObjects.length === 0) return;

    detectedObjects.forEach((obj) => {
      if (!obj.box2d || obj.box2d.length !== 4) return;
      const [ymin, xmin, ymax, xmax] = obj.box2d;
      const x = (xmin / 1000) * overlay.width;
      const y = (ymin / 1000) * overlay.height;
      const width = ((xmax - xmin) / 1000) * overlay.width;
      const height = ((ymax - ymin) / 1000) * overlay.height;

      // Color coding:
      // Red for critical obstacles (Tier 1)
      // Amber for warning (Tier 2)
      // Neon Yellow / Emerald for safe landmarks & detected target (Tier 3)
      const color =
        obj.hazardLevel === 1
          ? '#EF4444' // RED for critical hazard
          : obj.hazardLevel === 2
          ? '#F59E0B' // AMBER for warning
          : '#FFEE00'; // NEON YELLOW for safe paths & objects

      // High-contrast glowing outline
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 3;
      ctx.strokeStyle = color;
      ctx.strokeRect(x, y, width, height);
      ctx.shadowBlur = 0;

      // Tinted fill
      ctx.fillStyle =
        obj.hazardLevel === 1
          ? 'rgba(239, 68, 68, 0.15)'
          : obj.hazardLevel === 2
          ? 'rgba(245, 158, 11, 0.12)'
          : 'rgba(255, 238, 0, 0.1)';
      ctx.fillRect(x, y, width, height);

      // Label badge
      const clockText = obj.clockDirection && obj.clockDirection !== 'NONE' ? `${obj.clockDirection}ч` : '';
      const parts = [obj.label, clockText, obj.distance].filter(Boolean);
      const label = parts.join(' · ');

      ctx.font = 'bold 13px sans-serif';
      const textMetrics = ctx.measureText(label);
      const pad = 8;
      const badgeH = 22;
      const badgeW = textMetrics.width + pad * 2;
      const badgeY = Math.max(0, y - badgeH);

      ctx.fillStyle = color;
      ctx.fillRect(x, badgeY, badgeW, badgeH);

      ctx.fillStyle = '#000000';
      ctx.fillText(label, x + pad, badgeY + 16);
    });
  }, [detectedObjects]);

  return (
    <section
      aria-label="Camera Video Stream Viewport"
      className="relative flex flex-col rounded-3xl overflow-hidden border-2 border-[#FFEE00] bg-black shadow-2xl"
    >
      {/* Viewport Top Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-black border-b border-[#FFEE00]/40 text-xs">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-3.5 h-3.5 rounded-full ${
              isCameraActive
                ? 'bg-[#FFEE00] animate-pulse'
                : isDemoActive
                ? 'bg-cyan-400 animate-pulse'
                : 'bg-red-500'
            }`}
          />
          <span className="font-extrabold tracking-wider uppercase text-xs text-[#FFEE00]">
            {isCameraActive
              ? `ВИДЕОПОТОК: ${facingMode === 'environment' ? 'ОСНОВНАЯ КАМЕРА' : 'СЕЛФИ / ВЕБКА'}`
              : isDemoActive
              ? 'ДЕМО-ПОТОК АКТИВЕН'
              : 'КАМЕРА ГОТОВА К РАБОТЕ'}
          </span>
        </div>

        {/* Live Analysis & Motion Badges */}
        <div className="flex items-center gap-2 font-mono text-xs">
          {hasMotion && isCameraActive && (
            <span className="flex items-center gap-1 text-black bg-[#FFEE00] px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase">
              <Activity className="w-3 h-3 animate-pulse" />
              ДВИЖЕНИЕ
            </span>
          )}

          {isAnalyzing ? (
            <span className="flex items-center gap-1.5 text-black bg-[#FFEE00] px-3 py-1 rounded-full font-black uppercase text-[11px]">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              АНАЛИЗ
            </span>
          ) : isCameraActive || isDemoActive ? (
            <span className="text-[#FFEE00] font-bold flex items-center gap-1 text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              ОНЛАЙН (1.5 с)
            </span>
          ) : (
            <span className="text-zinc-400 font-bold">ГОТОВО</span>
          )}
        </div>
      </div>

      {/* Main Video Viewport Canvas Container */}
      <div
        onClick={() => captureFrame(true)}
        className="relative w-full aspect-video bg-zinc-950 flex items-center justify-center overflow-hidden cursor-pointer"
        title="Нажмите для мгновенного сканирования"
      >
        {/* Hidden Frame Capture Canvas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Real-Time HTML5 Video Element */}
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isCameraActive ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
          }`}
        />

        {/* Bounding Box HUD Overlay Canvas */}
        <canvas
          ref={overlayCanvasRef}
          className={`absolute inset-0 w-full h-full pointer-events-none object-cover ${
            isCameraActive || isDemoActive ? 'block' : 'hidden'
          }`}
        />

        {/* If Camera is NOT active and Demo is NOT active: Large Start Button */}
        {!isCameraActive && !isDemoActive && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-4 bg-black/90">
            <div className="w-20 h-20 rounded-3xl bg-[#FFEE00] text-black flex items-center justify-center shadow-lg">
              <Camera className="w-10 h-10 stroke-[2.5]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-[#FFEE00]">
                {isRu ? 'Камера выключена' : 'Camera is Inactive'}
              </h3>
              <p className="text-xs text-zinc-400 max-w-sm">
                {isRu
                  ? 'Включите камеру вашего устройства для пространственной навигации и обнаружения препятствий в реальном времени.'
                  : 'Start your camera for real-time spatial guidance and hazard obstacle detection.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startCamera('environment');
                }}
                disabled={isStarting}
                className="flex items-center gap-2 px-6 py-3.5 bg-[#FFEE00] hover:bg-[#ffe600] text-black font-black rounded-2xl text-xs uppercase tracking-wider transition min-h-[48px]"
              >
                {isStarting ? (
                  <RefreshCw className="w-4 h-4 animate-spin stroke-[3]" />
                ) : (
                  <Camera className="w-4 h-4 stroke-[3]" />
                )}
                <span>{isRu ? 'ВКЛЮЧИТЬ КАМЕРУ' : 'START CAMERA'}</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startDemoSimulation();
                }}
                className="flex items-center gap-2 px-5 py-3.5 bg-zinc-900 border-2 border-zinc-700 hover:border-[#FFEE00] text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition min-h-[48px]"
              >
                <Sparkles className="w-4 h-4 text-[#FFEE00]" />
                <span>{isRu ? 'ДЕМО-ПОТОК (СИМУЛЯЦИЯ)' : 'DEMO SIMULATION'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Camera Error / Permission Fallback */}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-4 bg-black/95 z-20">
            <div className="w-16 h-16 rounded-2xl bg-red-950 border-2 border-red-500 text-red-400 flex items-center justify-center">
              <VideoOff className="w-8 h-8 stroke-[2.5]" />
            </div>

            <div className="space-y-1.5 max-w-md">
              <h3 className="text-lg font-black text-red-400">{cameraError.title}</h3>
              <p className="text-xs text-zinc-300 leading-relaxed">{cameraError.message}</p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {cameraError.isIframeBlocked && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(window.location.href, '_blank');
                  }}
                  className="flex items-center gap-2 px-5 py-3 bg-[#FFEE00] hover:bg-[#ffe600] text-black font-black rounded-xl text-xs uppercase tracking-wider transition min-h-[48px]"
                >
                  <ExternalLink className="w-4 h-4 stroke-[2.5]" />
                  <span>{isRu ? 'ОТКРЫТЬ В ОТДЕЛЬНОЙ ВКЛАДКЕ' : 'OPEN IN NEW TAB'}</span>
                </button>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startDemoSimulation();
                }}
                className="flex items-center gap-2 px-5 py-3 bg-zinc-800 border border-zinc-700 text-white font-bold rounded-xl text-xs uppercase transition min-h-[48px]"
              >
                <Sparkles className="w-4 h-4 text-[#FFEE00]" />
                <span>{isRu ? 'ДЕМО-ПОТОК (СИМУЛЯЦИЯ)' : 'DEMO STREAM'}</span>
              </button>

              <label className="flex items-center gap-2 px-4 py-3 bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-bold rounded-xl text-xs uppercase cursor-pointer transition min-h-[48px]">
                <Camera className="w-4 h-4" />
                <span>{isRu ? 'СДЕЛАТЬ СНИМОК' : 'UPLOAD SNAPSHOT'}</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleNativeSnapshotUpload}
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Viewport Bottom Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-zinc-950 border-t border-zinc-800">
        <div className="flex items-center gap-2">
          {/* Instant Scan Now Button */}
          <button
            onClick={() => captureFrame(true)}
            disabled={isAnalyzing || (!isCameraActive && !isDemoActive)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#FFEE00] hover:bg-[#ffe600] text-black font-black rounded-xl text-xs uppercase tracking-wider transition disabled:opacity-50 min-h-[44px]"
            title="Пробел для сканирования"
          >
            <RefreshCw className={`w-3.5 h-3.5 stroke-[3] ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isRu ? 'СКАНИРОВАТЬ СЕЙЧАС (ПРОБЕЛ)' : 'SCAN NOW (SPACE)'}</span>
          </button>

          {/* Switch Camera Button */}
          {availableCameras.length > 1 && (
            <button
              onClick={switchFacingMode}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-zinc-900 border border-zinc-700 hover:border-[#FFEE00] text-white font-bold rounded-xl text-xs uppercase transition min-h-[44px]"
              title="Переключить камеру"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{facingMode === 'environment' ? 'СЕЛФИ' : 'ОСНОВНАЯ'}</span>
            </button>
          )}

          {/* Torch Button if available */}
          {hasTorchCapability && (
            <button
              onClick={() => onToggleTorch?.(!isTorchOn)}
              className={`flex items-center gap-1.5 px-3 py-2.5 font-black rounded-xl text-xs uppercase transition min-h-[44px] ${
                isTorchOn
                  ? 'bg-[#FFEE00] text-black'
                  : 'bg-zinc-900 border border-zinc-700 text-zinc-300 hover:border-[#FFEE00]'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isTorchOn ? 'СВЕТ ВКЛ' : 'ФОНАРИК'}</span>
            </button>
          )}
        </div>

        {/* Right Action: Stop Camera */}
        {(isCameraActive || isDemoActive) && (
          <button
            onClick={stopCamera}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border border-zinc-800 hover:border-red-500 text-zinc-400 hover:text-red-400 font-bold rounded-xl text-xs uppercase transition min-h-[44px]"
          >
            <VideoOff className="w-3.5 h-3.5" />
            <span>{isRu ? 'ОСТАНОВИТЬ' : 'STOP'}</span>
          </button>
        )}
      </div>
    </section>
  );
};
