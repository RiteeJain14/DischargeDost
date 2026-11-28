# DischargeDost — Multilingual Post-Hospital Recovery Companion

**DischargeDost** transforms dense hospital discharge summaries, follow-up prescriptions, and lab reports into clear, family-friendly daily medicine schedules, verified drug-interaction warnings, interactive multilingual voice & text check-ins, and structured clinic-ready SBAR doctor handovers.

Built for families managing recovery at home across **English**, **Hindi (हिन्दी)**, **Tamil (தமிழ்)**, and **Bengali (বাংলা)**.

---

## The Problem

When a patient leaves the hospital, families are handed multi-page discharge summaries packed with clinical shorthand (`1-0-1`, `BBF`, `HS`, `DAPT`), overlapping drug timings, diet restrictions, and vague warning signs. Misreading a single instruction—such as taking an over-the-counter NSAID painkiller alongside post-stent blood thinners or taking thyroid/acid-suppressant pills after tea—leads to preventable complications and hospital readmissions. Language barriers make it even harder for elderly patients and home caregivers to follow care instructions confidently.

---

## Key Features

### 1. Multimodal Discharge & Follow-Up Intake (Photo, PDF, Medicine Camera & Live Voice)
- **Upload or Drag-and-Drop**: Accepts discharge summary photos (PNG/JPEG/WebP) and PDFs, plus a built-in one-click sample Apollo Cardiology discharge report for instant testing.
- **Interactive Clarifying Chat & Live Voice Call**: Before generating the final schedule, DischargeDost asks concise clarifying questions (home/OTC painkillers, allergies, meal times) via text chat or real-time bidirectional Live Voice—and can read reports uploaded *mid-call*.
- **Medicine Strip Camera Scanner**: Snap or upload a medicine strip photo directly from the intake bar to identify the medicine name, purpose, and timing guidance.
- **Add Follow-Up Doctor Reports**: Select any saved recovery plan to upload subsequent OPD prescriptions, lab results, or doctor adjustments. Follow-Up chat, Live Voice, and the merge engine receive full clinical continuity—including the original discharge summary, current medicines, recent Daily Check-In summaries, and previous follow-up reports—then automatically re-run drug interaction screening and update the active plan.

### 2. Personalized Daily Recovery Plan & Verified Clinical Safety Screening
- **Meal-Anchored Daily Timeline**: Organizes prescriptions into clear daily slots (Morning Before Breakfast, Morning After Breakfast, Afternoon, Evening, Bedtime) with plain-language explanations and one-tap dose tracking synced to Firestore.
- **Verified Clinical Function Calling**: Uses server-side clinical tools (`lookup_drug_interactions` and `escalate_red_flag_alert`) to flag high-risk drug interactions (e.g., NSAIDs + dual antiplatelet therapy) and timing conflicts (e.g., empty-stomach spacing).
- **Audio Read-Aloud**: Plays clear spoken summaries of the daily recovery plan in the patient's chosen language.
- **Instant 4-Language Switching**: Switch between English, हिन्दी, தமிழ், and বাংলা at any time in the header—plans, schedules, alerts, chat, voice, and audio adapt together.

### 3. Interactive Daily Check-In (Text Chat, Voice Notes & Live Voice)
- **Conversational Symptom Triage**: Patients or caregivers chat or start a real-time Live Voice call inside the Daily Check-In console to discuss symptoms, missed doses, or recovery questions.
- **Voice Note Transcription**: Record a voice note to transcribe directly into the check-in composer.
- **Single-Click & Voice-Confirmed Logging**: Save the complete interactive check-in with one button (or confirm verbally during chat/voice) to run structured red-flag triage (`stable`, `caution`, `red_flag`) and append it to the patient's longitudinal recovery timeline.

### 4. Structured Clinician Handover Brief & A4 PDF Export
- **One-Page English SBAR Summary**: Synthesizes the original discharge episode, current medicine list, today's adherence, flagged drug interactions, follow-up doctor report history, and longitudinal check-in alerts into an English SBAR brief for the next OPD visit.
- **Structured A4 PDF & Copy-to-Clipboard**: Generates a clean, paginated multi-section clinical PDF (`jsPDF` + `jspdf-autotable`) ready to print or share on WhatsApp/email.

---

## Architecture & Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, `jsPDF` + `jspdf-autotable`
- **Backend**: Node.js, Express, WebSocket (`ws`) proxy for Gemini Live API audio streaming
- **AI & Multimodal Engine (`@google/genai`)**:
  - **Multimodal Vision, Structured JSON & Function Calling**: `gemini-4-hydrogen` (discharge/follow-up analysis, clinical tool execution, interactive chat, medicine photo identification, multilingual translation)
  - **Real-Time Bidirectional Live Voice**: `gemini-3.8-live` (16 kHz PCM microphone capture + 24 kHz PCM audio playback, mid-call document reading, live tool calls)
  - **Speech Transcription**: `gemini-3.5-transcribe` (voice-note transcription for daily check-ins)
  - **Multilingual Read-Aloud TTS**: `gemini-3.8-flash-lite-tts` (spoken daily plan audio summaries)
- **Persistence & Authentication**: Firebase Authentication (Google Sign-In) & Cloud Firestore with strict owner-scoped security rules (`firestore.rules`) across `/users/{uid}`, `/recoveryPlans/{planId}`, `/checkIns`, `/followUps`, and `/doseLogs`.

---

## Project Structure

```text
├── server.ts                       # Express API routes + WebSocket Live API proxy
├── server/
│   └── clinicalTools.ts            # Deterministic drug interaction & red-flag triage tools
├── src/
│   ├── App.tsx                     # App state, Firebase sync, navigation, follow-up & check-in orchestration
│   ├── types.ts                    # Shared TypeScript interfaces & 4-language UI copy
│   ├── lib/
│   │   ├── firebase.ts             # Firebase Auth & Firestore helpers
│   │   └── sampleDischarge.ts      # Built-in sample hospital discharge image generator
│   └── components/
│       ├── TopBar.tsx              # DischargeDost header, navigation tabs, language switcher & auth
│       ├── UploadWorkspace.tsx     # First-page intake workspace
│       ├── FrontIntakePanel.tsx    # Interactive intake & follow-up chat, Live Voice, camera scanner
│       ├── DailyPlanView.tsx       # Meal-anchored medicine schedule, safety radar, diet/activity & follow-ups
│       ├── DailyCheckInView.tsx    # Interactive check-in chat, voice transcription & embedded Live Voice
│       └── ClinicianBriefView.tsx  # English SBAR doctor brief & structured A4 PDF export
├── public/
│   ├── dischargedost-icon.png      # 512x512 square app icon
│   └── dischargedost-card-560x280.png  # 560x280 thumbnail card
├── firestore.rules                 # Hardened Firestore security rules
└── firebase-blueprint.json         # Firestore schema & collection blueprint
```

---

## Local Development

### Prerequisites
- Node.js 20+
- A Gemini API key (`GEMINI_API_KEY`)
- Firebase project configuration in `firebase-applet-config.json` (optional: app also supports local guest preview mode)

### Setup & Run

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# Add your GEMINI_API_KEY inside .env

# 3. Start the full-stack dev server (Express + Vite on port 3000)
npm run dev

# 4. Type-check and build for production
npm run lint
npm run build
```

---

## Clinical Safety Disclaimer

DischargeDost is a post-hospital organization and communication companion designed to support—never replace—licensed medical care. It never prescribes new medicines or dosage changes, and immediately directs patients to seek emergency medical care whenever red-flag symptoms are detected.
