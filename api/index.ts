import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const app = express();

app.use(express.json({ limit: '30mb' }));

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

/* ==========================================================================
   3. ADVANCED COMPUTER VISION SYSTEM INSTRUCTIONS
   ========================================================================== */

const SYSTEM_INSTRUCTION_RU = `Ты — ведущее высокоточное ядро компьютерного зрения и пространственной навигации VisionAssist AI для незрячих и слабовидящих пользователей. Твоя задача — мгновенный детальный анализ реального видеокадра с камеры устройства.

ОСНОВНЫЕ ПРАВИЛА РАСПОЗНАВАНИЯ:
1. НАХОДИ РЕАЛЬНЫЕ ОБЪЕКТЫ: Стулья, столы, двери, дверные ручки, людей, ступени, бордюры, стены, полки, компьютеры, телефоны, ключи, чашки, надписи, текст, препятствия. Обязательно добавляй каждый видимый ключевой объект в массив detectedObjects с координатами box2d [ymin, xmin, ymax, xmax] от 0 до 1000!
2. ЧАСОВАЯ СИСТЕМА КООРДИНАТ (по горизонтальному центру xmin/xmax):
   - 0..150: "9" (строго слева)
   - 150..350: "10" или "11" (впереди слева)
   - 350..650: "12" (прямо перед пользователем)
   - 650..850: "1" или "2" (впереди справа)
   - 850..1000: "3" (строго справа)
3. ОЦЕНКА ДИСТАНЦИИ И ГЛУБИНЫ:
   - Крупный объект (занимает больше половины высоты кадра или основание ymax > 850): "полметра" / "один метр" / "один шаг" (0.5 - 1.2 м)
   - Средний объект (занимает 25-50% кадра): "полтора метра" / "два метра" / "два-три шага" (1.5 - 2.5 м)
   - Удаленный объект (меньше 20% кадра): "три метра" / "четыре метра" (3 - 5 м)
4. ВЕРТИКАЛЬНАЯ ЗОНА:
   - Верхняя треть (ymin < 300 и центр y < 400): "HEAD" (на уровне головы / нависающие ветки, косяк)
   - Средняя зона: "CHEST" (на уровне груди / ручки, стол, человек)
   - Нижняя треть (ymax > 700): "GROUND" (под ногами / ступени, порог, яма, пол)
5. ТРЕБОВАНИЯ К TTS ОПОВЕЩЕНИЮ (ttsMessage):
   - Исключительно естественный русский текст без разметки, звездочек и кавычек.
   - Сразу суть без вводных слов.
   - Уровень 1 (Опасность столкновения <1.5м, ступени вниз, голова): "Стоп, [объект] на [часы] в [дистанция]." (2-5 слов)
   - Уровень 2 (Предупреждение 1.5-3м): "[Объект] на [часы], обход [направление]." (4-7 слов)
   - Уровень 3 (Ориентиры/Навигация): "[Объект] на [часы] в [дистанция]." (до 10 слов)
   - Если путь полностью свободен: ttsMessage = "Путь свободен.", hazardLevel = 0, shouldSpeak = false.`;

