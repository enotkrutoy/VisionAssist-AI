import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();

app.use(express.json({ limit: '25mb' }));

/* ==========================================================================
   1. GEMINI CLIENT INITIALIZER
   Supports:
   - process.env.GEMINI_API_KEY (Default server key in AI Studio & Vercel Env)
   - process.env.VITE_GEMINI_API_KEY (Client/Vercel backup)
   - Request-level custom apiKey (From user settings modal)
   ========================================================================== */

function getGeminiClient(customApiKey?: string): GoogleGenAI | null {
  const activeKey =
    (customApiKey && typeof customApiKey === 'string' && customApiKey.trim().length > 10)
      ? customApiKey.trim()
      : process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (!activeKey) {
    return null;
  }

  return new GoogleGenAI({
    apiKey: activeKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build-visionassist',
      },
    },
  });
}

/* ==========================================================================
   2. TTS TEXT SANITIZER & AUDIO FORMATTER
   Strict speech sanitizer: plain spoken words, no markdown, no asterisks,
   no bullet points, no conversational filler ("I see", "There is").
   ========================================================================== */

export function sanitizeForTts(raw: string, lang: 'en' | 'ru' = 'ru'): string {
  if (!raw) return '';

  let cleaned = raw
    .replace(/[#*_`~>|\\^]/g, '')
    .replace(/["'«»„“”\(\)\[\]\{\}]/g, ' ')
    .replace(/[—–-]/g, ' ')
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

  if (lang === 'ru') {
    cleaned = cleaned
      .replace(
        /^(я вижу|перед вами находится|перед вами|на изображении представлено|внимание я зафиксировал|внимание, я зафиксировал|я обнаружил)[,:\s]*/i,
        ''
      );
  } else {
    cleaned = cleaned
      .replace(
        /^(i see|in front of you is|there is|there are|attention i see|caution i detected|as an ai)[,:\s]*/i,
        ''
      );
  }

  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  if (cleaned && !/[.!?]$/.test(cleaned)) {
    cleaned += '.';
  }

  return cleaned;
}

/* ==========================================================================
   3. SYSTEM INSTRUCTIONS (RUSSIAN & ENGLISH)
   ========================================================================== */

const SYSTEM_INSTRUCTION_RU = `Ты — автономное интеллектуальное ядро пространственной ориентации и безопасности в системе Smart Real-Time Multimodal Assistance (VisionAssist AI) для незрячих и слабовидящих пользователей.

ПРИОРИТЕТ БЕЗОПАСНОСТИ:
Препятствия на уровне головы, груди и под ногами (ступени вниз, бордюры, люки), движущийся транспорт.

ТРЕБОВАНИЯ К TTS:
1. Только готовый русский текст в поле ttsMessage.
2. Без markdown, спецсимволов, звездочек, латиницы, скобок, кавычек и вводных фраз ("Я вижу", "Перед вами").

КООРДИНАТЫ ПО ЧАСАМ (относительно груди):
- 12 часов: прямо. 1-2 часа: впереди справа. 3 часа: справа. 9 часов: слева. 10-11 часов: впереди слева.
- Дистанция: в метрах или шагах ("один метр", "два шага").
- Вертикаль: "на уровне головы", "под ногами".

ИЕРАРХИЯ ОПАСНОСТЕЙ:
- Уровень 1 (Критический, <1.5м): от 2 до 5 слов ("Стоп, ступени вниз впереди.", "Стоп, столб на 12 часов.").
- Уровень 2 (Высокий, 2-4м): от 4 до 7 слов ("Пешеход на 1 час, держись левее.").
- Уровень 3 (Информационный): до 10-12 слов. Текст с префиксом "Текст:".`;

const SYSTEM_INSTRUCTION_EN = `You are the autonomous spatial intelligence and safety core for "Smart Real-Time Multimodal Assistance System (VisionAssist AI)" designed for visually impaired and blind users. Your task is real-time analysis of visual frames, object detection (bounding boxes), context, and distance estimation to generate concise spoken output directly forwarded to TTS.

FUNDAMENTAL RULE:
User safety precedes everything. Priority is given to head-level, chest-level, and ground drop-off hazards, elevation changes, stairs down, curbs, open holes, and moving vehicles.

STRICT TTS FORMAT REQUIREMENTS:
1. Output strictly plain spoken English in ttsMessage.
2. ZERO markdown (#, *, _, \`, >), NO bullet points, NO lists, NO brackets, NO quotes, NO emojis, NO conversational filler ("I see", "There is", "In front of you"). Jump straight to the point.
3. Natural, calm, authoritative tone.

SPATIAL CLOCK-FACE COORDINATES (relative to user's chest):
- 12 o'clock = Straight ahead.
- 1 to 2 o'clock = Ahead to the right.
- 3 o'clock = Directly right.
- 9 o'clock = Directly left.
- 10 to 11 o'clock = Ahead to the left.
- Distance estimation: "one meter", "two steps", "three meters".
- Vertical alerts: specify if hazard is at head level ("tree branch at head level") or ground level ("step down in two steps").

PRIORITY ALERT HIERARCHY & WORD LIMITS:
- TIER 1 - CRITICAL (Collision risk <1.5m, drop-offs, stairs down, open holes, moving vehicles, head hazard):
  * Reaction: Immediate command to halt or evade.
  * Word limit: 2 to 5 words.
- TIER 2 - WARNING (Obstacles 2-4m away, oncoming pedestrians, poles):
  * Word limit: 4 to 7 words.
- TIER 3 - INFORMATIONAL (Open walkways, doors, benches, room numbers):
  * Word limit: up to 10-12 words.
  * For text reading (OCR): prefix with "Text: [read text]".`;

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    ttsMessage: {
      type: Type.STRING,
      description: 'Clean spoken text without markdown, bullets, or asterisks',
    },
    hazardLevel: {
      type: Type.INTEGER,
      description: '0 = Clear/silent, 1 = Critical collision/drop-off, 2 = Warning, 3 = Informational',
    },
    hazardType: {
      type: Type.STRING,
      description:
        'STAIRS_DOWN, HEAD_OBSTACLE, VEHICLE, PEDESTRIAN, POLE, DOOR, BENCH, SIGN_TEXT, CURRENCY, FOUND_OBJECT, CAMERA_OCCLUDED, LOW_LIGHT, UNKNOWN_OBSTACLE, CLEAR',
    },
    clockDirection: {
      type: Type.STRING,
      description: '12, 1, 2, 3, 6, 9, 10, 11 or NONE',
    },
    distanceMeters: {
      type: Type.NUMBER,
      description: 'Distance estimate in meters',
    },
    distanceText: {
      type: Type.STRING,
      description: 'Distance spoken words (e.g. один метр / one meter)',
    },
    verticalZone: {
      type: Type.STRING,
      description: 'HEAD, CHEST, GROUND, GENERAL',
    },
    detectedValue: {
      type: Type.STRING,
      description: 'Key extracted value for OCR or specialized reader',
    },
    detectedObjects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          box2d: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: '[ymin, xmin, ymax, xmax] normalized 0-1000',
          },
          clockDirection: { type: Type.STRING },
          distance: { type: Type.STRING },
          hazardLevel: { type: Type.INTEGER },
        },
        required: ['label', 'box2d', 'clockDirection', 'distance', 'hazardLevel'],
      },
    },
    clipContext: {
      type: Type.STRING,
      description: 'Environmental context',
    },
    suggestedAction: {
      type: Type.STRING,
      description: 'STOP, SLOW_DOWN, STEP_LEFT, STEP_RIGHT, DUCK, CAUTION, CONTINUE',
    },
    shouldSpeak: {
      type: Type.BOOLEAN,
      description: 'Whether TTS should speak this frame now',
    },
  },
  required: [
    'ttsMessage',
    'hazardLevel',
    'hazardType',
    'clockDirection',
    'distanceMeters',
    'distanceText',
    'verticalZone',
    'clipContext',
    'suggestedAction',
    'shouldSpeak',
  ],
};

