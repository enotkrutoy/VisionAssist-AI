import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();

app.use(express.json({ limit: '30mb' }));

/* ==========================================================================
   1. GEMINI CLIENT INITIALIZER & KEY VALIDATOR
   Supports:
   - Request-level custom apiKey (highest priority: user settings in browser)
   - process.env.GEMINI_API_KEY (Vercel / server env)
   - process.env.VITE_GEMINI_API_KEY (backup)
   ========================================================================== */

function getGeminiClient(customApiKey?: string): GoogleGenAI | null {
  const activeKey =
    (customApiKey && typeof customApiKey === 'string' && customApiKey.trim().length > 15)
      ? customApiKey.trim()
      : process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (
    !activeKey ||
    activeKey.length < 20 ||
    activeKey.includes('YOUR_') ||
    activeKey.includes('PLACEHOLDER') ||
    activeKey.includes('TODO')
  ) {
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
   2. TTS TEXT SANITIZER & SPATIAL NORMALIZERS
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
        /^(я вижу|перед вами находится|перед вами|на изображении представлено|внимание я зафиксировал|внимание, я зафиксировал|я обнаружил|на фото)[,:\s]*/i,
        ''
      );
  } else {
    cleaned = cleaned
      .replace(
        /^(i see|in front of you is|there is|there are|attention i see|caution i detected|as an ai|in the image)[,:\s]*/i,
        ''
      );
  }

  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  if (cleaned && !/[.!?]$/.test(cleaned)) {
    cleaned += '.';
  }

  return cleaned;
}

export function normalizeClock(val: string | number | undefined): string {
  if (!val) return '12';
  const str = String(val).trim();
  const match = str.match(/\b(1[0-2]|[1-9])\b/);
  return match ? match[1] : '12';
}

export function normalizeBox(box: any): [number, number, number, number] {
  if (!Array.isArray(box) || box.length !== 4) return [0, 0, 0, 0];
  let [ymin, xmin, ymax, xmax] = box.map(Number);
  if (isNaN(ymin)) ymin = 0;
  if (isNaN(xmin)) xmin = 0;
  if (isNaN(ymax)) ymax = 0;
  if (isNaN(xmax)) xmax = 0;

  // Handle 0.0 - 1.0 normalization fallback
  if (ymax <= 1.05 && xmax <= 1.05 && (ymin > 0 || xmin > 0 || ymax > 0 || xmax > 0)) {
    ymin = Math.round(ymin * 1000);
    xmin = Math.round(xmin * 1000);
    ymax = Math.round(ymax * 1000);
    xmax = Math.round(xmax * 1000);
  }

  return [
    Math.max(0, Math.min(1000, Math.round(ymin))),
    Math.max(0, Math.min(1000, Math.round(xmin))),
    Math.max(0, Math.min(1000, Math.round(ymax))),
    Math.max(0, Math.min(1000, Math.round(xmax))),
  ];
}

/* ==========================================================================
   3. HIGH-PRECISION SPATIAL VISION SYSTEM INSTRUCTIONS
   ========================================================================== */

const SYSTEM_INSTRUCTION_RU = `Ты — высокоточное ядро компьютерного зрения и пространственной навигации VisionAssist AI для незрячих и слабовидящих пользователей. Твоя главная задача — обнаружить ВСЕ реальные объекты и людей в видеокадре (веб-камера или камера смартфона).

ПРИОРИТЕТЫ РАСПОЗНАВАНИЯ:
1. ЛЮДИ И ПОЛЬЗОВАТЕЛЬ В КАДРЕ:
   - Если в кадре виден человек, лицо, торс, фигура (пользователь перед веб-камерой или человек в комнате) — ОБЯЗАТЕЛЬНО добавь объект с label: "человек" в массив detectedObjects с точной рамкой box2d [ymin, xmin, ymax, xmax]!
   - Часы: если человек по центру — clockDirection: "12". Если левее центра — "10" или "11". Если правее — "1" или "2".
   - Дистанция: крупный план (лицо, плечи) — "один метр" (1.0 м). Средний план — "полтора-два метра".
2. ДВЕРИ И ПРОЕМЫ:
   - Дверь, дверной косяк, дверная ручка (например, дверь слева на 10 часов) — ОБЯЗАТЕЛЬНО внеси в detectedObjects с меткой "дверь".
3. МЕБЕЛЬ И ПРЕДМЕТЫ:
   - Кровать, стул, кресло, стол, шкаф, диван, подушка, одеяло, стены, окно, ноутбук, монитор, телефон, чашка, ключи.
4. ЧАСОВАЯ СИСТЕМА (по центру xmin/xmax):
   - 0..150: "9" (слева)
   - 150..350: "10" или "11" (впереди слева)
   - 350..650: "12" (прямо перед камерой)
   - 650..850: "1" или "2" (впереди справа)
   - 850..1000: "3" (справа)
5. ТРЕБОВАНИЯ К TTS:
   - ttsMessage: краткое и четкое русское описание того, что перед камерой. Например: "Человек на 12 часов в одном метре. Дверь на 10 часов."
   - Никакого markdown, звездочек и вводных слов. Сразу суть.`;

