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

const getUploadedReportTool: FunctionDeclaration = {
  name: 'get_uploaded_discharge_report',
  description:
    'Retrieve the full extracted text, medicines, diagnosis, and instructions of the hospital discharge summary photo or PDF that the patient or caregiver uploaded before or during this live call.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      reason: {
        type: Type.STRING,
        description: 'Brief reason for checking the uploaded report (e.g. review medicines or confirm diagnosis).',
      },
    },
  },
};

const saveDailyCheckInTool: FunctionDeclaration = {
  name: 'save_daily_checkin',
  description:
    'Save and log today’s completed recovery check-in into Check-In History. Call this ONLY when the patient or caregiver explicitly asks to save/log/finish their check-in right now.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      summary: {
        type: Type.STRING,
        description:
          'Concise summary of all symptoms, comfort level, medicine adherence notes, and concerns shared by the patient during the check-in.',
      },
    },
    required: ['summary'],
  },
};

async function extractDischargeReportForLive(
  ai: GoogleGenAI,
  base64Data: string,
  mimeType: string,
  fileName?: string,
): Promise<string> {
  const safeMime =
    mimeType === 'image/jpg'
      ? 'image/jpeg'
      : /^(image\/(png|jpeg|webp)|application\/pdf)$/.test(mimeType)
      ? mimeType
      : 'image/jpeg';

  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model: MODEL_TEXT,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: safeMime,
              data: base64Data,
            },
          },
          {
            text: [
              `Read this uploaded hospital discharge summary / prescription (${fileName || 'discharge report'}) carefully.`,
              'Extract a concise, clinically accurate summary in plain text covering:',
              '1. Hospital name, discharge date, and diagnosis/procedure.',
              '2. Every prescribed medicine with exact dose, frequency shorthand (e.g. 1-0-0, OD, BD, HS), before/after food timing, and duration.',
              '3. Diet, fluid, and activity/wound-care instructions.',
              '4. Follow-up dates and emergency warning signs (red flags).',
              '5. Any notable drug interaction or timing caution to double-check with the patient.',
              'Keep the entire summary under 1800 characters and do not omit any medicines.',
            ].join('\n'),
          },
        ],
      },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    }),
  );

  return (response.text ?? '').trim().slice(0, 3500);
}

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

const intakeChatSchema = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description: 'Warm, clear conversational reply in the target language answering any user question and asking 1-2 short clarifying questions if needed before finalizing the plan.',
    },
    followUpQuestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Up to 3 short tap-friendly patient quick-reply options in the target language.',
    },
    readyToBuildPlan: {
      type: Type.BOOLEAN,
      description: 'True when a discharge report or text is provided AND clarifying questions are answered or user asked to proceed.',
    },
    intakeSummaryForPlan: {
      type: Type.STRING,
      description: 'Concise summary of extra home/OTC medicines, allergies, meal times, or symptoms mentioned across the conversation.',
    },
  },
  required: ['reply', 'followUpQuestions', 'readyToBuildPlan', 'intakeSummaryForPlan'],
};

const medicineIdentifySchema = {
  type: Type.OBJECT,
  properties: {
    medicineName: {
      type: Type.STRING,
      description: 'Brand and/or generic medicine name & strength read from the package/strip, e.g. "Ecosprin 75 mg (Aspirin)" or "Unknown medicine".',
    },
    primaryUse: {
      type: Type.STRING,
      description: 'Clear 1-2 sentence explanation in the target language of what this medicine is commonly used for.',
    },
    timingTip: {
      type: Type.STRING,
      description: 'Brief general food/timing guidance in the target language (e.g. before or after food, or as prescribed).',
    },
    cautionNote: {
      type: Type.STRING,
      description: 'Brief safety note in the target language reminding to confirm dose/combinations with the treating doctor.',
    },
    chatInputText: {
      type: Type.STRING,
      description: 'Ready-to-send concise line in the target language naming the medicine and its use so it can be inserted into the chat input box (e.g., "Medicine photo: Ibuprofen 400 mg — Used for pain and swelling relief. Is this safe with my discharge medicines?").',
    },
  },
  required: ['medicineName', 'primaryUse', 'timingTip', 'cautionNote', 'chatInputText'],
};

const checkInChatSchema = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description:
        'Warm, concise 2-4 sentence conversational reply in the target language answering any user question and asking 1-2 short follow-up questions if more detail is needed before logging the check-in.',
    },
    quickReplies: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Up to 3 short tap-friendly patient quick-reply options in the target language.',
    },
    severity: {
      type: Type.STRING,
      enum: ['stable', 'caution', 'red_flag'],
      description: 'Current triage severity based on symptoms discussed so far.',
    },
    matchedRedFlags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Matched warning signs in target language if any, else empty array.',
    },
    readyToFinalize: {
      type: Type.BOOLEAN,
      description:
        'True once key check-in details (how the patient feels, any pain/fever/breathing/dizziness, missed doses) are clear, OR an urgent red flag is detected, OR the user indicates they are done.',
    },
    userConfirmedSave: {
      type: Type.BOOLEAN,
      description:
        'True ONLY when the user explicitly asks to save, log, or complete the check-in in their latest message (e.g. "save", "save check-in", "yes save it", "done please save"). Otherwise false.',
    },
    compiledCheckInSummary: {
      type: Type.STRING,
      description:
        'Concise summary of all symptoms, comfort level, medicine adherence notes, and questions shared by the patient across the entire chat so far, ready to be saved into Check-In History.',
    },
  },
  required: [
    'reply',
    'quickReplies',
    'severity',
    'matchedRedFlags',
    'readyToFinalize',
    'userConfirmedSave',
    'compiledCheckInSummary',
  ],
};

