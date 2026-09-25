import { SpatialAnalysis, DeviceSensorState, AssistiveChannel, OperatingMode } from '../types/assistant';

export interface AnalyzePayload {
  imageBase64: string;
  mimeType?: string;
  mode: OperatingMode;
  channel?: AssistiveChannel;
  targetObject?: string;
  userQuery?: string;
  sensors?: Partial<DeviceSensorState>;
  lastSpokenText?: string;
  apiKey?: string;
  lang?: 'en' | 'ru';
}

export interface AnalyzeResponse {
  success: boolean;
  hasKey?: boolean;
  analysis: SpatialAnalysis;
  timestamp: number;
  fallbackEngaged?: boolean;
  note?: string;
}

let activeAbortController: AbortController | null = null;

export async function analyzeScene(payload: AnalyzePayload): Promise<{ analysis: SpatialAnalysis; hasKey?: boolean }> {
  // Abort previous frame request to prevent race conditions & lag
  if (activeAbortController) {
    try {
      activeAbortController.abort();
    } catch {
      // ignore
    }
  }

  const controller = new AbortController();
  activeAbortController = controller;

  // 12-second safety timeout
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 12000);

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Server error' }));
      throw new Error(errorData.error || `HTTP ${response.status}: Analysis failed`);
    }

    const data: AnalyzeResponse = await response.json();
    return {
      analysis: data.analysis,
      hasKey: data.hasKey !== false,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Request superseded by newer frame');
    }
    throw err;
  } finally {
    if (activeAbortController === controller) {
      activeAbortController = null;
    }
  }
}