const SYSTEM_INSTRUCTION_EN = `You are the world-class real-time computer vision and spatial intelligence core for VisionAssist AI designed for visually impaired and blind users. Your task is high-accuracy object detection, spatial clock positioning, depth estimation, and natural spoken output.

DETECTION PRINCIPLES:
1. DETECT REAL PHYSICAL OBJECTS: Chairs, tables, doors, door handles, people, stairs (up/down), curbs, walls, laptops, keys, mugs, signs, obstacles. Always populate detectedObjects with accurate box2d [ymin, xmin, ymax, xmax] (0-1000 scale).
2. 12-HOUR CLOCK COORDINATES (from horizontal center xmin/xmax):
   - 0..150: "9" (directly left)
   - 150..350: "10" or "11" (ahead to left)
   - 350..650: "12" (straight ahead)
   - 650..850: "1" or "2" (ahead to right)
   - 850..1000: "3" (directly right)
3. DISTANCE ESTIMATION:
   - Large bounding box (occupies >50% frame or base ymax > 850): "one meter" / "half meter" / "one step" (0.5 - 1.2m)
   - Medium bounding box: "two meters" / "three steps" (1.5 - 2.5m)
   - Small bounding box: "three to four meters" (3 - 5m)
4. VERTICAL ZONES:
   - Upper third: "HEAD" (head level hazard)
   - Middle: "CHEST" (body level)
   - Lower: "GROUND" (ground / floor / stairs down)
5. TTS OUTPUT (ttsMessage):
   - Direct, authoritative, no markdown, no asterisks, no filler.
   - Tier 1 (<1.5m risk): "Stop, [hazard] at [clock] in [distance]."
   - Tier 2 (1.5-3m): "[Obstacle] at [clock], pass [direction]."
   - Tier 3 (Clear/safe landmarks): "[Object] at [clock] in [distance]."
   - Path Clear: ttsMessage = "Path clear.", hazardLevel = 0, shouldSpeak = false.`;

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
        'STAIRS_DOWN, STAIRS_UP, HEAD_OBSTACLE, VEHICLE, PEDESTRIAN, POLE, DOOR, BENCH, CHAIR, TABLE, SIGN_TEXT, CURRENCY, FOUND_OBJECT, CAMERA_OCCLUDED, LOW_LIGHT, UNKNOWN_OBSTACLE, CLEAR',
    },
    clockDirection: {
      type: Type.STRING,
      description: '12, 1, 2, 3, 6, 9, 10, 11 or NONE',
    },
    distanceMeters: {
      type: Type.NUMBER,
      description: 'Distance estimate in meters (e.g. 1.2)',
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
      description: 'Extracted text for OCR or currency denomination (e.g. "Кабинет 305" or "1000 рублей")',
    },
    detectedObjects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING, description: 'Clear name of detected item in target language' },
          confidence: { type: Type.NUMBER },
          box2d: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER },
            description: '[ymin, xmin, ymax, xmax] normalized 0-1000',
          },
          clockDirection: { type: Type.STRING, description: '12, 1, 2, 3, 9, 10, 11' },
          distance: { type: Type.STRING, description: 'Human distance e.g. один метр' },
          hazardLevel: { type: Type.INTEGER, description: '1 = red critical, 2 = amber warning, 3 = green safe' },
        },
        required: ['label', 'box2d', 'clockDirection', 'distance', 'hazardLevel'],
      },
    },
    clipContext: {
      type: Type.STRING,
      description: 'Brief 2-3 word description of environment (e.g. Комната, Офис, Улица)',
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
        ? 'Внимание, препятствие на уровне головы, пригнись.'
        : 'Stop, obstacle at head level.',
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
    // Normal clear scene - SILENT BY DEFAULT!
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
      // Key missing: Inform cleanly ONCE without spamming loop or inventing fake obstacles
      return res.json({
        success: true,
        hasKey: false,
        analysis: {
          ttsMessage: isRu
            ? 'Ассистент готов. Укажите ключ Gemini API в настройках или Vercel.'
            : 'Assistant ready. Please add Gemini API key in settings or Vercel.',
          hazardLevel: 0,
          hazardType: 'READY_AWAITING_KEY',
          clockDirection: 'NONE',
          distanceMeters: 0,
          distanceText: isRu ? 'чисто' : 'clear',
          verticalZone: 'GENERAL',
          clipContext: isRu ? 'Ожидание API ключа' : 'Awaiting API Key',
          suggestedAction: 'CONTINUE',
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

    // High-precision channel instruction builder
    let channelInstruction = '';
    if (channel === 'TEXT_OCR') {
      channelInstruction = isRu
        ? `СПЕЦИАЛЬНЫЙ КАНАЛ [БЫСТРЫЙ ТЕКСТ / OCR]:
1. Найди весь видимый текст на вывесках, табличках, дверях, экранах, бумаге или ценниках.
2. Помести полный распознанный текст в поле "detectedValue".
3. В поле "ttsMessage" выдай чистый текст для озвучивания с префиксом "Текст: [найденный текст]". Если текста нет: "Текст в кадре не обнаружен".
4. Обязательно выдели текстовые блоки в detectedObjects.`
        : `SPECIAL CHANNEL [TEXT OCR]:
1. Read all visible signs, room numbers, labels, product text, screens.
2. Put extracted text in "detectedValue".
3. Output "ttsMessage" as "Text: [read text]". If none, "No text found in view".
4. Mark text regions in detectedObjects.`;
    } else if (channel === 'CURRENCY') {
      channelInstruction = isRu
        ? `СПЕЦИАЛЬНЫЙ КАНАЛ [КУПЮРЫ И ДЕНЬГИ]:
1. Определи номинал и валюту банкнот или монет в кадре (рубли, доллары, евро).
2. Запиши номинал в "detectedValue" (например: "1000 рублей", "100 долларов").
3. В поле "ttsMessage" выдай: "Купюра [номинал]."
4. Добавь купюру в detectedObjects.`
        : `SPECIAL CHANNEL [CURRENCY READER]:
1. Identify denomination and currency of banknotes or coins in view.
2. Set "detectedValue" to denomination (e.g. "100 dollars", "50 euros", "1000 rubles").
3. Output "ttsMessage" as "Banknote [value]."
4. Add to detectedObjects.`;
    } else if (channel === 'FIND_OBJECT') {
      const target = targetObject || userQuery || (isRu ? 'дверь' : 'door');
      channelInstruction = isRu
        ? `СПЕЦИАЛЬНЫЙ КАНАЛ [ПОИСК ЦЕЛИ: "${target}"]:
1. Внимательно ищи объект "${target}" в кадре.
2. Если объект найден:
   - Внеси его в detectedObjects с точным box2d и clockDirection.
   - В "ttsMessage" скажи: "[Название] на [часы] в [дистанция]." (например: "Дверь на 12 часов в трех шагах").
   - hazardType = "FOUND_OBJECT", shouldSpeak = true.
3. Если объект НЕ найден в кадре:
   - ttsMessage = "Объект ${target} в кадре не найден. Поверните камеру медленно в сторону.", shouldSpeak = false.`
        : `SPECIAL CHANNEL [FIND TARGET OBJECT: "${target}"]:
1. Search specifically for "${target}".
2. If found: add to detectedObjects with box2d, output "[Object] at [clock] in [distance]", hazardType = "FOUND_OBJECT", shouldSpeak = true.
3. If not found: report "Target ${target} not in view. Pan camera slowly."`;
    } else {
      channelInstruction = isRu
        ? `РЕЖИМ НАВИГАЦИИ И ОБНАРУЖЕНИЯ:
1. Найди все ключевые объекты перед пользователем (стулья, столы, двери, люди, проходы, препятствия).
2. Добавь все обнаруженные объекты в массив detectedObjects с реальными рамками box2d и часами!
3. Для главного объекта или препятствия на пути сформируй ttsMessage: "[Объект] на [часы] в [дистанция]."
4. Если путь свободен: ttsMessage = "Путь свободен.", hazardLevel = 0, shouldSpeak = false.`
        : `EXPLORE NAVIGATION MODE:
1. Detect all key objects in front of user (furniture, doors, people, obstacles).
2. Populate detectedObjects with precise box2d and clockDirection.
3. If path is clear: ttsMessage = "Path clear.", hazardLevel = 0, shouldSpeak = false.`;
    }

    const promptParts = [
      `OPERATIONAL MODE: ${mode}`,
      channelInstruction,
      sensors.tiltZone
        ? `DEVICE TILT SENSOR: ${
            sensors.tiltZone === 'GROUND'
              ? 'Tilted down at ground / floor'
              : sensors.tiltZone === 'HEAD'
              ? 'Tilted up toward ceiling / head level'
              : 'Level / facing straight ahead'
          }`
        : '',
      sensors.isLowLight ? 'SENSOR ALERT: Low light scene (<25 lux)' : '',
      sensors.isLensBlocked ? 'SENSOR ALERT: Camera lens is occluded' : '',
      lastSpokenText
        ? `PREVIOUS ANNOUNCEMENT: "${lastSpokenText}" (Do not repeat static obstacles unless distance significantly changed).`
        : '',
      userQuery
        ? `USER SPOKEN QUERY: "${userQuery}". Answer directly and concisely adhering to safety rules.`
        : 'Perform comprehensive object detection, estimate distances, and output spatial clock coordinates.',
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

    // Ensure detectedObjects is always an array
    if (!Array.isArray(parsed.detectedObjects)) {
      parsed.detectedObjects = [];
    }

    res.json({
      success: true,
      hasKey: true,
      analysis: parsed,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.warn('[VisionAssist AI] Inference error, engaging safety fallback:', error?.message);
    const fallback = createSafetyFallback(
      req.body.sensors,
      req.body.userQuery,
      req.body.channel,
      req.body.targetObject,
      lang
    );
    res.json({
      success: true,
      hasKey: true,
      analysis: fallback,
      timestamp: Date.now(),
      fallbackEngaged: true,
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
  res.json({
    status: 'ok',
    app: 'VisionAssist AI',
    serverType: process.env.VERCEL ? 'Vercel Serverless Function' : 'Express Server',
    hasServerKey: Boolean(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY),
    time: new Date().toISOString(),
  });
}

/* ==========================================================================
   7. UNIVERSAL ROUTE MOUNTING (VERCEL REWRITE SAFE)
   ========================================================================== */

app.post(['/api/analyze', '/analyze'], handleAnalyze);
app.post(['/api/tts', '/tts'], handleTts);
app.get(['/api/health', '/health', '/api'], handleHealth);

// Universal fallback middleware for any rewritten paths
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