/* ==========================================================================
   4. DETERMINISTIC SAFETY FAIL-SAFES
   Guaranteed safety response when offline or before cloud model answers
   ========================================================================== */

function createSafetyFallback(
  sensors: any = {},
  userQuery: string = '',
  channel: string = 'EXPLORE',
  targetObject: string = '',
  lang: 'en' | 'ru' = 'ru'
) {
  const isRu = lang === 'ru';
  let fallback: any;

  if (sensors.isLensBlocked) {
    fallback = {
      ttsMessage: isRu ? 'Камера перекрыта, проверь объектив.' : 'Camera is covered.',
      hazardLevel: 1,
      hazardType: 'CAMERA_OCCLUDED',
      clockDirection: '12',
      distanceMeters: 0.1,
      distanceText: isRu ? 'вплотную' : 'immediate',
      verticalZone: 'GENERAL',
      clipContext: isRu ? 'Объектив перекрыт' : 'Camera covered',
      suggestedAction: 'CHECK_CAMERA',
      shouldSpeak: true,
      detectedObjects: [],
    };
  } else if (sensors.isLowLight) {
    fallback = {
      ttsMessage: isRu
        ? 'Недостаточно света для обзора, иди осторожно.'
        : 'Too dark to see, proceed with caution.',
      hazardLevel: 2,
      hazardType: 'LOW_LIGHT',
      clockDirection: '12',
      distanceMeters: 2.0,
      distanceText: isRu ? 'два метра' : 'two meters',
      verticalZone: 'GENERAL',
      clipContext: isRu ? 'Темное пространство' : 'Low light scene',
      suggestedAction: 'SLOW_DOWN',
      shouldSpeak: true,
      detectedObjects: [],
    };
  } else if (sensors.tiltZone === 'GROUND') {
    fallback = {
      ttsMessage: isRu
        ? 'Стоп, ступени вниз на 12 часов в одном метре.'
        : 'Stop, stairs down ahead.',
      hazardLevel: 1,
      hazardType: 'STAIRS_DOWN',
      clockDirection: '12',
      distanceMeters: 1.0,
      distanceText: isRu ? 'один метр' : 'one meter',
      verticalZone: 'GROUND',
      clipContext: isRu ? 'Ступени вниз' : 'Stairs down',
      suggestedAction: 'STOP',
      shouldSpeak: true,
      detectedObjects: [
        {
          label: isRu ? 'ступени вниз' : 'stairs down',
          confidence: 0.95,
          box2d: [600, 100, 950, 900],
          clockDirection: '12',
          distance: isRu ? 'один метр' : 'one meter',
          hazardLevel: 1,
        },
      ],
    };
  } else if (sensors.tiltZone === 'HEAD') {
    fallback = {
      ttsMessage: isRu
        ? 'Внимание, ветка на уровне головы, пригнись.'
        : 'Stop, branch at head level.',
      hazardLevel: 1,
      hazardType: 'HEAD_OBSTACLE',
      clockDirection: '12',
      distanceMeters: 1.5,
      distanceText: isRu ? 'полтора метра' : 'one meter',
      verticalZone: 'HEAD',
      clipContext: isRu ? 'Препятствие на уровне головы' : 'Head hazard',
      suggestedAction: 'DUCK',
      shouldSpeak: true,
      detectedObjects: [
        {
          label: isRu ? 'препятствие' : 'hazard',
          confidence: 0.92,
          box2d: [200, 150, 450, 850],
          clockDirection: '12',
          distance: isRu ? 'полтора метра' : 'one meter',
          hazardLevel: 1,
        },
      ],
    };
  } else {
    fallback = {
      ttsMessage: isRu
        ? 'Впереди препятствие неизвестного типа, притормози.'
        : 'Unclear obstacle ahead, slow down.',
      hazardLevel: 2,
      hazardType: 'UNKNOWN_OBSTACLE',
      clockDirection: '12',
      distanceMeters: 2.5,
      distanceText: isRu ? 'два метра' : 'two meters',
      verticalZone: 'GENERAL',
      clipContext: isRu ? 'Окружающее пространство' : 'Environment',
      suggestedAction: 'SLOW_DOWN',
      shouldSpeak: true,
      detectedObjects: [],
    };
  }

  fallback.ttsMessage = sanitizeForTts(fallback.ttsMessage, lang);
  return fallback;
}

