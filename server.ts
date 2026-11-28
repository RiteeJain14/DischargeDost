import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { GoogleGenAI, Modality, ThinkingLevel, Type } from '@google/genai';
import type { FunctionDeclaration, LiveServerMessage } from '@google/genai';
import { WebSocketServer, type WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { lookupDrugInteractions, evaluateSymptomRedFlags } from './server/clinicalTools.ts';

const PORT = Number(process.env.PORT) || 3000;
const MODEL_TEXT = 'gemini-4-hydrogen';
const MODEL_TRANSCRIBE = 'gemini-3.5-transcribe';
const MODEL_TTS = 'gemini-3.8-flash-lite-tts';
const MODEL_LIVE = 'gemini-3.8-live';

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English (simple, everyday clear phrasing)',
  hi: 'Hindi (हिन्दी — warm, plain everyday Devanagari Hindi easy for families)',
  ta: 'Tamil (தமிழ் — warm, plain everyday Tamil easy for families)',
  bn: 'Bengali (বাংলা — warm, plain everyday Bengali easy for families)',
};

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withGeminiRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('429');
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      const delayMs = 750 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastErr;
}

function validateBase64Payload(data: unknown, maxBytes: number): string | null {
  if (typeof data !== 'string' || data.length === 0) return null;
  const cleaned = data.includes(',') ? data.split(',')[1] : data;
  if (!cleaned || cleaned.length > maxBytes * 1.4) return null;
  return cleaned;
}

const lookupDrugTool: FunctionDeclaration = {
  name: 'lookup_drug_interactions',
  description:
    'Look up clinical drug-drug interactions, timing conflicts, duplicate therapies, and meal-spacing rules for a list of extracted discharge medicines.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      medicineNames: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'List of medicine generic or brand names extracted from the discharge summary.',
      },
    },
    required: ['medicineNames'],
  },
};

const escalateRedFlagTool: FunctionDeclaration = {
  name: 'escalate_red_flag_alert',
  description:
    'Evaluate patient symptoms against clinical discharge red-flag warning signs and return severity classification and escalation protocol.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      symptomText: {
        type: Type.STRING,
        description: 'Patient-reported symptoms in English or regional language.',
      },
      dischargeRedFlags: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'The patient specific discharge red flags from their hospital plan.',
      },
    },
    required: ['symptomText', 'dischargeRedFlags'],
  },
};

const recoveryPlanSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Short 4-7 word episode title in the target language.' },
    hospitalName: { type: Type.STRING, description: 'Hospital or clinic name, or "Hospital Discharge Summary" if unspecified.' },
    dischargeDate: { type: Type.STRING, description: 'Discharge date string if present, else today date.' },
    patientContext: { type: Type.STRING, description: 'Short summary of diagnosis/procedure in target language.' },
    plainSummary: {
      type: Type.STRING,
      description: 'Warm, reassuring 3-5 sentence plain-language summary of what happened and recovery goals in the target language.',
    },
    medicines: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'Medicine name (keep generic/brand recognizable + local clarity).' },
          dose: { type: Type.STRING, description: 'Dose strength and quantity, e.g. "75 mg · 1 tablet".' },
          slot: {
            type: Type.STRING,
            enum: ['morning_before', 'morning_after', 'afternoon', 'evening', 'bedtime', 'as_needed'],
            description: 'Daily schedule time slot.',
          },
          timeLabel: { type: Type.STRING, description: 'Human time label in target language, e.g. "7:30 AM before breakfast".' },
          duration: { type: Type.STRING, description: 'Course duration in target language, e.g. "Continue daily" or "5 days".' },
          purpose: { type: Type.STRING, description: 'Simple explanation of what this medicine does in target language.' },
          foodRule: { type: Type.STRING, description: 'Before/after food instruction in target language.' },
        },
        required: ['name', 'dose', 'slot', 'timeLabel', 'duration', 'purpose', 'foodRule'],
      },
    },
    conflicts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          pair: { type: Type.STRING, description: 'Medicine pair or timing item involved.' },
          severity: { type: Type.STRING, enum: ['high', 'moderate', 'timing'] },
          explanation: { type: Type.STRING, description: 'Plain-language explanation of the conflict in target language.' },
          recommendation: { type: Type.STRING, description: 'Actionable safe next step in target language (advise confirming with doctor).' },
        },
        required: ['pair', 'severity', 'explanation', 'recommendation'],
      },
    },
    dietPlan: {
      type: Type.OBJECT,
      properties: {
        allowed: { type: Type.ARRAY, items: { type: Type.STRING } },
        avoid: { type: Type.ARRAY, items: { type: Type.STRING } },
        hydrationGoal: { type: Type.STRING },
      },
      required: ['allowed', 'avoid', 'hydrationGoal'],
    },
    activityRules: { type: Type.ARRAY, items: { type: Type.STRING } },
    redFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
    followUpAppointments: { type: Type.ARRAY, items: { type: Type.STRING } },
    clinicianNote: {
      type: Type.STRING,
      description: 'Concise clinical SBAR summary ALWAYS in English for doctors/nurses, noting diagnosis, regimen, and flagged drug interactions.',
    },
  },
  required: [
    'title',
    'hospitalName',
    'dischargeDate',
    'patientContext',
    'plainSummary',
    'medicines',
    'conflicts',
    'dietPlan',
    'activityRules',
    'redFlags',
    'followUpAppointments',
    'clinicianNote',
  ],
};

