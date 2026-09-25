import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Camera,
  RefreshCw,
  Video,
  VideoOff,
  Flashlight,
  FlashlightOff,
  AlertCircle,
  Upload,
  CheckCircle2,
  ExternalLink,
  Play,
} from 'lucide-react';
import { DetectedObject, HazardLevel } from '../types/assistant';
import { playHazardTone, triggerHapticFeedback } from '../services/audioEngine';

interface CameraStreamProps {
  onCaptureFrame: (base64Image: string) => void;
  isAnalyzing: boolean;
  detectedObjects?: DetectedObject[];
  hazardLevel?: HazardLevel;
  autoScanInterval: number; // 1.5s in passive mode
  highContrast?: boolean;
  lang?: 'en' | 'ru';
  onLuminanceChange?: (luminance: number, isLowLight: boolean, isBlocked: boolean) => void;
  isTorchOn: boolean;
  onToggleTorch: (on: boolean) => void;
}

export const CameraStream: React.FC<CameraStreamProps> = ({
  onCaptureFrame,
  isAnalyzing,
  detectedObjects = [],
  hazardLevel = 0,
  autoScanInterval = 1.5, // 1.5s per spec
  highContrast = true,
  lang = 'en',
  onLuminanceChange,
  isTorchOn,
  onToggleTorch,
}) => {
  const isRu = lang === 'ru';
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isMobile =
    typeof navigator !== 'undefined' &&
    /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // Rear camera is primary per spec
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isDemoActive, setIsDemoActive] = useState<boolean>(false);
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

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const autoScanTimerRef = useRef<any>(null);
  const demoAnimationRef = useRef<any>(null);
  const isStartingRef = useRef<boolean>(false);

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

  // Universal Camera Starter
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

        // Attempt 1: Specific Device
        if (specificDeviceId) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: specificDeviceId } },
              audio: false,
            });
          } catch {}
        }

        // Attempt 2: Target Facing (rear camera ideal)
        if (!stream) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: { ideal: targetFacing } },
              audio: false,
            });
          } catch {}
        }

        // Attempt 3: Pure video: true constraint-free
        if (!stream) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          } catch (e) {
            throw e;
          }
        }

        if (!stream) {
          throw new Error('Failed to acquire camera stream');
        }

        mediaStreamRef.current = stream;
        setIsCameraActive(true);
        setCameraError(null);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch((playErr) => {
            console.warn('Video play error:', playErr);
          });

          // Detect torch capability
          const track = stream.getVideoTracks()[0];
          if (track) {
            const caps: any = track.getCapabilities ? track.getCapabilities() : {};
            setHasTorchCapability(Boolean(caps?.torch));

            const settings = track.getSettings?.();
            if (settings?.deviceId) {
              setSelectedDeviceId(settings.deviceId);
            }
          }
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
              ? 'Chrome блокирует доступ к камере во встроенном окне предпросмотра. Нажмите синюю кнопку «Открыть в отдельной вкладке» ниже.'
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
              ? 'Камера используется другим процессом. Закройте другие окна и нажмите кнопку повтора.'
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
   * Local Canvas Preprocessor:
   * Captures frames at 512x512 resolution, compressed to JPEG (0.65 quality)
   * Calculates average pixel luminance:
   * - Luminance < 25: "Too dark to see, proceed with caution."
   * - Lens covered: "Camera is covered."
   */
  const captureFrame = useCallback(() => {
    if (isAnalyzing || !canvasRef.current) return;

    if (isCameraActive && videoRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      // Rigid 512x512 resolution per spec
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, 512, 512);

      // Average pixel luminance calculation
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
          const totalPixels = sampleW * sampleH;

          for (let i = 0; i < imgData.length; i += 4) {
            totalBrightness += 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
          }

          const avgLuminance = totalBrightness / totalPixels;
          // Spec: < 25 luminance = dark; < 5 = camera covered
          const isLowLight = avgLuminance < 25;
          const isBlocked = avgLuminance < 6;
          onLuminanceChange?.(avgLuminance, isLowLight, isBlocked);
        }
      } catch {}

      // Compress to JPEG at 0.65 quality per spec
      const base64 = canvas.toDataURL('image/jpeg', 0.65);
      onCaptureFrame(base64);
    } else if (isDemoActive) {
      const canvas = canvasRef.current;
      const base64 = canvas.toDataURL('image/jpeg', 0.65);
      onCaptureFrame(base64);
    }
  }, [isAnalyzing, isCameraActive, isDemoActive, onCaptureFrame, onLuminanceChange]);

  // Demo simulation mode
  const startDemoSimulation = () => {
    stopCamera();
    setIsDemoActive(true);
    setCameraError(null);

    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 512;
    canvas.height = 512;

    const renderDemo = () => {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 512, 512);

        // Corridor perspective
        const grad = ctx.createLinearGradient(0, 256, 0, 512);
        grad.addColorStop(0, '#111827');
        grad.addColorStop(1, '#1f2937');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 256, 512, 256);

        // Walls
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(160, 256);
        ctx.lineTo(0, 512);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(512, 0);
        ctx.lineTo(352, 256);
        ctx.lineTo(512, 512);
        ctx.fill();

        // Door at 12 o'clock center
        ctx.fillStyle = '#334155';
        ctx.fillRect(216, 170, 80, 150);
        ctx.fillStyle = '#FFEE00';
        ctx.fillRect(285, 245, 6, 6);

        // Room sign
        ctx.fillStyle = '#FFEE00';
        ctx.fillRect(230, 140, 52, 18);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('ROOM 305', 234, 153);

        ctx.fillStyle = '#FFEE00';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('SIMULATION STREAM: 12 O\'CLOCK DOOR', 16, 30);
      }
      demoAnimationRef.current = requestAnimationFrame(renderDemo);
    };

    renderDemo();
    setTimeout(() => {
      const base64 = canvas.toDataURL('image/jpeg', 0.65);
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
          c.width = 512;
          c.height = 512;
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, 512, 512);
            onCaptureFrame(c.toDataURL('image/jpeg', 0.65));
          }
        };
        img.src = dataUri;
      }
    };
    reader.readAsDataURL(file);
  };

  // Auto-scan cycle every 1.5 seconds in passive mode
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

  // High-contrast bounding box overlays: GREEN for clear paths, RED for critical obstacles
  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
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

      // Red for critical obstacles (Tier 1), Amber for warning (Tier 2), Green for clear path/landmarks (Tier 3)
      const color =
        obj.hazardLevel === 1
          ? '#EF4444' // RED for critical obstacles
          : obj.hazardLevel === 2
          ? '#F59E0B' // AMBER for warning
          : '#10B981'; // GREEN for clear paths & safe landmarks

      ctx.lineWidth = 4;
      ctx.strokeStyle = color;
      ctx.strokeRect(x, y, width, height);

      const label = `${obj.label} · ${obj.clockDirection}h · ${obj.distance}`;
      ctx.font = 'bold 14px monospace';
      const textMetrics = ctx.measureText(label);
      const pad = 6;

      ctx.fillStyle = color;
      ctx.fillRect(x, Math.max(0, y - 24), textMetrics.width + pad * 2, 24);

      ctx.fillStyle = '#000000';
      ctx.fillText(label, x + pad, Math.max(16, y - 7));
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
              ? `CAMERA: ${facingMode === 'environment' ? 'REAR ENVIRONMENT' : 'FRONT / WEBCAM'}`
              : isDemoActive
              ? 'SIMULATION STREAM ACTIVE'
              : 'CAMERA READY'}
          </span>
        </div>

        {/* Live Analysis Status */}
        <div className="flex items-center gap-2 font-mono text-xs">
          {isAnalyzing ? (
            <span className="flex items-center gap-1.5 text-black bg-[#FFEE00] px-3 py-1 rounded-full font-extrabold uppercase">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ANALYZING
            </span>
          ) : isCameraActive || isDemoActive ? (
            <span className="text-[#FFEE00] font-bold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" />
              ONLINE (1.5s)
            </span>
          ) : (
            <span className="text-zinc-400 font-bold">READY</span>
          )}
        </div>
      </div>

      {/* Main Real Camera Viewport */}
      <div className="relative aspect-video sm:aspect-4/3 w-full bg-black flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
        />

        <canvas
          ref={canvasRef}
          className={isDemoActive ? 'w-full h-full object-cover block' : 'hidden'}
        />

        {/* Inactive Screen with Giant Buttons (min 64x64px touch target) */}
        {!isCameraActive && !isDemoActive && (
          <div className="flex flex-col items-center justify-center p-6 text-center text-white space-y-4 max-w-xl mx-auto">
            <div className="w-20 h-20 rounded-3xl bg-zinc-900 border-2 border-[#FFEE00] flex items-center justify-center text-[#FFEE00] mb-1 shadow-lg">
              <Camera className="w-10 h-10" />
            </div>

            <h2 className="text-lg font-extrabold text-[#FFEE00]">
              {cameraError ? cameraError.title : 'VisionAssist AI Ready'}
            </h2>

            <p className="text-xs text-zinc-300 leading-relaxed max-w-md">
              {cameraError
                ? cameraError.message
                : 'Tap "START CAMERA" below. In AI Studio preview iframes, use "OPEN IN STANDALONE TAB" for native 1-click camera access.'}
            </p>

            <div className="flex flex-wrap gap-3 justify-center pt-2">
              {/* Standalone Tab Button */}
              <a
                href={typeof window !== 'undefined' ? window.location.href : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold rounded-2xl text-xs uppercase tracking-wider transition shadow-lg active:scale-95 min-h-[64px] min-w-[64px]"
              >
                <ExternalLink className="w-5 h-5 stroke-[2.5]" />
                <span>Open in Standalone Tab</span>
              </a>

              {/* Start Camera Button (min 64x64px) */}
              <button
                onClick={() => startCamera(facingMode)}
                disabled={isStarting}
                className="flex items-center gap-2 px-7 py-4 bg-[#FFEE00] hover:bg-[#ffe600] disabled:opacity-50 text-black font-extrabold rounded-2xl text-xs uppercase tracking-wider transition shadow-lg shadow-[#FFEE00]/20 active:scale-95 min-h-[64px] min-w-[64px]"
              >
                {isStarting ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Video className="w-5 h-5 stroke-[2.5]" />
                )}
                <span>{isStarting ? 'CONNECTING...' : 'START CAMERA'}</span>
              </button>

              {/* Demo Stream Button (min 64x64px) */}
              <button
                onClick={startDemoSimulation}
                className="flex items-center gap-2 px-6 py-4 bg-zinc-800 hover:bg-zinc-700 text-[#FFEE00] border-2 border-[#FFEE00] font-extrabold rounded-2xl text-xs uppercase tracking-wider transition active:scale-95 min-h-[64px] min-w-[64px]"
              >
                <Play className="w-5 h-5 stroke-[2.5]" />
                <span>DEMO STREAM</span>
              </button>
            </div>
          </div>
        )}

        {/* Dynamic High-Contrast Bounding Box Overlay Canvas */}
        <canvas
          ref={overlayCanvasRef}
          width={512}
          height={512}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleNativeSnapshotUpload}
        />

        {/* Floating Warning Notice */}
        {cameraError && (isCameraActive || isDemoActive) && (
          <div className="absolute inset-x-4 top-4 p-4 bg-black/95 border-2 border-red-500 rounded-2xl text-xs text-white flex items-start gap-2.5 z-30 shadow-xl">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <div className="font-extrabold mb-0.5 text-red-400">{cameraError.title}</div>
              <div>{cameraError.message}</div>
            </div>
          </div>
        )}
      </div>

      {/* Control Deck Controls (All >= 64px min-height/width) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-black border-t border-[#FFEE00]/40 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Toggle Camera On/Off */}
          {isCameraActive || isDemoActive ? (
            <button
              onClick={stopCamera}
              className="flex items-center gap-2 px-5 py-3.5 bg-zinc-900 hover:bg-zinc-800 text-red-400 border-2 border-red-500/80 rounded-2xl font-extrabold transition min-h-[64px] min-w-[64px]"
            >
              <VideoOff className="w-5 h-5" />
              STOP
            </button>
          ) : (
            <button
              onClick={() => startCamera(facingMode)}
              className="flex items-center gap-2 px-5 py-3.5 bg-zinc-900 hover:bg-zinc-800 text-[#FFEE00] border-2 border-[#FFEE00] rounded-2xl font-extrabold transition min-h-[64px] min-w-[64px]"
            >
              <Video className="w-5 h-5" />
              START
            </button>
          )}

          {/* Switch Camera */}
          {isCameraActive && (
            <button
              onClick={switchFacingMode}
              title="Switch Camera (Rear / Front)"
              aria-label="Switch Camera (Rear / Front)"
              className="px-4 py-3.5 bg-zinc-900 hover:bg-zinc-800 text-[#FFEE00] border-2 border-[#FFEE00] rounded-2xl transition min-h-[64px] min-w-[64px] flex items-center justify-center"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          )}

          {/* Torch Button */}
          {hasTorchCapability && (
            <button
              onClick={() => onToggleTorch(!isTorchOn)}
              title="Flashlight / Torch"
              aria-label="Flashlight / Torch"
              className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl border-2 font-extrabold transition min-h-[64px] min-w-[64px] ${
                isTorchOn
                  ? 'bg-[#FFEE00] text-black border-[#FFEE00]'
                  : 'bg-zinc-900 text-[#FFEE00] border-[#FFEE00]'
              }`}
            >
              {isTorchOn ? <Flashlight className="w-5 h-5" /> : <FlashlightOff className="w-5 h-5" />}
              <span>{isTorchOn ? 'LIGHT ON' : 'TORCH'}</span>
            </button>
          )}

          {/* Native photo capture */}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Upload Photo / Snapshot"
            aria-label="Upload Photo or Take Native Snapshot"
            className="flex items-center gap-2 px-5 py-3.5 bg-zinc-900 hover:bg-zinc-800 text-white border-2 border-zinc-700 rounded-2xl font-bold transition min-h-[64px] min-w-[64px]"
          >
            <Upload className="w-5 h-5 text-[#FFEE00]" />
            <span>SNAPSHOT</span>
          </button>
        </div>

        {/* Immediate Frame Scan Trigger (Min 64x64px) */}
        <button
          onClick={captureFrame}
          disabled={isAnalyzing || (!isCameraActive && !isDemoActive)}
          aria-label="Scan Current Scene Now"
          className="flex items-center gap-2 px-6 py-3.5 bg-[#FFEE00] hover:bg-[#ffe600] disabled:opacity-40 text-black font-extrabold rounded-2xl shadow-lg shadow-[#FFEE00]/20 transition active:scale-95 text-xs uppercase tracking-wider min-h-[64px] min-w-[64px]"
        >
          <Camera className="w-5 h-5 stroke-[2.5]" />
          <span>SCAN NOW (SPACE)</span>
        </button>
      </div>
    </section>
  );
};