/* ==========================================================================
   5. MULTI-MODEL INFERENCE CASCADE
   ========================================================================== */

const CANDIDATE_MODELS = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];

async function executeGeminiWithRetry(
  aiClient: GoogleGenAI,
  contents: any,
  promptParts: string,
  lang: 'en' | 'ru' = 'ru'
): Promise<any> {
  let lastErr: any = null;
  const sysInst = lang === 'ru' ? SYSTEM_INSTRUCTION_RU : SYSTEM_INSTRUCTION_EN;

  for (const model of CANDIDATE_MODELS) {
    try {
      const response = await aiClient.models.generateContent({
        model,
        contents: {
          parts: [contents, { text: promptParts }],
        },
        config: {
          systemInstruction: sysInst,
          responseMimeType: 'application/json',
          responseSchema: ANALYSIS_SCHEMA,
          temperature: 0.1,
        },
      });

      const text = response.text?.trim() || '{}';
      return JSON.parse(text);
    } catch (err: any) {
      lastErr = err;
      const errMsg = err?.message || String(err);
      if (
        errMsg.includes('503') ||
        errMsg.includes('high demand') ||
        errMsg.includes('429') ||
        errMsg.includes('UNAVAILABLE')
      ) {
        console.warn(`[VisionAssist AI] Model ${model} busy/unavailable, trying next...`);
        await new Promise((r) => setTimeout(r, 350));
        continue;
      }
      break;
    }
  }

  throw lastErr || new Error('All candidate models unavailable');
}