const checkInSchema = {
  type: Type.OBJECT,
  properties: {
    severity: { type: Type.STRING, enum: ['stable', 'caution', 'red_flag'] },
    guidance: {
      type: Type.STRING,
      description: 'Warm, clear 2-4 sentence guidance in the target language telling the family exactly what to do next.',
    },
    matchedRedFlags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'List of matched red flags or warnings in the target language (empty array if stable).',
    },
    clinicianAlertSummary: {
      type: Type.STRING,
      description: 'Structured English SBAR clinical note summarizing symptoms, adherence, and urgency for the doctor.',
    },
  },
  required: ['severity', 'guidance', 'matchedRedFlags', 'clinicianAlertSummary'],
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '16mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'DischargeDost', timestamp: new Date().toISOString() });
  });

  // 1. Analyze Discharge Summary (Multimodal Image/PDF or Text + Gemini Function Calling)
  app.post('/api/discharge/analyze', async (req, res) => {
    try {
      const { imageBase64, mimeType, rawText, language = 'en' } = req.body ?? {};
      const langKey = typeof language === 'string' && LANGUAGE_LABELS[language] ? language : 'en';
      const langDesc = LANGUAGE_LABELS[langKey];

      const cleanedB64 = validateBase64Payload(imageBase64, 12 * 1024 * 1024);
      const textInput = typeof rawText === 'string' ? rawText.trim().slice(0, 12000) : '';

      if (!cleanedB64 && !textInput) {
        res.status(400).json({ error: 'Please upload a discharge summary photo/PDF or paste discharge text.' });
        return;
      }

      const ai = getGeminiClient();
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      if (cleanedB64) {
        const safeMime =
          typeof mimeType === 'string' && /^(image\/(png|jpeg|jpg|webp)|application\/pdf)$/.test(mimeType)
            ? mimeType === 'image/jpg'
              ? 'image/jpeg'
              : mimeType
            : 'image/jpeg';
        parts.push({
          inlineData: {
            mimeType: safeMime,
            data: cleanedB64,
          },
        });
      }

      parts.push({
        text: [
          'You are DischargeDost, a careful post-hospital recovery assistant that supports medical advice and never replaces doctors.',
          textInput ? `Additional discharge text provided:\n${textInput}` : 'Read the attached hospital discharge summary / prescription carefully.',
          'First, extract every prescribed medicine name, dose, frequency, food/timing rule, diagnosis, diet, activity rules, follow-up dates, and red-flag warnings.',
          'You MUST call the `lookup_drug_interactions` tool with the extracted `medicineNames` array so we can verify real drug-drug and timing conflicts.',
        ].join('\n\n'),
      });

      const toolCallsExecuted: Array<{ name: string; args: unknown; result: unknown }> = [];

      // Turn 1: Multimodal extraction + function call
      const turn1 = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: MODEL_TEXT,
          contents: [{ role: 'user', parts }],
          config: {
            tools: [{ functionDeclarations: [lookupDrugTool] }],
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        }),
      );

      const turn1Content = turn1.candidates?.[0]?.content;
      const fnCall = turn1.functionCalls?.find((f) => f.name === 'lookup_drug_interactions');

      const clinicalContextText = turn1.text ?? '';
      let interactionResult = lookupDrugInteractions([]);

      const finalContents: Array<unknown> = [{ role: 'user', parts }];

      if (turn1Content && fnCall) {
        const argNames = Array.isArray((fnCall.args as Record<string, unknown>)?.medicineNames)
          ? ((fnCall.args as Record<string, unknown>).medicineNames as string[])
          : [];
        interactionResult = lookupDrugInteractions(argNames);
        toolCallsExecuted.push({
          name: fnCall.name ?? 'lookup_drug_interactions',
          args: fnCall.args,
          result: interactionResult,
        });

        finalContents.push(turn1Content, {
          role: 'user',
          parts: [
            {
              functionResponse: {
                id: fnCall.id,
                name: fnCall.name ?? 'lookup_drug_interactions',
                response: { result: interactionResult },
              },
            },
          ],
        });
      }

      // Turn 2: Structured JSON synthesis integrating tool response in target language
      const synthesisPrompt = [
        `Target patient language: ${langDesc}.`,
        'Convert the extracted clinical discharge findings and verified drug interaction lookup results into the exact JSON schema.',
        'Rules:',
        '1. All patient-facing text (`title`, `patientContext`, `plainSummary`, `timeLabel`, `duration`, `purpose`, `foodRule`, `conflicts.explanation`, `conflicts.recommendation`, `dietPlan`, `activityRules`, `redFlags`, `followUpAppointments`) MUST be written clearly and naturally in the target language.',
        '2. Keep medicine generic/brand names recognizable (e.g., "Clopidogrel 75 mg" or include script transliteration alongside English generic name).',
        '3. Always include ALL interactions found in the `lookup_drug_interactions` tool output, plus any clear timing notes or prescription conflicts observed.',
        '4. `clinicianNote` MUST be in concise English SBAR format for the treating doctor.',
        '5. Remind clearly that this plan supports medical advice and never replaces the doctor.',
        clinicalContextText ? `\n--- ADDITIONAL NOTES ---\n${clinicalContextText}` : '',
        '\n--- VERIFIED DRUG INTERACTION TOOL OUTPUT ---',
        JSON.stringify(interactionResult, null, 2),
      ].join('\n');

      finalContents.push({ role: 'user', parts: [{ text: synthesisPrompt }] });

      const finalResp = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: MODEL_TEXT,
          contents: finalContents as Parameters<typeof ai.models.generateContent>[0]['contents'],
          config: {
            tools: [{ functionDeclarations: [lookupDrugTool] }],
            responseMimeType: 'application/json',
            responseSchema: recoveryPlanSchema,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        }),
      );

      const parsed = JSON.parse((finalResp.text ?? '{}').trim());
      res.json({
        plan: {
          ...parsed,
          language: langKey,
        },
        toolCallsExecuted,
      });
    } catch (error) {
      console.error('Analyze discharge error:', error);
      const message = error instanceof Error ? error.message : 'Failed to analyze discharge summary.';
      res.status(500).json({ error: message });
    }
  });

  // 2. Translate an Existing Plan to English / Hindi / Tamil / Bengali
  app.post('/api/discharge/translate', async (req, res) => {
    try {
      const { plan, targetLanguage } = req.body ?? {};
      if (!plan || typeof plan !== 'object') {
        res.status(400).json({ error: 'Missing plan object.' });
        return;
      }
      const langKey = typeof targetLanguage === 'string' && LANGUAGE_LABELS[targetLanguage] ? targetLanguage : 'en';
      const langDesc = LANGUAGE_LABELS[langKey];

      const ai = getGeminiClient();
      const response = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: MODEL_TEXT,
          contents: [
            `Translate and adapt this structured recovery plan into ${langDesc}.`,
            'Preserve all medicine names (keep English generic name recognizable alongside local phrasing if helpful), doses, slot keys (`morning_before`, `morning_after`, `afternoon`, `evening`, `bedtime`, `as_needed`), conflict severities, and keep `clinicianNote` in concise English.',
            JSON.stringify(plan),
          ].join('\n\n'),
          config: {
            responseMimeType: 'application/json',
            responseSchema: recoveryPlanSchema,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        }),
      );

      const translated = JSON.parse((response.text ?? '{}').trim());
      res.json({
        plan: {
          ...translated,
          language: langKey,
        },
      });
    } catch (error) {
      console.error('Translate plan error:', error);
      const message = error instanceof Error ? error.message : 'Failed to translate recovery plan.';
      res.status(500).json({ error: message });
    }
  });

  // 3. Daily Check-In (Voice Transcription + Symptom vs Red Flags Function Calling + Clinician Summary)
  app.post('/api/checkin/evaluate', async (req, res) => {
    try {
      const {
        symptomsText = '',
        audioBase64,
        audioMimeType,
        language = 'en',
        medicinesTaken = [],
        planContext = {},
      } = req.body ?? {};

      const langKey = typeof language === 'string' && LANGUAGE_LABELS[language] ? language : 'en';
      const langDesc = LANGUAGE_LABELS[langKey];
      const ai = getGeminiClient();

      let finalSymptomText = typeof symptomsText === 'string' ? symptomsText.trim().slice(0, 2000) : '';
      let transcript = '';

      const cleanedAudio = validateBase64Payload(audioBase64, 10 * 1024 * 1024);
      if (cleanedAudio) {
        const safeAudioMime =
          typeof audioMimeType === 'string' && /^audio\/(webm|wav|mp3|mpeg|ogg|mp4)$/.test(audioMimeType)
            ? audioMimeType
            : 'audio/webm';
        const transcribeResp = await ai.models.generateContent({
          model: MODEL_TRANSCRIBE,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: safeAudioMime,
                  data: cleanedAudio,
                },
              },
              {
                text: 'Transcribe this patient or caregiver recovery check-in audio accurately in its spoken language (English, Hindi, Tamil, or Bengali).',
              },
            ],
          },
        });
        transcript = (transcribeResp.text ?? '').trim();
        if (transcript) {
          finalSymptomText = finalSymptomText ? `${finalSymptomText}\n${transcript}` : transcript;
        }
      }

      if (!finalSymptomText) {
        res.status(400).json({ error: 'Please describe how the patient is feeling or record a voice note.' });
        return;
      }

      const dischargeRedFlags = Array.isArray(planContext?.redFlags)
        ? (planContext.redFlags as string[]).slice(0, 12)
        : [];
      const activeMedicines = Array.isArray(planContext?.medicines)
        ? (planContext.medicines as Array<{ name?: string; dose?: string }>).map((m) => `${m.name ?? ''} ${m.dose ?? ''}`.trim())
        : [];

      const toolCallsExecuted: Array<{ name: string; args: unknown; result: unknown }> = [];

      const promptParts = [
        'You are DischargeDost conducting a daily post-discharge symptom check-in.',
        `Patient diagnosis context: ${String(planContext?.patientContext ?? 'Post-hospital recovery')}`,
        `Active medicines: ${activeMedicines.join(', ') || 'Not specified'}`,
        `Medicines taken today: ${Array.isArray(medicinesTaken) ? medicinesTaken.join(', ') : 'None recorded'}`,
        `Discharge summary red flags: ${dischargeRedFlags.join(' | ') || 'Chest pain, breathlessness, bleeding, high fever'}`,
        `Patient check-in report: "${finalSymptomText}"`,
        'You MUST call `escalate_red_flag_alert` with the reported symptoms and discharge red flags to check clinical urgency.',
      ].join('\n');

      const turn1 = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: MODEL_TEXT,
          contents: promptParts,
          config: {
            tools: [{ functionDeclarations: [escalateRedFlagTool] }],
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        }),
      );

      const turn1Content = turn1.candidates?.[0]?.content;
      const fnCall = turn1.functionCalls?.find((f) => f.name === 'escalate_red_flag_alert');

      let triageToolResult = evaluateSymptomRedFlags(finalSymptomText, dischargeRedFlags);
      const evalContents: Array<unknown> = [{ role: 'user', parts: [{ text: promptParts }] }];

      if (turn1Content && fnCall) {
        const fnArgs = (fnCall.args ?? {}) as { symptomText?: string; dischargeRedFlags?: string[] };
        triageToolResult = evaluateSymptomRedFlags(
          typeof fnArgs.symptomText === 'string' && fnArgs.symptomText ? fnArgs.symptomText : finalSymptomText,
          Array.isArray(fnArgs.dischargeRedFlags) ? fnArgs.dischargeRedFlags : dischargeRedFlags,
        );
        toolCallsExecuted.push({
          name: fnCall.name ?? 'escalate_red_flag_alert',
          args: fnCall.args,
          result: triageToolResult,
        });

        evalContents.push(turn1Content, {
          role: 'user',
          parts: [
            {
              functionResponse: {
                id: fnCall.id,
                name: fnCall.name ?? 'escalate_red_flag_alert',
                response: { result: triageToolResult },
              },
            },
          ],
        });
      }

      evalContents.push({
        role: 'user',
        parts: [
          {
            text: [
              `Target patient language: ${langDesc}.`,
              `Patient report: "${finalSymptomText}"`,
              `Medicines confirmed taken today: ${Array.isArray(medicinesTaken) ? medicinesTaken.join(', ') : 'None'}`,
              `Verified red-flag triage tool result: ${JSON.stringify(triageToolResult)}`,
              'Generate the final structured JSON response. Remember: never replace a doctor; if severity is red_flag or caution, advise contacting the treating physician or emergency care promptly.',
              '`clinicianAlertSummary` MUST be written in concise English SBAR format.',
            ].join('\n\n'),
          },
        ],
      });

      const finalEval = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: MODEL_TEXT,
          contents: evalContents as Parameters<typeof ai.models.generateContent>[0]['contents'],
          config: {
            tools: [{ functionDeclarations: [escalateRedFlagTool] }],
            responseMimeType: 'application/json',
            responseSchema: checkInSchema,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        }),
      );

      const parsed = JSON.parse((finalEval.text ?? '{}').trim());
      res.json({
        transcript: transcript || finalSymptomText,
        evaluation: parsed,
        toolCallsExecuted,
      });
    } catch (error) {
      console.error('Check-in evaluate error:', error);
      const message = error instanceof Error ? error.message : 'Failed to evaluate daily check-in.';
      res.status(500).json({ error: message });
    }
  });

  // 4. Multilingual Audio Read-Aloud (Gemini TTS)
  app.post('/api/tts', async (req, res) => {
    try {
      const { text } = req.body ?? {};
      if (typeof text !== 'string' || !text.trim()) {
        res.status(400).json({ error: 'Text is required for speech synthesis.' });
        return;
      }
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: MODEL_TTS,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: text.trim().slice(0, 1500),
                speechMetadata: {
                  style: 'Calm, warm, reassuring healthcare companion speaking clearly for a patient and family',
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

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res.status(502).json({ error: 'Audio synthesis returned empty audio.' });
        return;
      }
      res.json({ audioBase64: base64Audio, mimeType: 'audio/wav' });
    } catch (error) {
      console.error('TTS error:', error);
      const message = error instanceof Error ? error.message : 'Failed to generate audio.';
      res.status(500).json({ error: message });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(process.cwd(), 'dist');

  if (!isProd || !fs.existsSync(distPath)) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const reqPath = (request.url || '').split('?')[0];
    if (reqPath === '/api/live-checkin') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (clientWs: WebSocket) => {
    let liveSession: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    let isClosed = false;
    let isStarting = false;
    let dischargeRedFlags: string[] = [];

    const safeSend = (payload: Record<string, unknown>) => {
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    clientWs.on('message', async (rawData) => {
      let msg: {
        type?: string;
        data?: string;
        text?: string;
        language?: string;
        medicinesTaken?: string[];
        planContext?: {
          title?: string;
          patientContext?: string;
          plainSummary?: string;
          medicines?: Array<{ name?: string; dose?: string; timeLabel?: string; foodRule?: string; purpose?: string }>;
          conflicts?: Array<{ pair?: string; severity?: string; explanation?: string; recommendation?: string }>;
          dietPlan?: { allowed?: string[]; avoid?: string[]; hydrationGoal?: string };
          activityRules?: string[];
          redFlags?: string[];
          followUpAppointments?: string[];
        };
      };

      try {
        msg = JSON.parse(rawData.toString());
      } catch {
        return;
      }

      if (msg.type === 'start' && !liveSession && !isStarting) {
        isStarting = true;
        try {
          const ai = getGeminiClient();
          const langKey = typeof msg.language === 'string' && LANGUAGE_LABELS[msg.language] ? msg.language : 'en';
          const langDesc = LANGUAGE_LABELS[langKey];
          const ctx = msg.planContext ?? {};

          dischargeRedFlags = Array.isArray(ctx.redFlags)
            ? ctx.redFlags.map((r) => String(r)).slice(0, 12)
            : [];

          const medsList = Array.isArray(ctx.medicines)
            ? ctx.medicines
                .slice(0, 20)
                .map((m) => `${m.name ?? ''} (${m.dose ?? ''}) — ${m.timeLabel ?? ''}; ${m.foodRule ?? ''}; purpose: ${m.purpose ?? ''}`)
                .join('\n  - ')
            : 'Not specified';

          const conflictsList = Array.isArray(ctx.conflicts) && ctx.conflicts.length > 0
            ? ctx.conflicts
                .slice(0, 15)
                .map((c) => `${c.pair ?? ''} [${c.severity ?? ''}]: ${c.explanation ?? ''} -> ${c.recommendation ?? ''}`)
                .join('\n  - ')
            : 'None flagged';

          const takenToday = Array.isArray(msg.medicinesTaken) && msg.medicinesTaken.length > 0
            ? msg.medicinesTaken.join(', ')
            : 'None confirmed yet today';

          const systemInstruction = [
            'You are DischargeDost, a warm, calm, reassuring post-hospital recovery voice companion speaking directly with a patient or family caregiver on a live call.',
            `Speak naturally and clearly in ${langDesc}. Keep spoken answers concise (2-4 clear sentences per turn) and easy to follow, unless the patient asks for more detail.`,
            'Answer the patient or caregiver questions accurately using ONLY their discharge plan below and sound clinical safety:',
            `Episode: ${ctx.title ?? 'Hospital Recovery Plan'}`,
            `Diagnosis / Context: ${ctx.patientContext ?? 'Post-hospital home recovery'}`,
            `Summary: ${ctx.plainSummary ?? ''}`,
            `Prescribed Medicines:\n  - ${medsList}`,
            `Medicines already taken today: ${takenToday}`,
            `Flagged Drug / Timing Checks:\n  - ${conflictsList}`,
            `Diet Allowed: ${(ctx.dietPlan?.allowed ?? []).join(', ') || 'As advised'}`,
            `Diet Avoid: ${(ctx.dietPlan?.avoid ?? []).join(', ') || 'None listed'}`,
            `Hydration Goal: ${ctx.dietPlan?.hydrationGoal ?? 'As advised'}`,
            `Activity & Wound Rules: ${(ctx.activityRules ?? []).join('; ') || 'Rest and follow discharge advice'}`,
            `Follow-Up Appointments: ${(ctx.followUpAppointments ?? []).join('; ') || 'Check discharge card'}`,
            `Discharge Red Flags: ${dischargeRedFlags.join(' | ') || 'Chest pain, breathlessness, bleeding, high fever'}`,
            'CRITICAL SAFETY RULES:',
            '1. You support the treating doctor’s discharge instructions and NEVER replace licensed medical care or prescribe new medicines/dosage changes.',
            '2. Whenever the patient describes any physical symptom, missed dose, or side effect, call `escalate_red_flag_alert` to check clinical urgency.',
            '3. If red-flag symptoms (chest pain, breathlessness, bleeding, fainting, high fever, severe low blood sugar) are mentioned, advise contacting the hospital emergency desk or calling emergency services immediately.',
          ].join('\n');

          liveSession = await ai.live.connect({
            model: MODEL_LIVE,
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
              },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              tools: [{ functionDeclarations: [escalateRedFlagTool] }],
              systemInstruction,
            },
            callbacks: {
              onmessage: (message: LiveServerMessage) => {
                if (isClosed) return;
                const content = message.serverContent;

                if (content?.inputTranscription?.text) {
                  safeSend({ type: 'inputTranscript', text: content.inputTranscription.text });
                }
                if (content?.outputTranscription?.text) {
                  safeSend({ type: 'outputTranscript', text: content.outputTranscription.text });
                }
                for (const part of content?.modelTurn?.parts ?? []) {
                  if (part.inlineData?.data) {
                    safeSend({ type: 'audio', data: part.inlineData.data });
                  }
                }
                if (content?.interrupted) {
                  safeSend({ type: 'interrupted' });
                }
                if (content?.turnComplete) {
                  safeSend({ type: 'turnComplete' });
                }

                for (const call of message.toolCall?.functionCalls ?? []) {
                  if (call.name === 'escalate_red_flag_alert') {
                    const args = (call.args ?? {}) as { symptomText?: string; dischargeRedFlags?: string[] };
                    const triage = evaluateSymptomRedFlags(
                      typeof args.symptomText === 'string' ? args.symptomText : '',
                      Array.isArray(args.dischargeRedFlags) ? args.dischargeRedFlags : dischargeRedFlags,
                    );
                    if (triage.severity !== 'stable') {
                      safeSend({ type: 'redFlagAlert', result: triage });
                    }
                    liveSession?.sendToolResponse({
                      functionResponses: [
                        {
                          id: call.id,
                          name: call.name,
                          response: { result: triage },
                        },
                      ],
                    });
                  }
                }
              },
              onerror: (err) => {
                console.error('Gemini Live session error:', err);
                safeSend({
                  type: 'error',
                  message: err instanceof Error ? err.message : 'Live voice session encountered an error.',
                });
              },
              onclose: () => {
                if (!isClosed) {
                  safeSend({ type: 'closed' });
                }
              },
            },
          });

          if (isClosed) {
            liveSession.close();
            liveSession = null;
          } else {
            safeSend({ type: 'ready' });
          }
        } catch (err) {
          console.error('Failed to start Gemini Live session:', err);
          safeSend({
            type: 'error',
            message: err instanceof Error ? err.message : 'Could not connect live voice call.',
          });
        } finally {
          isStarting = false;
        }
        return;
      }

      if (msg.type === 'audio' && typeof msg.data === 'string' && liveSession && !isClosed) {
        liveSession.sendRealtimeInput({
          audio: { data: msg.data, mimeType: 'audio/pcm;rate=16000' },
        });
        return;
      }

      if (msg.type === 'text' && typeof msg.text === 'string' && msg.text.trim() && liveSession && !isClosed) {
        liveSession.sendRealtimeInput({
          text: msg.text.trim().slice(0, 1000),
        });
      }
    });

    clientWs.on('close', () => {
      isClosed = true;
      try {
        liveSession?.close();
      } catch {
        // ignore close errors
      }
      liveSession = null;
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`DischargeDost server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start DischargeDost server:', err);
  process.exit(1);
});