const followUpUpdateSchema = {
  type: Type.OBJECT,
  properties: {
    followUpReport: {
      type: Type.OBJECT,
      properties: {
        reportDate: {
          type: Type.STRING,
          description: 'Date printed on the follow-up visit/lab report, or today’s YYYY-MM-DD date if not listed.',
        },
        doctorOrClinic: {
          type: Type.STRING,
          description: 'Doctor name, specialty, or clinic/lab name from the follow-up document.',
        },
        reportType: {
          type: Type.STRING,
          enum: ['opd_note', 'lab_report', 'prescription_update', 'other'],
          description: 'Type of doctor follow-up document.',
        },
        summary: {
          type: Type.STRING,
          description: 'Warm, plain-language 2-4 sentence summary of the follow-up report and key doctor advice in the target language.',
        },
        changes: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Clear bullet points in target language listing every medicine added, stopped, dose-changed, lab value highlighted, or new follow-up date.',
        },
        clinicianSummary: {
          type: Type.STRING,
          description: 'Concise 2-4 sentence English clinical note summarizing this follow-up report, lab highlights, and regimen changes for doctor handover.',
        },
      },
      required: ['reportDate', 'doctorOrClinic', 'reportType', 'summary', 'changes', 'clinicianSummary'],
    },
    updatedPlan: recoveryPlanSchema,
  },
  required: ['followUpReport', 'updatedPlan'],
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
      const { imageBase64, mimeType, rawText, intakeNotes, language = 'en' } = req.body ?? {};
      const langKey = typeof language === 'string' && LANGUAGE_LABELS[language] ? language : 'en';
      const langDesc = LANGUAGE_LABELS[langKey];

      const cleanedB64 = validateBase64Payload(imageBase64, 12 * 1024 * 1024);
      const textInput = typeof rawText === 'string' ? rawText.trim().slice(0, 12000) : '';
      const extraIntake = typeof intakeNotes === 'string' ? intakeNotes.trim().slice(0, 6000) : '';

      if (!cleanedB64 && !textInput && !extraIntake) {
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
          extraIntake
            ? `Clarifying patient & caregiver intake notes (home/OTC medicines, allergies, daily meal schedule, or current symptoms):\n${extraIntake}`
            : '',
          'First, extract every prescribed medicine name, dose, frequency, food/timing rule, diagnosis, diet, activity rules, follow-up dates, and red-flag warnings (including any extra home/OTC medicines mentioned in intake notes).',
          'You MUST call the `lookup_drug_interactions` tool with the extracted `medicineNames` array so we can verify real drug-drug and timing conflicts.',
        ]
          .filter(Boolean)
          .join('\n\n'),
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

  function formatExistingCaseContext(
    planInput: unknown,
    checkInsInput: unknown,
    followUpsInput: unknown,
  ): string {
    const plan =
      planInput && typeof planInput === 'object' ? (planInput as Record<string, unknown>) : null;
    if (!plan) return '';

    const sections: string[] = [];

    const planHeader = [
      `Plan Title: ${String(plan.title ?? 'Hospital Recovery Plan')}`,
      plan.hospitalName ? `Hospital: ${String(plan.hospitalName)}` : '',
      plan.dischargeDate ? `Original Discharge Date: ${String(plan.dischargeDate)}` : '',
      plan.patientContext ? `Diagnosis / Clinical Context: ${String(plan.patientContext)}` : '',
      plan.plainSummary ? `Original Discharge Summary: ${String(plan.plainSummary)}` : '',
      plan.clinicianNote ? `Current Clinician SBAR Note: ${String(plan.clinicianNote)}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    sections.push(`ORIGINAL DISCHARGE REPORT & ACTIVE RECOVERY PLAN:\n${planHeader}`);

    const meds = Array.isArray(plan.medicines)
      ? (plan.medicines as Array<Record<string, unknown>>).slice(0, 20)
      : [];
    if (meds.length > 0) {
      const medLines = meds
        .map(
          (m) =>
            `  - ${String(m.name ?? '')} (${String(m.dose ?? '')}) — ${String(
              m.timeLabel ?? m.slot ?? '',
            )}; ${String(m.foodRule ?? '')}; purpose: ${String(m.purpose ?? '')}`,
        )
        .join('\n');
      sections.push(`CURRENT ACTIVE MEDICINES:\n${medLines}`);
    }

    const conflicts = Array.isArray(plan.conflicts)
      ? (plan.conflicts as Array<Record<string, unknown>>).slice(0, 12)
      : [];
    if (conflicts.length > 0) {
      const conflictLines = conflicts
        .map(
          (c) =>
            `  - ${String(c.pair ?? '')} [${String(c.severity ?? '')}]: ${String(
              c.explanation ?? '',
            )} -> ${String(c.recommendation ?? '')}`,
        )
        .join('\n');
      sections.push(`CURRENT FLAGGED DRUG / TIMING CHECKS:\n${conflictLines}`);
    }

    const diet =
      plan.dietPlan && typeof plan.dietPlan === 'object'
        ? (plan.dietPlan as Record<string, unknown>)
        : null;
    const dietAllowed = Array.isArray(diet?.allowed) ? diet.allowed.map(String).join(', ') : '';
    const dietAvoid = Array.isArray(diet?.avoid) ? diet.avoid.map(String).join(', ') : '';
    const hydration = diet?.hydrationGoal ? String(diet.hydrationGoal) : '';
    const activity = Array.isArray(plan.activityRules)
      ? plan.activityRules.map(String).join('; ')
      : '';
    const redFlags = Array.isArray(plan.redFlags) ? plan.redFlags.map(String).join(' | ') : '';
    const appointments = Array.isArray(plan.followUpAppointments)
      ? plan.followUpAppointments.map(String).join('; ')
      : '';

    const careRules = [
      dietAllowed ? `Diet Allowed: ${dietAllowed}` : '',
      dietAvoid ? `Diet Avoid: ${dietAvoid}` : '',
      hydration ? `Hydration Goal: ${hydration}` : '',
      activity ? `Activity & Wound Rules: ${activity}` : '',
      redFlags ? `Discharge Red Flags: ${redFlags}` : '',
      appointments ? `Scheduled Follow-Ups: ${appointments}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    if (careRules) {
      sections.push(`CURRENT CARE INSTRUCTIONS:\n${careRules}`);
    }

    const checkIns = Array.isArray(checkInsInput)
      ? (checkInsInput as Array<Record<string, unknown>>).slice(0, 8)
      : [];
    if (checkIns.length > 0) {
      const checkInLines = checkIns
        .map((c) => {
          const dateStr = String(c.checkInDate ?? c.createdAtLabel ?? 'Recent');
          const severity = String(c.severity ?? 'stable');
          const symptom = String(c.symptomNote ?? '').slice(0, 400);
          const taken = Array.isArray(c.medicinesTaken)
            ? c.medicinesTaken.map(String).join(', ')
            : '';
          const guidance = String(c.guidance ?? '').slice(0, 300);
          const flags = Array.isArray(c.matchedRedFlags) && c.matchedRedFlags.length > 0
            ? ` | Red flags: ${c.matchedRedFlags.map(String).join(', ')}`
            : '';
          const alert = c.clinicianAlertSummary
            ? ` | Clinical note: ${String(c.clinicianAlertSummary).slice(0, 260)}`
            : '';
          return `  - [${dateStr}] Status: ${severity}${flags} | Patient reported: ${symptom || 'No symptoms noted'}${
            taken ? ` | Medicines taken: ${taken}` : ''
          }${guidance ? ` | Guidance given: ${guidance}` : ''}${alert}`;
        })
        .join('\n');
      sections.push(`RECENT DAILY CHECK-IN SUMMARIES (${checkIns.length} logged):\n${checkInLines}`);
    } else {
      sections.push('RECENT DAILY CHECK-IN SUMMARIES: None logged yet.');
    }

    const followUps = Array.isArray(followUpsInput)
      ? (followUpsInput as Array<Record<string, unknown>>).slice(0, 6)
      : [];
    if (followUps.length > 0) {
      const fuLines = followUps
        .map((f) => {
          const dateStr = String(f.reportDate ?? f.createdAtLabel ?? 'Prior visit');
          const clinic = String(f.doctorOrClinic ?? 'Doctor visit');
          const rType = String(f.reportType ?? 'opd_note');
          const summary = String(f.summary ?? '').slice(0, 320);
          const changes = Array.isArray(f.changes)
            ? f.changes.map(String).slice(0, 6).join('; ')
            : '';
          return `  - [${dateStr}] ${clinic} (${rType}): ${summary}${
            changes ? ` | Changes: ${changes}` : ''
          }`;
        })
        .join('\n');
      sections.push(`PREVIOUS FOLLOW-UP DOCTOR REPORTS (${followUps.length}):\n${fuLines}`);
    }

    return sections.join('\n\n');
  }

  // 1a-ii. Merge Doctor Follow-Up Report / Lab Results / Updated Prescription into Selected Plan
  app.post('/api/discharge/followup', async (req, res) => {
    try {
      const {
        existingPlan,
        checkIns = [],
        previousFollowUps = [],
        imageBase64,
        mimeType,
        rawText = '',
        intakeNotes = '',
        language = 'en',
      } = req.body ?? {};

      if (!existingPlan || typeof existingPlan !== 'object') {
        res.status(400).json({ error: 'An existing recovery plan must be selected to add a follow-up report.' });
        return;
      }

      const langKey = typeof language === 'string' && LANGUAGE_LABELS[language] ? language : 'en';
      const langDesc = LANGUAGE_LABELS[langKey];
      const cleanedB64 = validateBase64Payload(imageBase64, 12 * 1024 * 1024);
      const textInput = typeof rawText === 'string' ? rawText.trim().slice(0, 10000) : '';
      const extraNotes = typeof intakeNotes === 'string' ? intakeNotes.trim().slice(0, 4000) : '';
      const combinedNotes = [
        textInput,
        extraNotes ? `Patient/Caregiver follow-up notes:\n${extraNotes}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      if (!cleanedB64 && !combinedNotes) {
        res.status(400).json({
          error: 'Please upload a follow-up prescription/lab report photo or PDF, or share what the doctor updated.',
        });
        return;
      }

      const ai = getGeminiClient();
      const toolCallsExecuted: Array<{ name: string; args: unknown; result: unknown }> = [];
      const userParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      if (cleanedB64) {
        const safeMime =
          typeof mimeType === 'string' && /^(image\/(png|jpeg|jpg|webp)|application\/pdf)$/.test(mimeType)
            ? mimeType === 'image/jpg'
              ? 'image/jpeg'
              : mimeType
            : 'image/jpeg';
        userParts.push({
          inlineData: {
            mimeType: safeMime,
            data: cleanedB64,
          },
        });
      }

      const currentPlanSnapshot = {
        title: existingPlan.title,
        hospitalName: existingPlan.hospitalName,
        dischargeDate: existingPlan.dischargeDate,
        patientContext: existingPlan.patientContext,
        plainSummary: existingPlan.plainSummary,
        medicines: Array.isArray(existingPlan.medicines) ? existingPlan.medicines.slice(0, 20) : [],
        conflicts: Array.isArray(existingPlan.conflicts) ? existingPlan.conflicts.slice(0, 15) : [],
        dietPlan: existingPlan.dietPlan,
        activityRules: existingPlan.activityRules,
        redFlags: existingPlan.redFlags,
        followUpAppointments: existingPlan.followUpAppointments,
        clinicianNote: existingPlan.clinicianNote,
      };

      const fullContinuityContext = formatExistingCaseContext(
        currentPlanSnapshot,
        checkIns,
        previousFollowUps,
      );

      userParts.push({
        text: [
          'You are DischargeDost, a careful post-hospital recovery assistant merging a new DOCTOR FOLLOW-UP REPORT (OPD visit note, lab result, or updated prescription) into an existing recovery plan.',
          `Target patient language: ${langDesc}.`,
          fullContinuityContext,
          `EXISTING RECOVERY PLAN JSON (for exact field continuity):\n${JSON.stringify(currentPlanSnapshot, null, 2)}`,
          combinedNotes ? `NEW FOLLOW-UP TEXT / CAREGIVER NOTES:\n${combinedNotes}` : '',
          'Step 1: Read the uploaded follow-up report carefully in context of the original discharge summary, prior follow-ups, and recent Daily Check-In summaries. Determine what changed (medicines added, stopped, or dose adjusted; lab findings; new diet/activity instructions; new follow-up appointment dates) and note how any doctor adjustments connect to symptoms or issues logged in recent check-ins.',
          'Step 2: You MUST call `lookup_drug_interactions` with the FULL UPDATED list of active medicines (combining continuing medicines + newly prescribed medicines + any OTC medicines mentioned, excluding stopped medicines).',
        ]
          .filter(Boolean)
          .join('\n\n'),
      });

      const turn1 = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: MODEL_TEXT,
          contents: [{ role: 'user', parts: userParts }],
          config: {
            tools: [{ functionDeclarations: [lookupDrugTool] }],
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        }),
      );

      const turn1Content = turn1.candidates?.[0]?.content;
      const fnCall = turn1.functionCalls?.find((f) => f.name === 'lookup_drug_interactions');

      const existingMedNames = (currentPlanSnapshot.medicines as Array<{ name?: string }>)
        .map((m) => String(m?.name ?? ''))
        .filter(Boolean);
      let interactionResult = lookupDrugInteractions([...existingMedNames, combinedNotes]);
      const finalContents: Array<unknown> = [{ role: 'user', parts: userParts }];

      if (turn1Content && fnCall) {
        const argNames = Array.isArray((fnCall.args as Record<string, unknown>)?.medicineNames)
          ? ((fnCall.args as Record<string, unknown>).medicineNames as string[])
          : existingMedNames;
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

      const todayIso = new Date().toISOString().slice(0, 10);
      finalContents.push({
        role: 'user',
        parts: [
          {
            text: [
              `Target patient language: ${langDesc}. Today's date: ${todayIso}.`,
              'Return the structured JSON containing BOTH `followUpReport` and `updatedPlan`.',
              'MERGE RULES:',
              '1. Preserve the existing plan’s `title`, `hospitalName`, and `dischargeDate` unless the follow-up explicitly updates context; keep unaffected continuing medicines, diet, red flags, and activity rules intact.',
              '2. Apply all doctor changes accurately: add newly prescribed medicines, update doses/timings if changed, remove medicines explicitly stopped by the doctor, and update `followUpAppointments` with any newly scheduled visit date.',
              '3. Include ALL verified interactions from `lookup_drug_interactions` in `updatedPlan.conflicts`.',
              '4. Write all patient-facing text in `followUpReport` (`summary`, `changes`) and `updatedPlan` in the target language.',
              '5. Write `followUpReport.clinicianSummary` and `updatedPlan.clinicianNote` in concise English SBAR format incorporating the original discharge background, relevant recent daily check-in trends, and this follow-up visit.',
              `VERIFIED DRUG INTERACTION TOOL OUTPUT:\n${JSON.stringify(interactionResult, null, 2)}`,
            ].join('\n\n'),
          },
        ],
      });

      const finalResp = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: MODEL_TEXT,
          contents: finalContents as Parameters<typeof ai.models.generateContent>[0]['contents'],
          config: {
            tools: [{ functionDeclarations: [lookupDrugTool] }],
            responseMimeType: 'application/json',
            responseSchema: followUpUpdateSchema,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        }),
      );

      const parsed = JSON.parse((finalResp.text ?? '{}').trim());
      res.json({
        followUpReport: {
          ...(parsed.followUpReport ?? {}),
          language: langKey,
        },
        updatedPlan: {
          ...(parsed.updatedPlan ?? {}),
          language: langKey,
        },
        toolCallsExecuted,
      });
    } catch (error) {
      console.error('Follow-up merge error:', error);
      const message = error instanceof Error ? error.message : 'Failed to process follow-up report.';
      res.status(500).json({ error: message });
    }
  });

  // 1b. Interactive Front-Page Intake Chat (Clarifying Questions + Pre-Plan Guidance)
  app.post('/api/intake/chat', async (req, res) => {
    try {
      const {
        messages = [],
        imageBase64,
        mimeType,
        rawText = '',
        language = 'en',
        existingPlanContext = null,
        checkIns = [],
        previousFollowUps = [],
      } = req.body ?? {};

      const langKey = typeof language === 'string' && LANGUAGE_LABELS[language] ? language : 'en';
      const langDesc = LANGUAGE_LABELS[langKey];
      const cleanedB64 = validateBase64Payload(imageBase64, 12 * 1024 * 1024);
      const textInput = typeof rawText === 'string' ? rawText.trim().slice(0, 8000) : '';
      const hasReport = Boolean(cleanedB64 || textInput);

      const historyText = Array.isArray(messages)
        ? messages
            .slice(-12)
            .map((m: { role?: string; text?: string }) =>
              `${m.role === 'assistant' ? 'DischargeDost' : 'Patient/Caregiver'}: ${String(m.text ?? '').slice(0, 1200)}`,
            )
            .join('\n')
        : '';

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

      const isFollowUpMode = Boolean(
        existingPlanContext && typeof existingPlanContext === 'object' && existingPlanContext.title,
      );
      const existingPlanBrief = isFollowUpMode
        ? formatExistingCaseContext(existingPlanContext, checkIns, previousFollowUps)
        : '';

      parts.push({
        text: [
          `Target patient language: ${langDesc}.`,
          isFollowUpMode
            ? 'You are DischargeDost helping the patient/caregiver add a DOCTOR FOLLOW-UP REPORT (OPD note, lab results, or revised prescription) to their existing recovery plan. You ALREADY HAVE full access to their original discharge summary, current medicines, care rules, recent Daily Check-In summaries, and previous follow-up reports below — use this full history actively in your replies.'
            : 'You are DischargeDost, a warm, calm, reassuring post-hospital recovery intake assistant on the front page.',
          'Always respond strictly in the target language.',
          existingPlanBrief,
          hasReport
            ? isFollowUpMode
              ? 'The user has attached a new doctor follow-up report / lab result / revised prescription.'
              : 'The user has attached a discharge report / prescription (image, PDF, or pasted text).'
            : isFollowUpMode
            ? 'No new follow-up report file is attached yet (though the original discharge plan and recent check-ins above are already loaded).'
            : 'No discharge report photo/PDF/text is attached yet.',
          textInput ? `Pasted clinical text / notes:\n${textInput}` : '',
          historyText ? `Conversation so far:\n${historyText}` : 'The user just attached the document or started the intake.',
          'INSTRUCTIONS:',
          '1. Answer any question the patient or caregiver asked accurately and warmly using their loaded discharge summary, medicines, and recent check-in history whenever relevant. Never replace a doctor or prescribe new medicines/dosages; advise urgent medical help if red-flag symptoms (chest pain, breathlessness, bleeding, fainting, high fever) are mentioned.',
          isFollowUpMode
            ? '2. If NO new follow-up report is attached yet: directly answer any questions about their existing discharge plan, medicines, or recent daily check-ins, and invite them to attach the doctor’s follow-up prescription/lab photo or PDF (or tell you what the doctor changed) so you can update their existing plan.'
            : '2. If NO discharge report is attached yet: answer their question, and warmly ask them to upload/attach their discharge summary photo/PDF (or try the sample discharge photo) so you can prepare a personalized daily medicine plan. Set `readyToBuildPlan: false`.',
          isFollowUpMode
            ? '3. If a follow-up report IS attached: compare it against their original discharge summary, current medicines, and recent Daily Check-In logs — briefly highlight 1-2 key changes (new/stopped/adjusted medicines, lab findings, connection to recent check-in symptoms, or next appointment) and ask 1 short confirming question (e.g., whether the doctor stopped any older medicine or if they have any new symptoms). Set `readyToBuildPlan: true` once they confirm or if the report changes are already clear.'
            : '3. If a discharge report IS attached and key clarifying items have NOT been answered yet: briefly mention 1-2 key details you noticed on the paper, then ask 1-2 short, practical clarifying questions before building the final plan — specifically checking (a) any extra home/OTC painkillers or supplements, (b) any medicine allergies or usual meal times, and (c) how the patient feels right now. Set `readyToBuildPlan: false` (unless the user explicitly asked to skip/build right now).',
          '4. Once the user answers those clarifying details (or says nothing else / go ahead / ready), confirm warmly that you have everything needed and set `readyToBuildPlan: true`.',
          '5. Provide 2-3 short tap-friendly `followUpQuestions` (quick reply options in the target language) ONLY when clarifying questions remain (`readyToBuildPlan: false`). NEVER include action button labels like "Update Selected Plan", "Build Final Recovery Plan", or "Save Plan" in `followUpQuestions` because that button is already in the footer; when `readyToBuildPlan` is `true`, return an empty `followUpQuestions` array `[]`.',
        ]
          .filter(Boolean)
          .join('\n\n'),
      });

      const chatContents: Array<unknown> = [{ role: 'user', parts }];

      let finalResp = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: MODEL_TEXT,
          contents: chatContents as Parameters<typeof ai.models.generateContent>[0]['contents'],
          config: {
            tools: [{ functionDeclarations: [lookupDrugTool, escalateRedFlagTool] }],
            responseMimeType: 'application/json',
            responseSchema: intakeChatSchema,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        }),
      );

      const turn1Content = finalResp.candidates?.[0]?.content;
      const calls = finalResp.functionCalls ?? [];

      if (turn1Content && calls.length > 0) {
        const functionResponseParts = calls.map((call) => {
          if (call.name === 'lookup_drug_interactions') {
            const argNames = Array.isArray((call.args as Record<string, unknown>)?.medicineNames)
              ? ((call.args as Record<string, unknown>).medicineNames as string[])
              : [];
            return {
              functionResponse: {
                id: call.id,
                name: call.name,
                response: { result: lookupDrugInteractions(argNames) },
              },
            };
          }
          const args = (call.args ?? {}) as { symptomText?: string; dischargeRedFlags?: string[] };
          return {
            functionResponse: {
              id: call.id,
              name: call.name ?? 'escalate_red_flag_alert',
              response: {
                result: evaluateSymptomRedFlags(
                  typeof args.symptomText === 'string' ? args.symptomText : textInput || historyText,
                  Array.isArray(args.dischargeRedFlags) ? args.dischargeRedFlags : [],
                ),
              },
            },
          };
        });

        chatContents.push(turn1Content, {
          role: 'user',
          parts: functionResponseParts,
        });

        finalResp = await withGeminiRetry(() =>
          ai.models.generateContent({
            model: MODEL_TEXT,
            contents: chatContents as Parameters<typeof ai.models.generateContent>[0]['contents'],
            config: {
              responseMimeType: 'application/json',
              responseSchema: intakeChatSchema,
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
          }),
        );
      }

      const parsed = JSON.parse((finalResp.text ?? '{}').trim());
      res.json({
        reply: typeof parsed.reply === 'string' ? parsed.reply : '',
        followUpQuestions: Array.isArray(parsed.followUpQuestions)
          ? parsed.followUpQuestions.slice(0, 3).map(String)
          : [],
        readyToBuildPlan: Boolean(parsed.readyToBuildPlan && (hasReport || historyText.length >= 40)),
        intakeSummaryForPlan:
          typeof parsed.intakeSummaryForPlan === 'string' ? parsed.intakeSummaryForPlan : '',
      });
    } catch (error) {
      console.error('Intake chat error:', error);
      const message = error instanceof Error ? error.message : 'Failed to process intake chat.';
      res.status(500).json({ error: message });
    }
  });

  // 1c. Identify Medicine Photo (Camera / Gallery Scan from Chat Input)
  app.post('/api/medicine/identify', async (req, res) => {
    try {
      const { imageBase64, mimeType, language = 'en' } = req.body ?? {};
      const cleanedB64 = validateBase64Payload(imageBase64, 10 * 1024 * 1024);
      if (!cleanedB64) {
        res.status(400).json({ error: 'Please capture or upload a clear photo of the medicine strip or bottle.' });
        return;
      }

      const langKey = typeof language === 'string' && LANGUAGE_LABELS[language] ? language : 'en';
      const langDesc = LANGUAGE_LABELS[langKey];
      const safeMime =
        typeof mimeType === 'string' && /^image\/(png|jpeg|jpg|webp)$/.test(mimeType)
          ? mimeType === 'image/jpg'
            ? 'image/jpeg'
            : mimeType
          : 'image/jpeg';

      const ai = getGeminiClient();
      const response = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: MODEL_TEXT,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: safeMime,
                    data: cleanedB64,
                  },
                },
                {
                  text: [
                    `Target patient language: ${langDesc}.`,
                    'You are DischargeDost, a careful post-hospital medication assistant.',
                    'Inspect this photo of a medicine strip, tablet blister pack, bottle, box, or syrup label.',
                    'Identify the medicine name (brand + active generic composition & strength if visible) and clearly explain what it is used for in plain, everyday wording in the target language.',
                    'If the image is blurry or not a medicine, honestly say so in `medicineName` and `primaryUse`, and ask the user to retake a clearer close-up photo.',
                    'Keep `chatInputText` concise (1-2 sentences max) so it fits neatly into the chat text box, clearly stating the medicine name and what its use is.',
                    'Never advise changing a doctor’s prescription or prescribe a new dosage.',
                  ].join('\n'),
                },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: medicineIdentifySchema,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        }),
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({
        medicineName: typeof parsed.medicineName === 'string' ? parsed.medicineName : '',
        primaryUse: typeof parsed.primaryUse === 'string' ? parsed.primaryUse : '',
        timingTip: typeof parsed.timingTip === 'string' ? parsed.timingTip : '',
        cautionNote: typeof parsed.cautionNote === 'string' ? parsed.cautionNote : '',
        chatInputText: typeof parsed.chatInputText === 'string' ? parsed.chatInputText : '',
      });
    } catch (error) {
      console.error('Medicine identify error:', error);
      const message = error instanceof Error ? error.message : 'Failed to identify medicine photo.';
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

  // 3b. Interactive Multi-Turn Check-In Chat (Asks & Answers Questions Before Finalizing Check-In)
  app.post('/api/checkin/chat', async (req, res) => {
    try {
      const {
        messages = [],
        language = 'en',
        medicinesTaken = [],
        planContext = {},
      } = req.body ?? {};

      const langKey = typeof language === 'string' && LANGUAGE_LABELS[language] ? language : 'en';
      const langDesc = LANGUAGE_LABELS[langKey];

      const validMessages = Array.isArray(messages)
        ? messages
            .slice(-14)
            .map((m: { role?: string; text?: string }) => ({
              role: m.role === 'assistant' ? 'assistant' : 'user',
              text: String(m.text ?? '').trim().slice(0, 1200),
            }))
            .filter((m) => m.text.length > 0)
        : [];

      if (validMessages.length === 0) {
        res.status(400).json({ error: 'Please enter a message to start the check-in chat.' });
        return;
      }

      const dischargeRedFlags = Array.isArray(planContext?.redFlags)
        ? (planContext.redFlags as string[]).slice(0, 12)
        : [];
      const activeMedicines = Array.isArray(planContext?.medicines)
        ? (planContext.medicines as Array<{ name?: string; dose?: string; timeLabel?: string; foodRule?: string }>)
            .slice(0, 20)
            .map((m) => `${m.name ?? ''} (${m.dose ?? ''}, ${m.timeLabel ?? ''}, ${m.foodRule ?? ''})`)
        : [];
      const conflicts = Array.isArray(planContext?.conflicts)
        ? (planContext.conflicts as Array<{ pair?: string; explanation?: string }>)
            .slice(0, 10)
            .map((c) => `${c.pair ?? ''}: ${c.explanation ?? ''}`)
        : [];

      const conversationText = validMessages
        .map((m) => `${m.role === 'assistant' ? 'DischargeDost' : 'Patient/Caregiver'}: ${m.text}`)
        .join('\n');
      const patientMessagesCombined = validMessages
        .filter((m) => m.role === 'user')
        .map((m) => m.text)
        .join(' | ');
      const userTurnCount = validMessages.filter((m) => m.role === 'user').length;

      const ai = getGeminiClient();
      const prompt = [
        `Target patient language: ${langDesc}.`,
        'You are DischargeDost conducting an interactive daily recovery check-in chat.',
        'Always write `reply`, `quickReplies`, and `matchedRedFlags` naturally in the target language.',
        `Patient diagnosis / context: ${String(planContext?.patientContext ?? 'Post-hospital recovery')}`,
        `Prescribed medicines: ${activeMedicines.join(' ; ') || 'Not specified'}`,
        `Flagged interactions: ${conflicts.join(' ; ') || 'None'}`,
        `Medicines marked taken today: ${Array.isArray(medicinesTaken) && medicinesTaken.length > 0 ? medicinesTaken.join(', ') : 'None logged yet'}`,
        `Discharge warning signs (red flags): ${dischargeRedFlags.join(' | ') || 'Chest pain, breathlessness, bleeding, high fever, fainting'}`,
        '',
        'CONVERSATION SO FAR:',
        conversationText,
        '',
        'INSTRUCTIONS:',
        '1. Answer any question the patient/caregiver asks clearly and reassuringly using their recovery plan above. Never prescribe new medicines or replace licensed medical care.',
        '2. Whenever the patient mentions any physical symptom, pain, side effect, or discomfort, call `escalate_red_flag_alert` to screen clinical urgency.',
        '3. On the first 1-2 patient turns (unless an emergency red flag is already present or the user explicitly says they want to save/finish), ask 1-2 brief, caring follow-up questions to complete the picture (e.g., pain severity/duration, fever/breathing/dizziness, missed doses, appetite/hydration) and set `readyToFinalize: false` and `userConfirmedSave: false`.',
        `4. Current patient turn count: ${userTurnCount}. Once you have enough information to summarize today’s check-in cleanly (typically by turn 2-3, or earlier if all details are clear, or immediately on red_flag), reassure them warmly, briefly state what you noted, and mention they can tap the Save Check-In button below whenever ready (set \`readyToFinalize: true\`). Do NOT ask "Would you like me to save this check-in?" as a yes/no question.`,
        '5. If the user explicitly asks to save or log the check-in in their latest message (e.g., "save", "save check-in", "yes save", "done save it", in any language), set BOTH `userConfirmedSave: true` and `readyToFinalize: true`, and reply briefly confirming you are saving today’s check-in now.',
        '6. Provide 2-3 concise, tap-friendly `quickReplies` in the target language ONLY when you asked a follow-up question (`readyToFinalize: false`). NEVER generate a quick-reply chip that says "save check-in" (the user already has a dedicated Save Check-In button right below the chat). When `readyToFinalize` is true, return `quickReplies: []`.',
        '7. Always populate `compiledCheckInSummary` with a clean, complete summary of everything the patient reported across all turns so far.',
      ].join('\n');

      const chatContents: Array<unknown> = [{ role: 'user', parts: [{ text: prompt }] }];

      let response = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: MODEL_TEXT,
          contents: chatContents as Parameters<typeof ai.models.generateContent>[0]['contents'],
          config: {
            tools: [{ functionDeclarations: [escalateRedFlagTool] }],
            responseMimeType: 'application/json',
            responseSchema: checkInChatSchema,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        }),
      );

      const turn1Content = response.candidates?.[0]?.content;
      const fnCall = response.functionCalls?.find((f) => f.name === 'escalate_red_flag_alert');

      if (turn1Content && fnCall) {
        const fnArgs = (fnCall.args ?? {}) as { symptomText?: string; dischargeRedFlags?: string[] };
        const triageResult = evaluateSymptomRedFlags(
          typeof fnArgs.symptomText === 'string' && fnArgs.symptomText
            ? fnArgs.symptomText
            : patientMessagesCombined,
          Array.isArray(fnArgs.dischargeRedFlags) ? fnArgs.dischargeRedFlags : dischargeRedFlags,
        );

        chatContents.push(
          turn1Content,
          {
            role: 'user',
            parts: [
              {
                functionResponse: {
                  id: fnCall.id,
                  name: fnCall.name ?? 'escalate_red_flag_alert',
                  response: { result: triageResult },
                },
              },
            ],
          },
          {
            role: 'user',
            parts: [
              {
                text: `Verified red-flag triage tool result: ${JSON.stringify(triageResult)}. Return the final structured JSON response in ${langDesc}. If severity is red_flag, advise immediate emergency medical attention and set readyToFinalize: true.`,
              },
            ],
          },
        );

        response = await withGeminiRetry(() =>
          ai.models.generateContent({
            model: MODEL_TEXT,
            contents: chatContents as Parameters<typeof ai.models.generateContent>[0]['contents'],
            config: {
              responseMimeType: 'application/json',
              responseSchema: checkInChatSchema,
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
          }),
        );
      }

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const heuristicTriage = evaluateSymptomRedFlags(patientMessagesCombined, dischargeRedFlags);
      const finalSeverity =
        heuristicTriage.severity === 'red_flag'
          ? 'red_flag'
          : parsed.severity === 'red_flag' || parsed.severity === 'caution' || parsed.severity === 'stable'
          ? parsed.severity
          : heuristicTriage.severity;

      const isReady = Boolean(parsed.readyToFinalize || finalSeverity === 'red_flag');
      const confirmedSave = Boolean(parsed.userConfirmedSave);

      res.json({
        reply: typeof parsed.reply === 'string' ? parsed.reply : '',
        quickReplies:
          isReady || confirmedSave
            ? []
            : Array.isArray(parsed.quickReplies)
            ? parsed.quickReplies.slice(0, 3).map(String)
            : [],
        severity: finalSeverity,
        matchedRedFlags: Array.isArray(parsed.matchedRedFlags)
          ? parsed.matchedRedFlags.map(String)
          : heuristicTriage.matchedTriggers,
        readyToFinalize: isReady || confirmedSave,
        userConfirmedSave: confirmedSave,
        compiledCheckInSummary:
          typeof parsed.compiledCheckInSummary === 'string' && parsed.compiledCheckInSummary.trim()
            ? parsed.compiledCheckInSummary.trim()
            : patientMessagesCombined,
      });
    } catch (error) {
      console.error('Check-in chat error:', error);
      const message = error instanceof Error ? error.message : 'Failed to continue check-in chat.';
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

  // 5. Instant Voice Note Transcription for Daily Check-In text box
  app.post('/api/transcribe', async (req, res) => {
    try {
      const { audioBase64, audioMimeType, language = 'en' } = req.body ?? {};
      const cleanedAudio = validateBase64Payload(audioBase64, 10 * 1024 * 1024);
      if (!cleanedAudio) {
        res.status(400).json({ error: 'Valid audio recording is required for transcription.' });
        return;
      }

      const safeAudioMime =
        typeof audioMimeType === 'string' && /^audio\/(webm|wav|mp3|mpeg|ogg|mp4|aac|flac)$/.test(audioMimeType)
          ? audioMimeType
          : 'audio/webm';
      const langKey = typeof language === 'string' && LANGUAGE_LABELS[language] ? language : 'en';
      const langDesc = LANGUAGE_LABELS[langKey];

      const ai = getGeminiClient();
      const transcribeResp = await withGeminiRetry(() =>
        ai.models.generateContent({
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
                text: `Transcribe this patient or caregiver recovery check-in voice note accurately as plain text only (no markdown, no labels). Keep it in the spoken language (expected: ${langDesc}, or English/Hindi/Tamil/Bengali as spoken).`,
              },
            ],
          },
        }),
      );

      const transcript = (transcribeResp.text ?? '').trim();
      res.json({ transcript });
    } catch (error) {
      console.error('Transcribe voice note error:', error);
      const message = error instanceof Error ? error.message : 'Failed to transcribe voice note.';
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
  const wss = new WebSocketServer({ noServer: true, maxPayload: 25 * 1024 * 1024 });

  server.on('upgrade', (request, socket, head) => {
    const reqPath = (request.url || '').split('?')[0];
    if (reqPath === '/api/live-checkin' || reqPath === '/api/live-intake') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (clientWs: WebSocket, request: http.IncomingMessage) => {
    const reqPath = (request.url || '').split('?')[0];
    const isIntakeMode = reqPath === '/api/live-intake';

    let liveSession: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    let isClosed = false;
    let isStarting = false;
    let dischargeRedFlags: string[] = [];
    let attachedReportContext: { fileName: string; extractedText: string } | null = null;
    let isFollowUpSession = false;
    let activeLangDesc = LANGUAGE_LABELS.en;

    const safeSend = (payload: Record<string, unknown>) => {
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    clientWs.on('message', async (rawData) => {
      let msg: {
        type?: string;
        data?: string;
        mimeType?: string;
        fileName?: string;
        text?: string;
        language?: string;
        hasReport?: boolean;
        imageBase64?: string;
        imageMimeType?: string;
        rawText?: string;
        chatSummary?: string;
        medicinesTaken?: string[];
        existingPlanContext?: Record<string, unknown> | null;
        checkIns?: Array<Record<string, unknown>>;
        previousFollowUps?: Array<Record<string, unknown>>;
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
          activeLangDesc = langDesc;

          let systemInstruction = '';

          if (isIntakeMode) {
            const pastedText = typeof msg.rawText === 'string' ? msg.rawText.trim().slice(0, 6000) : '';
            const chatContext = typeof msg.chatSummary === 'string' ? msg.chatSummary.trim().slice(0, 2000) : '';
            const cleanedDoc = validateBase64Payload(msg.imageBase64, 12 * 1024 * 1024);
            const rawMime = typeof msg.imageMimeType === 'string' ? msg.imageMimeType : '';
            const normalizedMime =
              rawMime === 'image/jpg'
                ? 'image/jpeg'
                : /^(image\/(png|jpeg|webp)|application\/pdf)$/.test(rawMime)
                ? rawMime
                : msg.fileName?.toLowerCase().endsWith('.pdf')
                ? 'application/pdf'
                : 'image/jpeg';

            isFollowUpSession = Boolean(
              msg.existingPlanContext &&
                typeof msg.existingPlanContext === 'object' &&
                msg.existingPlanContext.title,
            );

            if (isFollowUpSession && Array.isArray(msg.existingPlanContext?.redFlags)) {
              dischargeRedFlags = (msg.existingPlanContext.redFlags as unknown[])
                .map((r) => String(r))
                .slice(0, 12);
            }

            const existingCaseBlock = isFollowUpSession
              ? formatExistingCaseContext(
                  msg.existingPlanContext,
                  msg.checkIns,
                  msg.previousFollowUps,
                )
              : '';

            if (cleanedDoc) {
              try {
                const extractedText = await extractDischargeReportForLive(
                  ai,
                  cleanedDoc,
                  normalizedMime,
                  msg.fileName || (isFollowUpSession ? 'followup_report' : 'discharge_report'),
                );
                if (extractedText) {
                  attachedReportContext = {
                    fileName: msg.fileName || (isFollowUpSession ? 'followup_report' : 'discharge_report'),
                    extractedText,
                  };
                }
              } catch (extractErr) {
                console.error('Pre-call discharge extraction error:', extractErr);
              }
            }

            systemInstruction = isFollowUpSession
              ? [
                  'You are DischargeDost, a warm, calm, reassuring post-hospital recovery assistant on a live voice call in DOCTOR FOLLOW-UP REPORT mode.',
                  `Speak naturally and clearly in ${langDesc}. Keep spoken answers concise (2-4 clear sentences per turn).`,
                  'You ALREADY HAVE complete access to the patient’s original hospital discharge report, current active medicines, care rules, recent Daily Check-In summaries, and previous follow-up doctor reports below. Use this history naturally when answering questions or comparing new doctor changes.',
                  existingCaseBlock,
                  attachedReportContext
                    ? `The patient has ALREADY attached a NEW follow-up doctor report (${attachedReportContext.fileName}). Here are the complete extracted details:\n${attachedReportContext.extractedText}`
                    : 'No new follow-up doctor report file is attached yet at the start of the call, BUT the patient can upload a follow-up prescription, OPD note, or lab photo/PDF at ANY moment during this live call using the Attach Follow-Up button.',
                  pastedText ? `Pasted follow-up text / notes:\n${pastedText}` : '',
                  chatContext ? `Earlier follow-up chat notes:\n${chatContext}` : '',
                  'IMPORTANT FILE ACCESS CAPABILITY:',
                  '- You HAVE direct access to the original discharge plan, recent check-ins, and any follow-up report uploaded before or DURING this live call. NEVER tell the user that you cannot read, see, or access their old report, check-ins, or uploaded files.',
                  '- Whenever a `[FOLLOW-UP DOCTOR REPORT UPLOADED]` or `[DISCHARGE REPORT UPLOADED]` message arrives during the call, immediately read the extracted details out loud in a warm tone, compare them against the existing plan and recent check-in summaries, and ask 1 short confirming question.',
                  '- If the user says they uploaded or attached a report and you have not yet referenced it, call `get_uploaded_discharge_report` immediately to fetch the full extracted report.',
                  'YOUR FOLLOW-UP GOAL:',
                  '1. Answer any questions accurately using their original discharge summary, current medicines, and recent daily check-in history.',
                  '2. When a follow-up report is available or described verbally, compare it against their existing medicines and recent check-ins (noting added/stopped/adjusted doses, lab findings, and next appointment) before they click "Update Selected Plan".',
                  '3. Whenever multiple medicines are discussed, call `lookup_drug_interactions`. Whenever symptoms are mentioned, call `escalate_red_flag_alert` and advise emergency care immediately if red flags are present.',
                  '4. Always remind gently that DischargeDost supports the treating doctor’s instructions and never replaces licensed medical care.',
                ]
                  .filter(Boolean)
                  .join('\n')
              : [
                  'You are DischargeDost, a warm, calm, reassuring post-hospital recovery intake assistant on a live voice call.',
                  `Speak naturally and clearly in ${langDesc}. Keep spoken answers concise (2-4 clear sentences per turn).`,
                  attachedReportContext
                    ? `The patient has ALREADY uploaded their hospital discharge report (${attachedReportContext.fileName}). Here are the complete extracted clinical details:\n${attachedReportContext.extractedText}`
                    : 'No discharge report is uploaded yet at the start of the call, BUT the patient can upload a discharge photo or PDF at ANY moment during this live call using the Attach Report button.',
                  pastedText ? `Pasted discharge text / notes:\n${pastedText}` : '',
                  chatContext ? `Earlier intake chat notes:\n${chatContext}` : '',
                  'IMPORTANT FILE ACCESS CAPABILITY:',
                  '- You HAVE direct access to discharge reports (photos and PDFs) uploaded before or DURING this live call. NEVER tell the user that you cannot read, see, or access uploaded files.',
                  '- Whenever a `[DISCHARGE REPORT UPLOADED]` message arrives during the call, immediately read the extracted details out loud in a warm tone, summarize the diagnosis and key medicines you see, and ask 1-2 short clarifying questions.',
                  '- If the user says they uploaded or attached a report and you have not yet referenced it, call `get_uploaded_discharge_report` immediately to fetch the full extracted report.',
                  'YOUR INTAKE GOAL:',
                  '1. Answer any question the patient or caregiver asks clearly and reassuringly.',
                  '2. Once a discharge report is available, review its medicines and ask 1-2 brief clarifying questions before they click "Build Final Recovery Plan" — specifically: (a) any extra home/OTC painkillers or supplements not on the paper, (b) any medicine allergies or usual meal times, and (c) how the patient feels right now.',
                  '3. If no discharge report is attached yet, warmly answer their question and invite them to click "Attach Report" anytime during this call so you can read it together right away.',
                  '4. Whenever the patient mentions multiple medicines, call `lookup_drug_interactions`. Whenever they mention symptoms, call `escalate_red_flag_alert` and advise emergency care immediately if red flags are present.',
                  '5. Always remind gently that DischargeDost supports the treating doctor’s instructions and never replaces licensed medical care.',
                ]
                  .filter(Boolean)
                  .join('\n');
          } else {
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
            const priorChatNotes = typeof msg.chatSummary === 'string' ? msg.chatSummary.trim().slice(0, 2000) : '';

            systemInstruction = [
              'You are DischargeDost, a warm, calm, reassuring post-hospital recovery check-in companion speaking directly with a patient or family caregiver on a live voice call.',
              `Speak naturally and clearly in ${langDesc}. Keep spoken answers concise (2-3 clear sentences per turn) and easy to follow.`,
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
              priorChatNotes ? `Earlier check-in messages already shared before starting voice:\n${priorChatNotes}` : '',
              'INTERACTIVE CHECK-IN & SAFETY RULES:',
              '1. Ask 1-2 gentle clarifying follow-up questions about how they feel today (pain, sleep, appetite, any missed doses) and clearly answer any questions they ask.',
              '2. You support the treating doctor’s discharge instructions and NEVER replace licensed medical care or prescribe new medicines/dosage changes.',
              '3. Whenever the patient describes any physical symptom, missed dose, or side effect, call `escalate_red_flag_alert` to check clinical urgency.',
              '4. If red-flag symptoms (chest pain, breathlessness, bleeding, fainting, high fever, severe low blood sugar) are mentioned, advise contacting the hospital emergency desk or calling emergency services immediately.',
              '5. Do NOT ask repeatedly "would you like me to save?". Once they finish sharing, let them know they can tap Save Check-In below whenever ready. ONLY if they explicitly say "save my check-in now" / "save it", call `save_daily_checkin` with a concise summary of everything they shared.',
            ]
              .filter(Boolean)
              .join('\n');
          }

          const liveTools = isIntakeMode
            ? [{ functionDeclarations: [getUploadedReportTool, lookupDrugTool, escalateRedFlagTool] }]
            : [{ functionDeclarations: [escalateRedFlagTool, saveDailyCheckInTool] }];

          liveSession = await ai.live.connect({
            model: MODEL_LIVE,
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
              },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              tools: liveTools,
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
                  if (call.name === 'get_uploaded_discharge_report') {
                    const reportPayload = attachedReportContext
                      ? {
                          hasReport: true,
                          fileName: attachedReportContext.fileName,
                          reportDetails: attachedReportContext.extractedText,
                        }
                      : {
                          hasReport: false,
                          message:
                            'No discharge report has been uploaded yet. Please invite the patient to click the Attach Report button at the top of the panel.',
                        };
                    liveSession?.sendToolResponse({
                      functionResponses: [
                        {
                          id: call.id,
                          name: call.name,
                          response: { result: reportPayload },
                        },
                      ],
                    });
                  } else if (call.name === 'escalate_red_flag_alert') {
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
                  } else if (call.name === 'save_daily_checkin') {
                    const args = (call.args ?? {}) as { summary?: string };
                    const summaryText = typeof args.summary === 'string' ? args.summary.trim() : '';
                    safeSend({ type: 'requestSaveCheckIn', summary: summaryText });
                    liveSession?.sendToolResponse({
                      functionResponses: [
                        {
                          id: call.id,
                          name: call.name,
                          response: { result: { saved: true } },
                        },
                      ],
                    });
                  } else if (call.name === 'lookup_drug_interactions') {
                    const args = (call.args ?? {}) as { medicineNames?: string[] };
                    const medNames = Array.isArray(args.medicineNames) ? args.medicineNames : [];
                    const interactionResult = lookupDrugInteractions(medNames);
                    liveSession?.sendToolResponse({
                      functionResponses: [
                        {
                          id: call.id,
                          name: call.name,
                          response: { result: interactionResult },
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
            if (isIntakeMode && attachedReportContext) {
              safeSend({
                type: 'attachmentReady',
                fileName: attachedReportContext.fileName,
                summary: attachedReportContext.extractedText,
              });
              const greetingPrompt = isFollowUpSession
                ? `I have attached my doctor's follow-up report (${attachedReportContext.fileName}) to update my existing recovery plan. Please briefly greet me in ${langDesc}, compare the key changes against my original discharge summary and recent daily check-ins, and ask 1 short confirming question before I update my plan.`
                : `I have attached my hospital discharge summary (${attachedReportContext.fileName}). Please briefly greet me in ${langDesc}, confirm the diagnosis and key medicines you see on it, and ask 1-2 short clarifying questions if anything else is needed before building my final recovery plan.`;
              try {
                liveSession.sendClientContent({
                  turns: [{ role: 'user', parts: [{ text: greetingPrompt }] }],
                  turnComplete: true,
                });
              } catch {
                liveSession.sendRealtimeInput({ text: greetingPrompt });
              }
            } else if (isIntakeMode && isFollowUpSession) {
              const followUpGreeting = `I am calling in Follow-Up mode to update my existing recovery plan. Please warmly greet me in ${langDesc} in 1-2 short sentences, confirm you have my original discharge plan and recent check-in history ready, and ask what the doctor changed or invite me to attach the follow-up report.`;
              try {
                liveSession.sendClientContent({
                  turns: [{ role: 'user', parts: [{ text: followUpGreeting }] }],
                  turnComplete: true,
                });
              } catch {
                liveSession.sendRealtimeInput({ text: followUpGreeting });
              }
            } else if (!isIntakeMode) {
              const priorNotes = typeof msg.chatSummary === 'string' ? msg.chatSummary.trim() : '';
              const checkInGreeting = priorNotes
                ? `I just started a live voice check-in continuing our chat. Please briefly greet me in ${langDesc}, acknowledge what I already shared, and ask one gentle follow-up question.`
                : `I just started my daily recovery check-in call. Please warmly greet me in ${langDesc} in 1-2 short sentences and ask how the patient is feeling today.`;
              try {
                liveSession.sendClientContent({
                  turns: [{ role: 'user', parts: [{ text: checkInGreeting }] }],
                  turnComplete: true,
                });
              } catch {
                liveSession.sendRealtimeInput({ text: checkInGreeting });
              }
            }
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

      if (msg.type === 'attachment' && isIntakeMode && liveSession && !isClosed) {
        const cleanedDoc = validateBase64Payload(msg.data, 12 * 1024 * 1024);
        const fileName =
          typeof msg.fileName === 'string' && msg.fileName.trim()
            ? msg.fileName.trim().slice(0, 160)
            : 'discharge_report';
        const rawMime = typeof msg.mimeType === 'string' ? msg.mimeType : '';
        const normalizedMime =
          rawMime === 'image/jpg'
            ? 'image/jpeg'
            : /^(image\/(png|jpeg|webp)|application\/pdf)$/.test(rawMime)
            ? rawMime
            : fileName.toLowerCase().endsWith('.pdf')
            ? 'application/pdf'
            : 'image/jpeg';

        if (!cleanedDoc) {
          safeSend({
            type: 'attachmentError',
            message: 'The uploaded discharge report is too large or invalid. Please use a photo or PDF under 12 MB.',
          });
          return;
        }

        safeSend({ type: 'attachmentProcessing', fileName });

        try {
          const ai = getGeminiClient();
          const extractedText = await extractDischargeReportForLive(
            ai,
            cleanedDoc,
            normalizedMime,
            fileName,
          );

          if (isClosed || !liveSession) return;

          if (!extractedText) {
            safeSend({
              type: 'attachmentError',
              message: 'Could not read text from the uploaded discharge report. Please try a clearer image or PDF.',
            });
            return;
          }

          attachedReportContext = { fileName, extractedText };

          const liveReportPrompt = isFollowUpSession
            ? [
                `[FOLLOW-UP DOCTOR REPORT UPLOADED: ${fileName}]`,
                'The patient just uploaded their doctor follow-up report / lab result / updated prescription during this live call. Here is the complete clinical content extracted from the document:',
                extractedText,
                '',
                `Please respond out loud right now in ${activeLangDesc}: warmly confirm you have received and read their follow-up report, briefly compare the main changes (medicines, labs, or appointments) against their original discharge plan and recent daily check-ins, and ask 1 short confirming question before they click Update Selected Plan.`,
              ].join('\n')
            : [
                `[DISCHARGE REPORT UPLOADED: ${fileName}]`,
                'The patient just uploaded their hospital discharge summary during this live call. Here is the complete clinical content extracted from the document:',
                extractedText,
                '',
                `Please respond out loud right now in ${activeLangDesc}: warmly confirm you have received and read their discharge report, briefly summarize the diagnosis and key medicines listed, and ask 1-2 short clarifying questions (such as any extra home painkillers/OTCs, allergies, or how the patient is feeling today) before they build their final daily plan.`,
              ].join('\n');

          try {
            liveSession.sendClientContent({
              turns: [{ role: 'user', parts: [{ text: liveReportPrompt }] }],
              turnComplete: true,
            });
          } catch {
            liveSession.sendRealtimeInput({ text: liveReportPrompt });
          }

          safeSend({
            type: 'attachmentReady',
            fileName,
            summary: extractedText,
          });
        } catch (extractErr) {
          console.error('Mid-call discharge extraction error:', extractErr);
          safeSend({
            type: 'attachmentError',
            message: 'Could not read the uploaded discharge report during the call. Please try again.',
          });
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