/* ==========================================================================
   6. API ROUTES (COMPATIBLE WITH VERCEL SERVERLESS & EXPRESS SERVER)
   Supports both '/api/*' and '/*' to guarantee 100% routing success on Vercel
   ========================================================================== */

app.post(['/api/analyze', '/analyze'], async (req: Request, res: Response) => {
  const lang: 'en' | 'ru' = req.body.lang === 'en' ? 'en' : 'ru';

  try {
    const {
      imageBase64,
      mimeType = 'image/jpeg',
      mode = 'PASSIVE',
      channel = 'EXPLORE',
      targetObject = '',
      userQuery = '',
      sensors = {},
      lastSpokenText = '',
      apiKey = '',
    } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 in request' });
    }

    const aiClient = getGeminiClient(apiKey);
    if (!aiClient) {
      console.warn('[VisionAssist AI] No Gemini API Key found in env or request. Using safety fallback.');
      const fallback = createSafetyFallback(sensors, userQuery, channel, targetObject, lang);
      return res.json({
        success: true,
        analysis: fallback,
        timestamp: Date.now(),
        fallbackEngaged: true,
        note: 'Using offline safety core. Add GEMINI_API_KEY to Vercel env or in settings for cloud vision.',
      });
    }

    let cleanBase64 = imageBase64;
    let actualMime = mimeType;
    const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      actualMime = match[1];
      cleanBase64 = match[2];
    } else {
      cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
    }

    const isRu = lang === 'ru';
    let channelInstruction = '';
    if (channel === 'TEXT_OCR') {
      channelInstruction = isRu
        ? 'СПЕЦ-КАНАЛ [ТЕКСТ / OCR]: Распознай текст на вывеске, табличке или ценнике. Префикс "Текст: [содержание]".'
        : 'SPECIAL CHANNEL [TEXT / OCR]: Read signs, price tags, or room numbers clearly prefixed with "Text: [read text]".';
    } else if (channel === 'CURRENCY') {
      channelInstruction = isRu
        ? 'СПЕЦ-КАНАЛ [КУПЮРЫ]: Определи номинал и валюту банкнот или монет в кадре.'
        : 'SPECIAL CHANNEL [CURRENCY]: Identify banknote or coin denomination and currency accurately.';
    } else if (channel === 'FIND_OBJECT') {
      const target = targetObject || userQuery || (isRu ? 'дверь' : 'door');
      channelInstruction = isRu
        ? `СПЕЦ-КАНАЛ [ПОИСК]: Ищи объект "${target}". Сообщи часы и дистанцию, или "Объект не найден".`
        : `SPECIAL CHANNEL [FIND OBJECT]: Locate target "${target}". Report clock position and distance, or "Target not found".`;
    }

    const promptParts = [
      `OPERATIONAL MODE: ${mode}`,
      channelInstruction,
      sensors.tiltZone
        ? `DEVICE TILT: ${
            sensors.tiltZone === 'GROUND'
              ? 'Tilted down at ground / floor'
              : sensors.tiltZone === 'HEAD'
              ? 'Tilted up toward head level'
              : 'Facing straight ahead'
          }`
        : '',
      sensors.isLowLight ? 'SENSOR ALERT: Low light level (<25 luminance)' : '',
      sensors.isLensBlocked ? 'SENSOR ALERT: Camera lens is covered / obstructed' : '',
      lastSpokenText
        ? `PREVIOUS ANNOUNCEMENT: "${lastSpokenText}" (Do not repeat static obstacles).`
        : '',
      userQuery
        ? `USER SPOKEN QUERY: "${userQuery}". Answer concisely in under 15 words adhering to safety rules.`
        : 'Analyze frame for Tier 1-3 hazards, calculate 12-hour clock directions, and output concise TTS intelligence.',
    ]
      .filter(Boolean)
      .join('\n');

    const imagePayload = {
      inlineData: {
        data: cleanBase64,
        mimeType: actualMime,
      },
    };

    const parsed = await executeGeminiWithRetry(aiClient, imagePayload, promptParts, lang);

    if (parsed.ttsMessage) {
      parsed.ttsMessage = sanitizeForTts(parsed.ttsMessage, lang);
    }

    res.json({
      success: true,
      analysis: parsed,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.warn('[VisionAssist AI] Cloud model call error, engaging safety fallback:', error?.message);
    const fallback = createSafetyFallback(
      req.body.sensors,
      req.body.userQuery,
      req.body.channel,
      req.body.targetObject,
      lang
    );
    res.json({
      success: true,
      analysis: fallback,
      timestamp: Date.now(),
      fallbackEngaged: true,
    });
  }
});

app.post(['/api/tts', '/tts'], async (req: Request, res: Response) => {
  const lang: 'en' | 'ru' = req.body.lang === 'en' ? 'en' : 'ru';
  try {
    const { text, apiKey = '' } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required for TTS' });
    }

    const sanitized = sanitizeForTts(text, lang);
    const aiClient = getGeminiClient(apiKey);

    if (!aiClient) {
      return res.json({
        success: false,
        audioBase64: null,
        fallbackToClient: true,
        sanitizedText: sanitized,
      });
    }

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: sanitized,
              speechMetadata: {
                style: 'Calm, clear, direct, focused assistant for visually impaired',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const audioBase64 =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;

    res.json({
      success: true,
      audioBase64,
      sanitizedText: sanitized,
    });
  } catch (error: any) {
    res.json({
      success: false,
      audioBase64: null,
      fallbackToClient: true,
      message: error?.message || 'TTS fallback to Web Speech API',
    });
  }
});

app.get(['/api/health', '/health', '/api'], (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'VisionAssist AI',
    serverType: process.env.VERCEL ? 'Vercel Serverless Function' : 'Express Server',
    hasServerKey: Boolean(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY),
    time: new Date().toISOString(),
  });
});

export default app;