const SYSTEM_INSTRUCTION_EN = `You are the high-accuracy computer vision and spatial intelligence core for VisionAssist AI designed for visually impaired and blind users. Your task is real-time detection of all physical objects, people, and landmarks in the video frame.

DETECTION PRINCIPLES:
1. DETECT PEOPLE & FOREGROUND USERS:
   - If a person, face, or torso is visible (e.g. user sitting at webcam or pedestrian) — ALWAYS add an object with label: "person" to detectedObjects with accurate box2d [ymin, xmin, ymax, xmax]!
   - Center x -> 12 o'clock. Close-up -> 1.0 meter.
2. DOORS, EXITS & FURNITURE:
   - Doors (e.g. door at 10 o'clock), door frames, handles -> add to detectedObjects.
   - Beds, chairs, desks, walls, screens, keys.
3. 12-HOUR CLOCK COORDINATES:
   - 0..150 -> 9 o'clock; 150..350 -> 10-11 o'clock; 350..650 -> 12 o'clock; 650..850 -> 1-2 o'clock; 850..1000 -> 3 o'clock.
4. TTS OUTPUT:
   - Direct spoken summary: e.g. "Person at 12 o'clock at one meter. Door at 10 o'clock."
   - No markdown, no filler.`;

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    ttsMessage: {
      type: Type.STRING,
      description: 'Clean spoken text without markdown, bullets, or asterisks',
    },
    hazardLevel: {
      type: Type.INTEGER,
      description: '0 = Clear/silent, 1 = Critical collision/drop-off, 2 = Warning, 3 = Informational/Landmark',
    },
    hazardType: {
      type: Type.STRING,
      description:
        'PERSON, DOOR, CHAIR, BED, TABLE, STAIRS_DOWN, HEAD_OBSTACLE, VEHICLE, POLE, SIGN_TEXT, CURRENCY, FOUND_OBJECT, CLEAR',
    },
    clockDirection: {
      type: Type.STRING,
      description: '12, 1, 2, 3, 6, 9, 10, 11 or NONE',
    },
    distanceMeters: {
      type: Type.NUMBER,
      description: 'Distance estimate in meters (e.g. 1.0)',
    },
    distanceText: {
      type: Type.STRING,
      description: 'Distance spoken words in target language (e.g. один метр / one meter)',
    },
    verticalZone: {
      type: Type.STRING,
      description: 'HEAD, CHEST, GROUND, GENERAL',
    },
    detectedValue: {
      type: Type.STRING,
      description: 'Extracted text for OCR or currency denomination',
    },
    detectedObjects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING, description: 'Clear name of detected item (человек, дверь, кровать, стул)' },
          confidence: { type: Type.NUMBER },
          box2d: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: '[ymin, xmin, ymax, xmax] normalized 0-1000',
          },
          clockDirection: { type: Type.STRING, description: '12, 1, 2, 3, 9, 10, 11' },
          distance: { type: Type.STRING, description: 'Human distance e.g. один метр' },
          hazardLevel: { type: Type.INTEGER, description: '1 = red critical, 2 = amber warning, 3 = safe landmark' },
        },
        required: ['label', 'box2d', 'clockDirection', 'distance', 'hazardLevel'],
      },
    },
    clipContext: {
      type: Type.STRING,
      description: 'Brief 2-3 word description of environment (e.g. Комната, Спальня, Офис)',
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
    'detectedObjects',
  ],
};

/* ==========================================================================
   4. DETERMINISTIC SAFETY FAIL-SAFES
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
      shouldSpeak: false,
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
      detectedObjects: [],
    };
  } else {
    fallback = {
      ttsMessage: isRu ? 'Путь свободен.' : 'Path clear.',
      hazardLevel: 0,
      hazardType: 'CLEAR',
      clockDirection: '12',
      distanceMeters: 0,
      distanceText: isRu ? 'чисто' : 'clear',
      verticalZone: 'GENERAL',
      clipContext: isRu ? 'Окружающее пространство' : 'Environment',
      suggestedAction: 'CONTINUE',
      shouldSpeak: false,
      detectedObjects: [],
    };
  }

  fallback.ttsMessage = sanitizeForTts(fallback.ttsMessage, lang);
  return fallback;
}

/* ==========================================================================
   5. MULTI-MODEL INFERENCE CASCADE (LITE FIRST)
   ========================================================================== */

