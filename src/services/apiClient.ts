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

let isRequestInProgress = false;

export async function analyzeScene(payload: AnalyzePayload): Promise<{ analysis: SpatialAnalysis; hasKey?: boolean }> {
  // Concurrency guard: Do not interrupt an in-flight analysis, let it complete
  if (isRequestInProgress) {
    throw new Error('Analysis in progress');
  }

  isRequestInProgress = true;
  const controller = new AbortController();

  // 15-second safety timeout
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 15000);

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
    throw err;
  } finally {
    isRequestInProgress = false;
  }
}