const CANDIDATE_MODELS = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];

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

      // If key is invalid or unauthorized, don't waste time retrying other models with the same broken key
      if (
        errMsg.includes('API key not valid') ||
        errMsg.includes('API_KEY_INVALID') ||
        errMsg.includes('PERMISSION_DENIED')
      ) {
        throw err;
      }

      if (
        errMsg.includes('503') ||
        errMsg.includes('high demand') ||
        errMsg.includes('429') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('RESOURCE_EXHAUSTED')
      ) {
        console.warn(`[VisionAssist AI] Model ${model} busy (${errMsg.slice(0, 50)}), cascading...`);
        continue;
      }
      break;
    }
  }

  throw lastErr || new Error('All candidate models unavailable');
}

/* ==========================================================================
   6. API CONTROLLERS
   ========================================================================== */

async function handleAnalyze(req: Request, res: Response) {
  const lang: 'en' | 'ru' = req.body.lang === 'en' ? 'en' : 'ru';
  const isRu = lang === 'ru';

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
      // Key missing or placeholder: Inform clearly without fake "all clear"
      return res.json({
        success: true,
        hasKey: false,
        analysis: {
          ttsMessage: isRu
            ? 'Укажите ключ Gemini API в настройках для включения распознавания.'
            : 'Enter Gemini API key in settings to enable real-time vision.',
          hazardLevel: 2,
          hazardType: 'READY_AWAITING_KEY',
          clockDirection: '12',
          distanceMeters: 0,
          distanceText: isRu ? 'требуется ключ' : 'key required',
          verticalZone: 'GENERAL',
          clipContext: isRu ? 'Ожидание API ключа' : 'Awaiting API Key',
          suggestedAction: 'CHECK_CAMERA',
          shouldSpeak: false,
          detectedObjects: [],
        },
        timestamp: Date.now(),
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

    let channelInstruction = '';
    if (channel === 'TEXT_OCR') {
      channelInstruction = isRu
        ? `СПЕЦИАЛЬНЫЙ КАНАЛ [БЫСТРЫЙ ТЕКСТ / OCR]: Распознай любой текст на вывесках, табличках, дверях, экранах, бумаге или ценниках. Помести текст в detectedValue и ttsMessage с префиксом "Текст:".`
        : `SPECIAL CHANNEL [TEXT OCR]: Read visible signs, numbers, product labels. Set detectedValue and ttsMessage: "Text: [read text]".`;
    } else if (channel === 'CURRENCY') {
      channelInstruction = isRu
        ? `СПЕЦИАЛЬНЫЙ КАНАЛ [КУПЮРЫ И ДЕНЬГИ]: Определи номинал и валюту банкнот или монет. Помести в detectedValue и ttsMessage: "Купюра [номинал]".`
        : `SPECIAL CHANNEL [CURRENCY]: Identify banknote or coin denomination. Set detectedValue and ttsMessage: "Banknote [value]".`;
    } else if (channel === 'FIND_OBJECT') {
      const target = targetObject || userQuery || (isRu ? 'дверь' : 'door');
      channelInstruction = isRu
        ? `СПЕЦИАЛЬНЫЙ КАНАЛ [ПОИСК ЦЕЛИ: "${target}"]: Найди объект "${target}". Если найден — сообщи часы и дистанцию. Если не найден — сообщи, что объект не виден.`
        : `SPECIAL CHANNEL [FIND OBJECT: "${target}"]: Locate "${target}". Report clock direction and distance.`;
    } else {
      channelInstruction = isRu
        ? `РЕЖИМ ОБНАРУЖЕНИЯ: Найди человека, лицо, двери, мебель, проходы и предметы. Добавь ВСЕ видимые объекты в detectedObjects!`
        : `EXPLORE MODE: Detect people, faces, doors, furniture, and surroundings. Populate detectedObjects.`;
    }

    const promptParts = [
      `OPERATIONAL MODE: ${mode}`,
      channelInstruction,
      sensors.tiltZone ? `DEVICE TILT SENSOR: ${sensors.tiltZone}` : '',
      sensors.isLowLight ? 'SENSOR ALERT: Low light scene (<25 lux)' : '',
      sensors.isLensBlocked ? 'SENSOR ALERT: Camera lens is occluded' : '',
      lastSpokenText ? `PREVIOUS ANNOUNCEMENT: "${lastSpokenText}"` : '',
      userQuery
        ? `USER SPOKEN QUERY: "${userQuery}". Answer directly and concisely.`
        : 'Perform comprehensive object and person detection, estimate distances, and output spatial clock coordinates.',
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

    // Normalize coordinates & values
    parsed.clockDirection = normalizeClock(parsed.clockDirection);
    parsed.distanceMeters = Number(parsed.distanceMeters) || 0;
    parsed.hazardLevel = Number(parsed.hazardLevel) || 0;

    if (parsed.detectedObjects && Array.isArray(parsed.detectedObjects)) {
      parsed.detectedObjects = parsed.detectedObjects.map((obj: any) => ({
        label: String(obj.label || 'объект'),
        confidence: Number(obj.confidence) || 0.9,
        box2d: normalizeBox(obj.box2d),
        clockDirection: normalizeClock(obj.clockDirection),
        distance: String(obj.distance || 'один метр'),
        hazardLevel: Number(obj.hazardLevel) || 3,
      }));
    } else {
      parsed.detectedObjects = [];
    }

    res.json({
      success: true,
      hasKey: true,
      analysis: parsed,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    console.warn('[VisionAssist AI] Inference error:', errorMsg);

    const isKeyError =
      errorMsg.includes('API key not valid') ||
      errorMsg.includes('API_KEY_INVALID') ||
      errorMsg.includes('400') ||
      errorMsg.includes('401') ||
      errorMsg.includes('PERMISSION_DENIED');

    const isQuotaError =
      errorMsg.includes('429') ||
      errorMsg.includes('RESOURCE_EXHAUSTED') ||
      errorMsg.includes('quota');

    let ttsMessage = isRu ? 'Путь свободен.' : 'Path clear.';
    let hazardType = 'CLEAR';

    if (isKeyError) {
      ttsMessage = isRu
        ? 'Ошибка ключа Gemini API. Укажите действующий ключ в настройках.'
        : 'Invalid Gemini API key. Please check key in settings.';
      hazardType = 'API_KEY_ERROR';
    } else if (isQuotaError) {
      ttsMessage = isRu
        ? 'Превышен лимит запросов Gemini API. Укажите персональный ключ в настройках.'
        : 'Gemini API quota exceeded. Enter your personal key in settings.';
      hazardType = 'QUOTA_ERROR';
    }

    res.json({
      success: true,
      hasKey: !isKeyError,
      analysis: {
        ttsMessage,
        hazardLevel: isKeyError || isQuotaError ? 2 : 0,
        hazardType,
        clockDirection: '12',
        distanceMeters: 0,
        distanceText: isKeyError ? (isRu ? 'ошибка ключа' : 'key error') : (isRu ? 'чисто' : 'clear'),
        verticalZone: 'GENERAL',
        clipContext: isKeyError ? 'Требуется API ключ' : 'Окружающее пространство',
        suggestedAction: isKeyError || isQuotaError ? 'CHECK_CAMERA' : 'CONTINUE',
        shouldSpeak: isKeyError || isQuotaError,
        detectedObjects: [],
      },
      timestamp: Date.now(),
      fallbackEngaged: true,
      debugError: errorMsg,
    });
  }
}

async function handleTts(req: Request, res: Response) {
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
}

function handleHealth(_req: Request, res: Response) {
  const serverKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  const hasValidServerKey = Boolean(
    serverKey &&
    serverKey.length > 20 &&
    !serverKey.includes('YOUR_') &&
    !serverKey.includes('PLACEHOLDER')
  );

  res.json({
    status: 'ok',
    app: 'VisionAssist AI',
    serverType: process.env.VERCEL ? 'Vercel Serverless Function' : 'Express Server',
    hasServerKey: hasValidServerKey,
    time: new Date().toISOString(),
  });
}

/* ==========================================================================
   7. UNIVERSAL ROUTE MOUNTING (VERCEL REWRITE SAFE)
   ========================================================================== */

app.post(['/api/analyze', '/analyze'], handleAnalyze);
app.post(['/api/tts', '/tts'], handleTts);
app.get(['/api/health', '/health', '/api'], handleHealth);

app.use((req: Request, res: Response, next: any) => {
  if (req.method === 'POST' && req.url.includes('analyze')) {
    return handleAnalyze(req, res);
  }
  if (req.method === 'POST' && req.url.includes('tts')) {
    return handleTts(req, res);
  }
  if (req.method === 'GET' && (req.url.includes('health') || req.url === '/' || req.url === '/api')) {
    return handleHealth(req, res);
  }
  next();
});

export default app;
