export type LanguageCode = 'en' | 'hi' | 'ta' | 'bn';

export type MedicineSlot =
  | 'morning_before'
  | 'morning_after'
  | 'afternoon'
  | 'evening'
  | 'bedtime'
  | 'as_needed';

export interface MedicineItem {
  name: string;
  dose: string;
  slot: MedicineSlot;
  timeLabel: string;
  duration: string;
  purpose: string;
  foodRule: string;
}

export interface DrugConflict {
  pair: string;
  severity: 'high' | 'moderate' | 'timing';
  explanation: string;
  recommendation: string;
}

export interface DietPlan {
  allowed: string[];
  avoid: string[];
  hydrationGoal: string;
}

export interface RecoveryPlan {
  id: string;
  ownerId?: string;
  title: string;
  hospitalName: string;
  dischargeDate: string;
  patientContext: string;
  language: LanguageCode;
  plainSummary: string;
  medicines: MedicineItem[];
  conflicts: DrugConflict[];
  dietPlan: DietPlan;
  activityRules: string[];
  redFlags: string[];
  followUpAppointments: string[];
  clinicianNote: string;
  status: 'active' | 'archived';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DailyCheckIn {
  id: string;
  planId: string;
  ownerId?: string;
  checkInDate: string;
  inputMode: 'text' | 'voice';
  language: LanguageCode;
  symptomNote: string;
  medicinesTaken: string[];
  severity: 'stable' | 'caution' | 'red_flag';
  guidance: string;
  matchedRedFlags: string[];
  clinicianAlertSummary: string;
  createdAtLabel?: string;
}

export type FollowUpReportType = 'opd_note' | 'lab_report' | 'prescription_update' | 'other';

export interface FollowUpReport {
  id: string;
  planId: string;
  ownerId?: string;
  reportDate: string;
  doctorOrClinic: string;
  reportType: FollowUpReportType;
  language: LanguageCode;
  summary: string;
  changes: string[];
  clinicianSummary: string;
  createdAtLabel?: string;
}

export interface ToolCallRecord {
  name: string;
  args: unknown;
  result: unknown;
}

export const LANGUAGE_OPTIONS: Array<{ code: LanguageCode; label: string; nativeLabel: string }> = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা' },
];

export const SLOT_LABELS: Record<LanguageCode, Record<MedicineSlot, string>> = {
  en: {
    morning_before: 'Morning · Before Breakfast',
    morning_after: 'Morning · After Breakfast',
    afternoon: 'Afternoon · Lunch',
    evening: 'Evening · Dinner',
    bedtime: 'Bedtime',
    as_needed: 'Only If Needed (SOS)',
  },
  hi: {
    morning_before: 'सुबह · नाश्ते से पहले',
    morning_after: 'सुबह · नाश्ते के बाद',
    afternoon: 'दोपहर · खाने के साथ',
    evening: 'शाम · रात के खाने के साथ',
    bedtime: 'सोने से पहले',
    as_needed: 'जरूरत पड़ने पर (SOS)',
  },
  ta: {
    morning_before: 'காலை · உணவுக்கு முன்',
    morning_after: 'காலை · உணவுக்குப் பின்',
    afternoon: 'மதியம் · உணவுடன்',
    evening: 'மாலை · இரவு உணவு',
    bedtime: 'தூங்குவதற்கு முன்',
    as_needed: 'தேவைப்படும்போது மட்டும்',
  },
  bn: {
    morning_before: 'সকাল · নাস্তার আগে',
    morning_after: 'সকাল · নাস্তার পরে',
    afternoon: 'দুপুর · খাবারের সাথে',
    evening: 'সন্ধ্যা · রাতের খাবার',
    bedtime: 'ঘুমানোর আগে',
    as_needed: 'শুধুমাত্র প্রয়োজনে (SOS)',
  },
};

export interface UiCopyStrings {
  // Navigation & Header
  navUpload: string;
  navPlan: string;
  navCheckIn: string;
  navClinician: string;
  signInGoogle: string;
  signOut: string;
  languageLabel: string;
  translatingPlan: string;
  savedPlansLabel: string;
  guestPreviewNotice: string;
  saveToFirestore: string;

  // Upload Workspace
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  step1Title: string;
  step1Desc: string;
  step2Title: string;
  step2Desc: string;
  step3Title: string;
  step3Desc: string;
  fallbackHeroTitle: string;
  fallbackHeroSub: string;
  uploadCardTitle: string;
  uploadCardSub: string;
  dropzonePrompt: string;
  dropzoneHint: string;
  selectedFileLabel: string;
  loadSampleBtn: string;
  clearFileBtn: string;
  readyForVision: string;
  notesLabel: string;
  notesHint: string;
  notesPlaceholder: string;
  analyzeBtn: string;
  analyzingBtn: string;

  // Daily Plan
  medicinesCountLabel: string;
  listenPlan: string;
  stopAudio: string;
  plainSummaryTitle: string;
  scheduleTitle: string;
  conflictsTitle: string;
  flaggedCountLabel: string;
  severityHigh: string;
  severityTiming: string;
  severityModerate: string;
  nextStepLabel: string;
  dietTitle: string;
  eatFreely: string;
  avoidFoods: string;
  hydrationLabel: string;
  activityTitle: string;
  redFlagsTitle: string;
  followUpsTitle: string;
  markTaken: string;
  takenLabel: string;
  toolChecksSummary: string;

  // Daily Check-In & Live Call
  checkInHeading: string;
  checkInSub: string;
  dosesLoggedToday: string;
  quickSampleLabel: string;
  symptomPlaceholder: string;
  recordVoice: string;
  stopRecording: string;
  voiceRecordedReady: string;
  micDeniedMsg: string;
  submitCheckIn: string;
  checkingSymptomsBtn: string;
  redFlagBannerTitle: string;
  cautionBannerTitle: string;
  stableBannerTitle: string;
  listenBtn: string;
  playingBtn: string;
  openClinicianBriefBtn: string;
  patientReportLabel: string;
  triggeredFlagsLabel: string;
  clinicianSbarLabel: string;
  checkInHistoryTitle: string;
  entriesCountLabel: string;
  noCheckInsYet: string;
  voiceCheckInTag: string;
  textCheckInTag: string;
  statusRedFlag: string;
  statusCaution: string;
  statusStable: string;

  liveCallTitle: string;
  liveCallSub: string;
  startLiveCall: string;
  endLiveCall: string;
  muteMic: string;
  unmuteMic: string;
  liveCallConnecting: string;
  liveCallReady: string;
  saveCallCheckIn: string;
  lastCallTranscript: string;
  assistantSpeaking: string;
  micMutedStatus: string;
  liveCallHint: string;
  typedQueryPlaceholder: string;
  sendBtn: string;
  urgentCallFlag: string;
  cautionCallFlag: string;
  micRequiredError: string;
  wsError: string;

  // Clinician Brief
  briefEyebrow: string;
  briefTitle: string;
  copyBrief: string;
  copiedBrief: string;
  printBrief: string;
  dischargeDateLabel: string;
  todaysAdherenceLabel: string;
  dosesTakenSuffix: string;
  latestTriageLabel: string;
  noCheckInYetLabel: string;
  clinicalSbarTitle: string;
  latestAlertTitle: string;
  medAuditTitle: string;
  colMedicine: string;
  colDose: string;
  colSlot: string;
  colInstruction: string;

  // Front-Page Interactive Intake
  intakeAssistantTitle: string;
  intakeAssistantSub: string;
  intakeGreetingNoFile: string;
  intakePlaceholder: string;
  intakeBuildFinalPlan: string;
  intakeQuickBuild: string;
  intakeReadyBanner: string;
  intakeUploadHint: string;
  intakeChipPainkiller: string;
  intakeChipAskFood: string;
  intakeChipSample: string;
  intakeReviewingAttachment: string;
  attachFileBtn: string;
  homeHeadline: string;
  homeLead: string;
  homeFlow1Title: string;
  homeFlow1Desc: string;
  homeFlow2Title: string;
  homeFlow2Desc: string;
  homeFlow3Title: string;
  homeFlow3Desc: string;
  homeSampleCardTitle: string;
  homeSampleCardMeta: string;
  homeTrySampleCta: string;
  homeDropStripLabel: string;
  homeSpeakerYou: string;
  homePreviewSectionTitle: string;
  homePreviewSectionSub: string;
  homePreviewTableTitle: string;
  homePreviewColRx: string;
  homePreviewColPlain: string;
  homePreviewTestLink: string;
  homeCapability1Title: string;
  homeCapability1Desc: string;
  homeCapability2Title: string;
  homeCapability2Desc: string;
  homeCapability3Title: string;
  homeCapability3Desc: string;
  scanMedicineCameraTitle: string;
  scanningMedicineMsg: string;
  medicineIdentifiedLabel: string;
  previewTabSchedule: string;
  previewTabSafety: string;
  previewTabDoctor: string;
  openCameraOption: string;
  uploadMedicineOption: string;
  capturePhotoBtn: string;
  cancelCameraBtn: string;
  cameraPermissionError: string;

  // Global Footer / Safety
  disclaimer: string;
}

export const UI_COPY: Record<LanguageCode, UiCopyStrings> = {
  en: {
    navUpload: 'Upload',
    navPlan: 'Daily Plan',
    navCheckIn: 'Check-In',
    navClinician: 'Clinician Brief',
    signInGoogle: 'Sign In with Google',
    signOut: 'Sign Out',
    languageLabel: 'Language',
    translatingPlan: 'Translating recovery plan...',
    savedPlansLabel: 'Saved Recovery Plans:',
    guestPreviewNotice:
      'Previewing in current browser session. Sign in with Google to save schedules and check-in history to Firestore.',
    saveToFirestore: 'Save to Firestore',

    heroEyebrow: 'Post-Hospital Home Recovery',
    heroTitle: 'Turn dense discharge papers into a clear daily recovery plan',
    heroSubtitle:
      'Upload a photo of your hospital discharge summary or prescription. DischargeDost reads medicines, checks for drug and timing conflicts, explains care rules in your family’s language, and tracks daily symptom check-ins.',
    step1Title: 'Upload Photo or PDF',
    step1Desc: 'Any hospital summary sheet or handwritten prescription photo.',
    step2Title: 'Drug & Timing Check',
    step2Desc: 'Screens medicine pairs and meal spacing automatically.',
    step3Title: 'Daily Red-Flag Watch',
    step3Desc: 'Live call, voice, or text check-ins with clinician handover notes.',
    fallbackHeroTitle: 'Clear Home Recovery Companion',
    fallbackHeroSub: 'Multilingual medicine schedules and daily check-ins',
    uploadCardTitle: 'Upload Discharge Summary',
    uploadCardSub:
      'Upload a photo or PDF of the hospital discharge paper, or try the sample summary below.',
    dropzonePrompt: 'Click to upload or drag and drop discharge photo / PDF',
    dropzoneHint: 'Supports PNG, JPG, WebP, or PDF up to 12 MB',
    selectedFileLabel: 'Selected:',
    loadSampleBtn: 'Load Sample Discharge Photo',
    clearFileBtn: 'Clear File',
    readyForVision: 'Ready to analyze',
    notesLabel: 'Additional Notes or Pasted Text (Optional)',
    notesHint:
      'Add any extra clinic prescription lines, over-the-counter painkillers the patient takes at home, or paste text directly if you don’t have a photo.',
    notesPlaceholder:
      'Example: Patient also takes Ibuprofen 400mg for knee pain, or paste discharge summary text here...',
    analyzeBtn: 'Build Recovery Plan',
    analyzingBtn: 'Extracting & Checking Conflicts...',

    medicinesCountLabel: 'Medicines',
    listenPlan: 'Listen Aloud',
    stopAudio: 'Stop Audio',
    plainSummaryTitle: 'What Happened & Your Recovery Goal',
    scheduleTitle: 'Daily Medicine Schedule',
    conflictsTitle: 'Medicine & Timing Checks',
    flaggedCountLabel: 'flagged',
    severityHigh: 'High Priority Interaction',
    severityTiming: 'Timing Separation Needed',
    severityModerate: 'Moderate Caution',
    nextStepLabel: 'Next step:',
    dietTitle: 'Diet & Hydration Plan',
    eatFreely: 'Recommended Foods',
    avoidFoods: 'Avoid During Recovery',
    hydrationLabel: 'Fluid Guidance',
    activityTitle: 'Activity & Wound Care',
    redFlagsTitle: 'Go to Hospital Immediately If You Notice',
    followUpsTitle: 'Follow-Up Visits',
    markTaken: 'Mark Taken',
    takenLabel: 'Taken',
    toolChecksSummary: 'Verified clinical tool checks executed',

    checkInHeading: 'Daily Symptom & Recovery Check-In',
    checkInSub: 'Speak or type how the patient feels today. Urgent red flags are escalated immediately.',
    dosesLoggedToday: 'Today’s doses logged:',
    quickSampleLabel: 'Quick sample responses:',
    symptomPlaceholder:
      'Describe how the patient feels today (pain, fever, swelling, breathing, appetite, dizziness, or missed medicines)...',
    recordVoice: 'Record Voice Note',
    stopRecording: 'Stop Recording',
    voiceRecordedReady: 'Voice note recorded and ready to transcribe',
    micDeniedMsg: 'Microphone permission denied or unavailable. You can type symptoms below.',
    submitCheckIn: 'Evaluate Check-In',
    checkingSymptomsBtn: 'Checking Symptoms...',
    redFlagBannerTitle: 'Red Flag Alert — Urgent Medical Review Advised',
    cautionBannerTitle: 'Caution — Monitor Closely & Call Clinic Today',
    stableBannerTitle: 'Stable Check-In — Continue Recovery Plan',
    listenBtn: 'Listen',
    playingBtn: 'Playing...',
    openClinicianBriefBtn: 'Open Clinician Brief',
    patientReportLabel: 'Patient report:',
    triggeredFlagsLabel: 'Triggered Warning Signs:',
    clinicianSbarLabel: 'Clinician SBAR Summary (English):',
    checkInHistoryTitle: 'Check-In History',
    entriesCountLabel: 'entries',
    noCheckInsYet: 'No check-ins recorded yet. Submit today’s symptom report above to start tracking recovery.',
    voiceCheckInTag: 'Voice check-in',
    textCheckInTag: 'Text check-in',
    statusRedFlag: 'Red Flag Alert',
    statusCaution: 'Caution',
    statusStable: 'Stable',

    liveCallTitle: 'Live Voice Care Companion',
    liveCallSub:
      'Start a real-time call to ask questions about medicines, food timing, or how you feel today.',
    startLiveCall: 'Start Live Call',
    endLiveCall: 'End Call',
    muteMic: 'Mute Mic',
    unmuteMic: 'Unmute Mic',
    liveCallConnecting: 'Connecting live voice call...',
    liveCallReady: 'Call active — speak naturally anytime',
    saveCallCheckIn: 'End & Save to Check-Ins',
    lastCallTranscript: 'Last call transcript',
    assistantSpeaking: 'DischargeDost is speaking...',
    micMutedStatus: 'Microphone muted',
    liveCallHint:
      'Ask any question out loud — e.g. “Can I take my evening tablet with tea?” or “Why am I feeling dizzy?”',
    typedQueryPlaceholder: 'Or type a question during the call...',
    sendBtn: 'Send',
    urgentCallFlag: 'Urgent Warning Sign Detected During Call',
    cautionCallFlag: 'Symptom Caution Flagged During Call',
    micRequiredError: 'Microphone permission is required for a live voice call.',
    wsError: 'Unable to maintain live voice connection.',

    briefEyebrow: 'ENGLISH SBAR HANDOVER',
    briefTitle: 'Clinician Recovery Brief',
    copyBrief: 'Copy Brief',
    copiedBrief: 'Copied',
    printBrief: 'Print / Save PDF',
    dischargeDateLabel: 'Discharge Date',
    todaysAdherenceLabel: 'Today’s Adherence',
    dosesTakenSuffix: 'doses taken',
    latestTriageLabel: 'Latest Triage Status',
    noCheckInYetLabel: 'No Check-In Yet',
    clinicalSbarTitle: 'Clinical SBAR Summary',
    latestAlertTitle: 'Latest Patient Check-In Alert',
    medAuditTitle: 'Medication & Conflict Audit',
    colMedicine: 'Medicine',
    colDose: 'Dose',
    colSlot: 'Slot',
    colInstruction: 'Instruction',

    intakeAssistantTitle: 'Interactive Recovery Assistant',
    intakeAssistantSub: 'Chat, ask questions by live voice, or attach your discharge report — I’ll check if anything else is needed before creating your final plan.',
    intakeGreetingNoFile: 'Hello! Ask me any question about hospital discharge medicines or recovery, start a live voice call above, or attach your discharge summary so I can build your personalized daily plan.',
    intakePlaceholder: 'Ask a question, mention extra home medicines, or reply to DischargeDost...',
    intakeBuildFinalPlan: 'Build Final Recovery Plan',
    intakeQuickBuild: 'Build Plan Now',
    intakeReadyBanner: 'Everything needed is ready — click to generate your personalized Daily Plan.',
    intakeUploadHint: 'Attach a discharge photo/PDF or type your medicines above to build your daily plan.',
    intakeChipPainkiller: 'Can I take Ibuprofen with blood thinners?',
    intakeChipAskFood: 'Which tablets go before vs. after food?',
    intakeChipSample: 'Load sample discharge & review it',
    intakeReviewingAttachment: 'Reviewing your discharge report and checking what else may be needed...',
    attachFileBtn: 'Attach Report',
    homeHeadline: 'Your AI recovery friend turning discharge papers into daily care.',
    homeLead:
      'Speak on a live voice call, scan any medicine strip, or attach your discharge summary — DischargeDost screens drug conflicts and turns clinical shorthand into a clear family recovery plan.',
    homeFlow1Title: '01. Speak or Attach Paper',
    homeFlow1Desc: 'Ask questions by live voice, chat, or drop any discharge photo or PDF.',
    homeFlow2Title: '02. Quick Safety Check',
    homeFlow2Desc: 'Screens OTC painkillers, allergies, and before/after-food rules first.',
    homeFlow3Title: '03. Daily Schedule & Doctor Brief',
    homeFlow3Desc: 'Get a meal-timed tablet checklist, red-flag watch, and English SBAR note.',
    homeSampleCardTitle: 'Apollo Cardiology Sample Sheet',
    homeSampleCardMeta: 'Post-Angioplasty · 5 Medicines · Conflict Demo',
    homeTrySampleCta: 'Try Sample',
    homeDropStripLabel: 'Drop discharge photo or PDF here, or click to attach (PNG, JPG, WebP, PDF)',
    homeSpeakerYou: 'You',
    homePreviewSectionTitle: 'What your personalized recovery plan delivers',
    homePreviewSectionSub: 'Every dense hospital line is verified for drug interactions and organized around real family meal times.',
    homePreviewTableTitle: 'Example Clinical Translation & Conflict Check',
    homePreviewColRx: 'Discharge Shorthand',
    homePreviewColPlain: 'Family Schedule & Safety Guidance',
    homePreviewTestLink: 'Load this sample into the assistant above',
    homeCapability1Title: '4 Native Languages, One Switch',
    homeCapability1Desc: 'Switch between English, हिन्दी, தமிழ், and বাংলা in the header — schedules, warnings, and audio adapt together.',
    homeCapability2Title: 'Verified Drug & Timing Screening',
    homeCapability2Desc: 'Flags risky home combinations (such as NSAID painkillers with blood thinners) and separates incompatible doses.',
    homeCapability3Title: 'Clinic-Ready SBAR Handover',
    homeCapability3Desc: 'Generates a concise one-page English summary of adherence and symptoms for your follow-up doctor visit.',
    scanMedicineCameraTitle: 'Open camera or upload a medicine photo',
    scanningMedicineMsg: 'Reading medicine label & checking its use...',
    medicineIdentifiedLabel: 'Medicine Identified',
    previewTabSchedule: 'Daily Timeline',
    previewTabSafety: 'Safety Radar',
    previewTabDoctor: 'Doctor Brief',
    openCameraOption: 'Open Camera',
    uploadMedicineOption: 'Upload Medicine Photo',
    capturePhotoBtn: 'Capture Photo',
    cancelCameraBtn: 'Cancel',
    cameraPermissionError: 'Camera access was denied or unavailable. Use “Upload Medicine Photo” instead.',

    disclaimer: 'Supports your doctor’s discharge advice and never replaces licensed medical care.',
  },
  hi: {
    navUpload: 'अपलोड',
    navPlan: 'दैनिक योजना',
    navCheckIn: 'दैनिक जांच',
    navClinician: 'डॉक्टर सारांश',
    signInGoogle: 'Google से साइन इन करें',
    signOut: 'साइन आउट',
    languageLabel: 'भाषा',
    translatingPlan: 'योजना का अनुवाद हो रहा है...',
    savedPlansLabel: 'सहेजी गई योजनाएँ:',
    guestPreviewNotice:
      'आप अभी बिना साइन इन के देख रहे हैं। दवाइयों और जांच का रिकॉर्ड सेव करने के लिए Google से साइन इन करें।',
    saveToFirestore: 'Firestore में सेव करें',

    heroEyebrow: 'अस्पताल के बाद घर पर देखभाल · English, हिन्दी, தமிழ், বাংলা',
    heroTitle: 'अस्पताल के डिस्चार्ज पेपर को आसान दैनिक देखभाल योजना में बदलें',
    heroSubtitle:
      'अपने डिस्चार्ज सारांश या पर्चे की फोटो अपलोड करें। DischargeDost दवाइयाँ पढ़ता है, टकराव की जांच करता है, आपकी भाषा में नियम समझाता है और रोज़ की तबीयत ट्रैक करता है।',
    step1Title: 'फोटो या PDF अपलोड करें',
    step1Desc: 'अस्पताल का कोई भी डिस्चार्ज पेपर या हाथ से लिखा पर्चा।',
    step2Title: 'दवा और समय की जांच',
    step2Desc: 'दवाइयों के टकराव और खाने के सही समय की जांच।',
    step3Title: 'दैनिक चेतावनी निगरानी',
    step3Desc: 'डॉक्टर नोट्स के साथ लाइव कॉल, आवाज़ या टेक्स्ट जांच।',
    fallbackHeroTitle: 'आसान घरेलू देखभाल सहायक',
    fallbackHeroSub: 'बहुभाषी दवा समय-सारिणी और दैनिक जांच',
    uploadCardTitle: 'डिस्चार्ज सारांश अपलोड करें',
    uploadCardSub:
      'डिस्चार्ज पेपर की फोटो या PDF अपलोड करें, या नीचे दिए गए नमूना पेपर से आज़माएँ।',
    dropzonePrompt: 'अपलोड करने के लिए क्लिक करें या फोटो / PDF यहाँ छोड़ें',
    dropzoneHint: '12 MB तक PNG, JPG, WebP, या PDF समर्थित',
    selectedFileLabel: 'चुनी गई फ़ाइल:',
    loadSampleBtn: 'नमूना डिस्चार्ज फोटो लोड करें',
    clearFileBtn: 'फ़ाइल हटाएँ',
    readyForVision: 'विश्लेषण के लिए तैयार',
    notesLabel: 'अतिरिक्त नोट्स या पेस्ट किया गया टेक्स्ट (वैकल्पिक)',
    notesHint:
      'यदि मरीज़ घर पर कोई और दर्द निवारक दवा लेते हैं तो लिखें, या फोटो न होने पर डिस्चार्ज टेक्स्ट सीधे पेस्ट करें।',
    notesPlaceholder:
      'उदाहरण: मरीज़ घुटने के दर्द के लिए Ibuprofen 400mg भी लेते हैं, या यहाँ डिस्चार्ज टेक्स्ट पेस्ट करें...',
    analyzeBtn: 'रिकवरी योजना बनाएँ',
    analyzingBtn: 'जानकारी पढ़ी और जांची जा रही है...',

    medicinesCountLabel: 'दवाइयाँ',
    listenPlan: 'सुनकर समझें',
    stopAudio: 'ऑडियो रोकें',
    plainSummaryTitle: 'अस्पताल से छुट्टी का आसान सारांश',
    scheduleTitle: 'रोज़ की दवाइयों का समय',
    conflictsTitle: 'दवाइयों के टकराव और सावधानियाँ',
    flaggedCountLabel: 'चेतावनी',
    severityHigh: 'उच्च प्राथमिकता टकराव',
    severityTiming: 'समय का अंतर ज़रूरी',
    severityModerate: 'मध्यम सावधानी',
    nextStepLabel: 'अगला कदम:',
    dietTitle: 'खान-पान और पानी के नियम',
    eatFreely: 'क्या खा सकते हैं',
    avoidFoods: 'किन चीज़ों से बचें',
    hydrationLabel: 'पानी और तरल सलाह',
    activityTitle: 'आराम और दिनचर्या के नियम',
    redFlagsTitle: 'ये लक्षण दिखें तो तुरंत डॉक्टर/अस्पताल जाएँ',
    followUpsTitle: 'अगली डॉक्टर जांच',
    markTaken: 'ली गई लिखें',
    takenLabel: 'ली गई',
    toolChecksSummary: 'सत्यापित क्लिनिकल टूल जांच पूर्ण',

    checkInHeading: 'आज की तबीयत और लक्षण जांच',
    checkInSub: 'बोलकर या लिखकर बताएं कि मरीज़ आज कैसा महसूस कर रहे हैं। गंभीर लक्षण तुरंत पहचाने जाते हैं।',
    dosesLoggedToday: 'आज की दर्ज खुराक:',
    quickSampleLabel: 'त्वरित नमूना उत्तर:',
    symptomPlaceholder:
      'बताएं मरीज़ आज कैसा महसूस कर रहे हैं (दर्द, बुखार, सूजन, सांस, भूख, चक्कर, या छूटी हुई दवा)...',
    recordVoice: 'आवाज़ रिकॉर्ड करें',
    stopRecording: 'रिकॉर्डिंग रोकें',
    voiceRecordedReady: 'आवाज़ रिकॉर्ड हो गई है और भेजने के लिए तैयार है',
    micDeniedMsg: 'माइक की अनुमति नहीं मिली। आप नीचे लक्षण लिख सकते हैं।',
    submitCheckIn: 'जांच भेजें',
    checkingSymptomsBtn: 'लक्षण जांचे जा रहे हैं...',
    redFlagBannerTitle: 'खतरे का संकेत — तुरंत डॉक्टर को दिखाएँ',
    cautionBannerTitle: 'सावधानी — ध्यान रखें और आज क्लिनिक में बात करें',
    stableBannerTitle: 'स्थिति सामान्य — रिकवरी योजना जारी रखें',
    listenBtn: 'सुनें',
    playingBtn: 'चल रहा है...',
    openClinicianBriefBtn: 'डॉक्टर सारांश खोलें',
    patientReportLabel: 'मरीज़ का विवरण:',
    triggeredFlagsLabel: 'पाए गए चेतावनी संकेत:',
    clinicianSbarLabel: 'डॉक्टर के लिए SBAR सारांश (अंग्रेज़ी):',
    checkInHistoryTitle: 'पिछली जांच का इतिहास',
    entriesCountLabel: 'प्रविष्टियाँ',
    noCheckInsYet: 'अभी तक कोई जांच दर्ज नहीं है। ऊपर से आज के लक्षण भेजें।',
    voiceCheckInTag: 'वॉइस जांच',
    textCheckInTag: 'टेक्स्ट जांच',
    statusRedFlag: 'खतरे का संकेत',
    statusCaution: 'सावधानी',
    statusStable: 'सामान्य',

    liveCallTitle: 'लाइव वॉइस बात-चीत सहायक',
    liveCallSub: 'दवाइयों, खाने के समय या आज की तबीयत से जुड़े सवाल पूछने के लिए लाइव कॉल शुरू करें।',
    startLiveCall: 'लाइव कॉल शुरू करें',
    endLiveCall: 'कॉल समाप्त करें',
    muteMic: 'माइक म्यूट करें',
    unmuteMic: 'माइक चालू करें',
    liveCallConnecting: 'लाइव कॉल जुड़ रहा है...',
    liveCallReady: 'कॉल चालू है — आराम से बोलें',
    saveCallCheckIn: 'कॉल समाप्त कर जांच में जोड़ें',
    lastCallTranscript: 'पिछली कॉल की बातचीत',
    assistantSpeaking: 'DischargeDost बोल रहा है...',
    micMutedStatus: 'माइक म्यूट है',
    liveCallHint:
      'कोई भी सवाल बोलकर पूछें — जैसे “क्या मैं शाम की गोली चाय के साथ ले सकता हूँ?” या “मुझे चक्कर क्यों आ रहे हैं?”',
    typedQueryPlaceholder: 'या कॉल के दौरान सवाल यहाँ लिखें...',
    sendBtn: 'भेजें',
    urgentCallFlag: 'कॉल के दौरान गंभीर चेतावनी संकेत मिला',
    cautionCallFlag: 'कॉल के दौरान सावधानी संकेत मिला',
    micRequiredError: 'लाइव वॉइस कॉल के लिए माइक की अनुमति ज़रूरी है।',
    wsError: 'लाइव वॉइस कनेक्शन बनाए रखने में समस्या हुई।',

    briefEyebrow: 'अंग्रेज़ी SBAR डॉक्टर हैंडओवर',
    briefTitle: 'डॉक्टर रिकवरी सारांश',
    copyBrief: 'सारांश कॉपी करें',
    copiedBrief: 'कॉपी हो गया',
    printBrief: 'प्रिंट / PDF सेव करें',
    dischargeDateLabel: 'डिस्चार्ज तारीख',
    todaysAdherenceLabel: 'आज की दवा पालन स्थिति',
    dosesTakenSuffix: 'खुराक ली गईं',
    latestTriageLabel: 'ताज़ा जांच स्थिति',
    noCheckInYetLabel: 'अभी कोई जांच नहीं',
    clinicalSbarTitle: 'क्लिनिकल SBAR सारांश (अंग्रेज़ी)',
    latestAlertTitle: 'ताज़ा मरीज़ जांच अलर्ट',
    medAuditTitle: 'दवा और टकराव विवरण',
    colMedicine: 'दवा',
    colDose: 'खुराक',
    colSlot: 'समय',
    colInstruction: 'निर्देश',

    intakeAssistantTitle: 'इंटरैक्टिव रिकवरी सहायक',
    intakeAssistantSub: 'चैट करें, लाइव कॉल पर बोलकर पूछें, या डिस्चार्ज रिपोर्ट जोड़ें — अंतिम योजना बनाने से पहले मैं ज़रूरी सवाल पूछ लूँगा।',
    intakeGreetingNoFile: 'नमस्ते! आप अस्पताल की दवाइयों या घर की देखभाल से जुड़ा कोई भी सवाल पूछ सकते हैं, ऊपर लाइव वॉइस कॉल शुरू कर सकते हैं, या नीचे अपनी डिस्चार्ज रिपोर्ट जोड़ सकते हैं।',
    intakePlaceholder: 'अपना सवाल पूछें, घर की कोई अतिरिक्त दवा बताएं, या जवाब लिखें...',
    intakeBuildFinalPlan: 'अंतिम रिकवरी योजना बनाएँ',
    intakeQuickBuild: 'अभी योजना बनाएँ',
    intakeReadyBanner: 'सभी ज़रूरी जानकारी मिल गई है — अपनी दैनिक योजना बनाने के लिए क्लिक करें।',
    intakeUploadHint: 'योजना बनाने के लिए पहले डिस्चार्ज फोटो/PDF जोड़ें या दवाइयां लिखें।',
    intakeChipPainkiller: 'क्या खून पतला करने की दवा के साथ Ibuprofen ले सकते हैं?',
    intakeChipAskFood: 'कौन-सी गोलियाँ खाने से पहले और कौन-सी बाद में लेनी हैं?',
    intakeChipSample: 'नमूना डिस्चार्ज पेपर लोड कर जांचें',
    intakeReviewingAttachment: 'आपकी डिस्चार्ज रिपोर्ट पढ़ी जा रही है और आगे की ज़रूरी जानकारी जांची जा रही है...',
    attachFileBtn: 'रिपोर्ट जोड़ें',
    homeHeadline: 'अस्पताल से छुट्टी के बाद उलझन नहीं — हर दवा और देखभाल की साफ़ योजना।',
    homeLead:
      'लाइव वॉइस कॉल पर बात करें, किसी भी दवा की पट्टी स्कैन करें या डिस्चार्ज सारांश जोड़ें — DischargeDost दवाओं के टकराव की जांच कर परिवार के लिए सरल दैनिक योजना बनाता है।',
    homeFlow1Title: '01. बोलें या रिपोर्ट जोड़ें',
    homeFlow1Desc: 'लाइव कॉल पर पूछें, चैट करें या डिस्चार्ज फोटो/PDF सीधे छोड़ें।',
    homeFlow2Title: '02. त्वरित सुरक्षा जांच',
    homeFlow2Desc: 'अंतिम योजना से पहले घर की दर्द दवाइयां, एलर्जी और भोजन नियम जांचता है।',
    homeFlow3Title: '03. दैनिक समय-सारणी और डॉक्टर नोट',
    homeFlow3Desc: 'सुबह-शाम दवा सूची, खतरे के लक्षण और अंग्रेज़ी SBAR सारांश पाएं।',
    homeSampleCardTitle: 'अपोलो कार्डियोलॉजी नमूना पर्चा',
    homeSampleCardMeta: 'एंजियोप्लास्टी के बाद · 5 दवाइयां · टकराव जांच डेमो',
    homeTrySampleCta: 'नमूना आज़माएं',
    homeDropStripLabel: 'डिस्चार्ज फोटो या PDF यहाँ छोड़ें, या जोड़ने के लिए क्लिक करें (PNG, JPG, PDF)',
    homeSpeakerYou: 'आप',
    homePreviewSectionTitle: 'आपकी व्यक्तिगत रिकवरी योजना में क्या मिलता है',
    homePreviewSectionSub: 'हर दवा की परस्पर टकराव जांच कर उसे घर के नाश्ते और खाने के समय के अनुसार सजाया जाता है।',
    homePreviewTableTitle: 'उदाहरण: मेडिकल पर्चे से सरल पारिवारिक शेड्यूल',
    homePreviewColRx: 'अस्पताल पर्चा विवरण',
    homePreviewColPlain: 'सरल समय और सुरक्षा निर्देश',
    homePreviewTestLink: 'इस नमूने को ऊपर सहायक में लोड करें',
    homeCapability1Title: '4 भारतीय व अंग्रेज़ी भाषाएं',
    homeCapability1Desc: 'ऊपर हेडर से भाषा बदलें — पूरी समय-सारणी, चेतावनियां और ऑडियो तुरंत उसी भाषा में बदलते हैं।',
    homeCapability2Title: 'दवा टकराव व समय अंतराल जांच',
    homeCapability2Desc: 'खून पतला करने की दवा के साथ दर्द की गोली जैसे जोखिम और खाली पेट नियमों की तुरंत पहचान।',
    homeCapability3Title: 'डॉक्टर के लिए SBAR सारांश',
    homeCapability3Desc: 'फॉलो-अप विज़िट के लिए एक पन्ने का स्पष्ट अंग्रेज़ी क्लिनिकल नोट तैयार करता है।',
    scanMedicineCameraTitle: 'दवा का फोटो खींचने या अपलोड करने के लिए कैमरा खोलें',
    scanningMedicineMsg: 'दवा का नाम और उसका उपयोग पढ़ा जा रहा है...',
    medicineIdentifiedLabel: 'पहचानी गई दवा',
    previewTabSchedule: 'दैनिक समय-सारणी',
    previewTabSafety: 'सुरक्षा जांच',
    previewTabDoctor: 'डॉक्टर नोट',
    openCameraOption: 'कैमरा खोलें',
    uploadMedicineOption: 'दवा की फोटो अपलोड करें',
    capturePhotoBtn: 'फोटो लें',
    cancelCameraBtn: 'रद्द करें',
    cameraPermissionError: 'कैमरा उपलब्ध नहीं है या अनुमति नहीं मिली। कृपया “दवा की फोटो अपलोड करें” चुनें।',

    disclaimer: 'यह आपके डॉक्टर की सलाह में मदद के लिए है, डॉक्टर की जगह नहीं लेता।',
  },
  ta: {
    navUpload: 'பதிவேற்று',
    navPlan: 'தினசரி திட்டம்',
    navCheckIn: 'தினசரி சரிபார்ப்பு',
    navClinician: 'மருத்துவர் குறிப்பு',
    signInGoogle: 'Google மூலம் உள்நுழைக',
    signOut: 'வெளியேறு',
    languageLabel: 'மொழி',
    translatingPlan: 'திட்டம் மொழிபெயர்க்கப்படுகிறது...',
    savedPlansLabel: 'சேமித்த திட்டங்கள்:',
    guestPreviewNotice:
      'நீங்கள் தற்காலிக அமர்வில் பார்க்கிறீர்கள். அட்டவணை மற்றும் சரிபார்ப்புகளைச் சேமிக்க Google மூலம் உள்நுழையவும்.',
    saveToFirestore: 'Firestore-இல் சேமி',

    heroEyebrow: 'மருத்துவமனைக்குப் பிந்தைய வீட்டு பராமரிப்பு · English, हिन्दी, தமிழ், বাংলা',
    heroTitle: 'சிக்கலான டிஸ்சார்ஜ் தாள்களை எளிய தினசரி பராமரிப்புத் திட்டமாக மாற்றுங்கள்',
    heroSubtitle:
      'மருத்துவமனை டிஸ்சார்ஜ் சுருக்கம் அல்லது மருந்துச் சீட்டின் புகைப்படத்தைப் பதிவேற்றவும். DischargeDost மருந்துகளைப் படித்து, முரண்பாடுகளைச் சரிபார்த்து, உங்கள் மொழியில் வழிகாட்டும்.',
    step1Title: 'புகைப்படம் அல்லது PDF பதிவேற்றவும்',
    step1Desc: 'மருத்துவமனை சுருக்கம் அல்லது கைஎழுத்து மருந்துச் சீட்டு.',
    step2Title: 'மருந்து & நேரச் சரிபார்ப்பு',
    step2Desc: 'மருந்து முரண்பாடுகள் மற்றும் உணவு இடைவெளியைச் சரிபார்க்கும்.',
    step3Title: 'தினசரி அபாய கண்காணிப்பு',
    step3Desc: 'மருத்துவர் குறிப்புகளுடன் நேரடி அழைப்பு, குரல் அல்லது உரை சரிபார்ப்பு.',
    fallbackHeroTitle: 'வீட்டு பராமரிப்புத் துணை',
    fallbackHeroSub: 'பன்மொழி மருந்து அட்டவணை மற்றும் தினசரி சரிபார்ப்பு',
    uploadCardTitle: 'டிஸ்சார்ஜ் சுருக்கத்தைப் பதிவேற்றவும்',
    uploadCardSub:
      'மருத்துவமனை தாளின் புகைப்படம் அல்லது PDF-ஐப் பதிவேற்றவும், அல்லது மாதிரி சுருக்கத்தை முயற்சிக்கவும்.',
    dropzonePrompt: 'பதிவேற்ற கிளிக் செய்யவும் அல்லது புகைப்படம் / PDF-ஐ இங்கே விடவும்',
    dropzoneHint: '12 MB வரை PNG, JPG, WebP அல்லது PDF ஏற்கப்படும்',
    selectedFileLabel: 'தேர்ந்தெடுத்த கோப்பு:',
    loadSampleBtn: 'மாதிரி டிஸ்சார்ஜ் படம் ஏற்று',
    clearFileBtn: 'கோப்பை நீக்கு',
    readyForVision: 'ஆய்வுக்குத் தயார்',
    notesLabel: 'கூடுதல் குறிப்புகள் அல்லது உரை (விருப்பமானது)',
    notesHint:
      'வீட்டில் எடுக்கும் கூடுதல் வலி நிவாரணி மருந்துகளைச் சேர்க்கவும் அல்லது புகைப்படம் இல்லையெனில் உரையை ஒட்டவும்.',
    notesPlaceholder:
      'உதாரணம்: முழங்கால் வலிக்கு Ibuprofen 400mg எடுக்கிறார், அல்லது டிஸ்சார்ஜ் உரையை இங்கே ஒட்டவும்...',
    analyzeBtn: 'பராமரிப்புத் திட்டத்தை உருவாக்கு',
    analyzingBtn: 'ஆய்வு மற்றும் சரிபார்ப்பு நடக்கிறது...',

    medicinesCountLabel: 'மருந்துகள்',
    listenPlan: 'ஒலியாகக் கேளுங்கள்',
    stopAudio: 'ஒலியை நிறுத்து',
    plainSummaryTitle: 'மருத்துவமனை சுருக்கம் — எளிய விளக்கம்',
    scheduleTitle: 'தினசரி மருந்து அட்டவணை',
    conflictsTitle: 'மருந்து முரண்பாடு மற்றும் நேர எச்சரிக்கை',
    flaggedCountLabel: 'எச்சரிக்கை',
    severityHigh: 'அதிக முன்னுரிமை முரண்பாடு',
    severityTiming: 'நேர இடைவெளி அவசியம்',
    severityModerate: 'மிதமான எச்சரிக்கை',
    nextStepLabel: 'அடுத்த படி:',
    dietTitle: 'உணவு மற்றும் நீர் வழிகாட்டி',
    eatFreely: 'உண்ணக்கூடிய உணவுகள்',
    avoidFoods: 'தவிர்க்க வேண்டியவை',
    hydrationLabel: 'நீர் அருந்தும் அளவு',
    activityTitle: 'ஓய்வு மற்றும் செயல்பாடு',
    redFlagsTitle: 'இவை தெரிந்தால் உடனே மருத்துவமனைக்குச் செல்லவும்',
    followUpsTitle: 'மறுபரிசோதனை தேதிகள்',
    markTaken: 'எடுத்தேன்',
    takenLabel: 'எடுக்கப்பட்டது',
    toolChecksSummary: 'மருத்துவக் கருவி சரிபார்ப்பு முடிந்தது',

    checkInHeading: 'இன்றைய உடல்நிலை சரிபார்ப்பு',
    checkInSub: 'இன்று நோயாளி எப்படி உணர்கிறார் என்பதைப் பேசவும் அல்லது தட்டச்சு செய்யவும்.',
    dosesLoggedToday: 'இன்று பதிவான மருந்துகள்:',
    quickSampleLabel: 'விரைவு மாதிரி பதில்கள்:',
    symptomPlaceholder:
      'இன்று நோயாளி எப்படி உணர்கிறார் என எழுதவும் (வலி, காய்ச்சல், வீக்கம், மூச்சு, பசி, மயக்கம்)...',
    recordVoice: 'குரல் பதிவு செய்',
    stopRecording: 'பதிவை நிறுத்து',
    voiceRecordedReady: 'குரல் பதிவு செய்யப்பட்டது — அனுப்பத் தயார்',
    micDeniedMsg: 'மைக் அனுமதி கிடைக்கவில்லை. கீழே அறிகுறிகளைத் தட்டச்சு செய்யலாம்.',
    submitCheckIn: 'சரிபார்ப்பை அனுப்பு',
    checkingSymptomsBtn: 'அறிகுறிகள் சரிபார்க்கப்படுகின்றன...',
    redFlagBannerTitle: 'அபாய எச்சரிக்கை — உடனே மருத்துவரை அணுகவும்',
    cautionBannerTitle: 'கவனம் — கண்காணித்து இன்று மருத்துவமனைக்கு அழைக்கவும்',
    stableBannerTitle: 'நிலை சீராக உள்ளது — திட்டத்தைத் தொடரவும்',
    listenBtn: 'கேளுங்கள்',
    playingBtn: 'ஒலிக்கிறது...',
    openClinicianBriefBtn: 'மருத்துவர் குறிப்பைத் திற',
    patientReportLabel: 'நோயாளி தகவல்:',
    triggeredFlagsLabel: 'கண்டறியப்பட்ட எச்சரிக்கைகள்:',
    clinicianSbarLabel: 'மருத்துவர் SBAR சுருக்கம் (ஆங்கிலம்):',
    checkInHistoryTitle: 'சரிபார்ப்பு வரலாறு',
    entriesCountLabel: 'பதிவுகள்',
    noCheckInsYet: 'இதுவரை சரிபார்ப்பு பதிவு இல்லை. மேலே இன்றைய நிலையை அனுப்பவும்.',
    voiceCheckInTag: 'குரல் சரிபார்ப்பு',
    textCheckInTag: 'உரை சரிபார்ப்பு',
    statusRedFlag: 'அபாய எச்சரிக்கை',
    statusCaution: 'கவனம்',
    statusStable: 'சீரானது',

    liveCallTitle: 'நேரடி குரல் உதவி அழைப்பு',
    liveCallSub: 'மருந்துகள், உணவு நேரம் அல்லது இன்றைய உடல்நிலை குறித்த கேள்விகளை நேரடியாகக் கேளுங்கள்.',
    startLiveCall: 'நேரடி அழைப்பைத் தொடங்கு',
    endLiveCall: 'அழைப்பை முடி',
    muteMic: 'மைக் நிறுத்து',
    unmuteMic: 'மைக் இயக்கு',
    liveCallConnecting: 'நேரடி அழைப்பு இணைகிறது...',
    liveCallReady: 'அழைப்பு செயலில் உள்ளது — பேசலாம்',
    saveCallCheckIn: 'முடித்து சரிபார்ப்பில் சேர்',
    lastCallTranscript: 'கடைசி அழைப்பு உரையாடல்',
    assistantSpeaking: 'DischargeDost பேசுகிறது...',
    micMutedStatus: 'மைக் நிறுத்தப்பட்டுள்ளது',
    liveCallHint:
      'உரக்கக் கேளுங்கள் — எ.கா. “மாலை மாத்திரையைத் தேநீருடன் எடுக்கலாமா?” அல்லது “ஏன் தலை சுற்றுகிறது?”',
    typedQueryPlaceholder: 'அல்லது அழைப்பின் போது கேள்வியைத் தட்டச்சு செய்யவும்...',
    sendBtn: 'அனுப்பு',
    urgentCallFlag: 'அழைப்பின் போது அவசர அறிகுறி கண்டறியப்பட்டது',
    cautionCallFlag: 'அழைப்பின் போது எச்சரிக்கை அறிகுறி கண்டறியப்பட்டது',
    micRequiredError: 'நேரடி குரல் அழைப்பிற்கு மைக் அனுமதி தேவை.',
    wsError: 'நேரடி குரல் இணைப்பைப் பராமரிக்க முடியவில்லை.',

    briefEyebrow: 'ஆங்கில SBAR மருத்துவர் அறிக்கை',
    briefTitle: 'மருத்துவர் பராமரிப்பு சுருக்கம்',
    copyBrief: 'சுருக்கத்தை நகலெடு',
    copiedBrief: 'நகலெடுக்கப்பட்டது',
    printBrief: 'அச்சிடு / PDF சேமி',
    dischargeDateLabel: 'டிஸ்சார்ஜ் தேதி',
    todaysAdherenceLabel: 'இன்றைய மருந்து ஒழுங்கு',
    dosesTakenSuffix: 'வேளை எடுக்கப்பட்டது',
    latestTriageLabel: 'சமீபத்திய நிலை',
    noCheckInYetLabel: 'சரிபார்ப்பு இல்லை',
    clinicalSbarTitle: 'மருத்துவ SBAR சுருக்கம் (ஆங்கிலம்)',
    latestAlertTitle: 'சமீபத்திய நோயாளி எச்சரிக்கை',
    medAuditTitle: 'மருந்து மற்றும் முரண்பாடு பட்டியல்',
    colMedicine: 'மருந்து',
    colDose: 'அளவு',
    colSlot: 'நேரம்',
    colInstruction: 'வழிமுறை',

    intakeAssistantTitle: 'நேரடி பராமரிப்பு வழிகாட்டி',
    intakeAssistantSub: 'உரையாடவும், நேரடி குரல் அழைப்பில் பேசவும், அல்லது டிஸ்சார்ஜ் அறிக்கையை இணைக்கவும் — இறுதித் திட்டம் முன் தேவையானதைக் கேட்பேன்.',
    intakeGreetingNoFile: 'வணக்கம்! மருந்துகள் அல்லது வீட்டுப் பராமரிப்பு குறித்து எதுவும் கேளுங்கள், மேலே நேரடி அழைப்பைத் தொடங்குங்கள், அல்லது உங்கள் டிஸ்சார்ஜ் தாளை இணைக்கவும்.',
    intakePlaceholder: 'கேள்வி கேளுங்கள், வீட்டு மருந்துகளைக் குறிப்பிடுங்கள், அல்லது பதில் எழுதுங்கள்...',
    intakeBuildFinalPlan: 'இறுதிப் பராமரிப்புத் திட்டத்தை உருவாக்கு',
    intakeQuickBuild: 'இப்போதே திட்டத்தை உருவாக்கு',
    intakeReadyBanner: 'தேவையான தகவல்கள் தயார் — உங்கள் தினசரி திட்டத்தை உருவாக்க கிளிக் செய்யவும்.',
    intakeUploadHint: 'திட்டம் உருவாக்க முதலில் டிஸ்சார்ஜ் படம்/PDF அல்லது மருந்துகளைச் சேர்க்கவும்.',
    intakeChipPainkiller: 'ரத்தம் மெலிதாக்கும் மருந்துடன் Ibuprofen எடுக்கலாமா?',
    intakeChipAskFood: 'உணவுக்கு முன் மற்றும் பின் எடுக்க வேண்டிய மாத்திரைகள் எவை?',
    intakeChipSample: 'மாதிரி டிஸ்சார்ஜ் தாளை ஏற்றி ஆய்வு செய்',
    intakeReviewingAttachment: 'உங்கள் டிஸ்சார்ஜ் அறிக்கை படிக்கப்பட்டு தேவையான கேள்விகள் தயாராகின்றன...',
    attachFileBtn: 'அறிக்கை இணை',
    homeHeadline: 'மருத்துவமனை டிஸ்சார்ஜுக்குப் பின் குழப்பமில்லை — பாதுகாப்பான வீட்டு பராமரிப்பு.',
    homeLead:
      'நேரடி குரல் அழைப்பில் பேசவும், எந்த மருந்து அட்டையையும் ஸ்கேன் செய்யவும், அல்லது டிஸ்சார்ஜ் தாளை இணைக்கவும் — DischargeDost மருந்து முரண்பாடுகளைச் சரிபார்த்து தெளிவான தினசரி அட்டவணை தரும்.',
    homeFlow1Title: '01. பேசவும் அல்லது தாளை இணைக்கவும்',
    homeFlow1Desc: 'நேரடி அழைப்பில் கேளுங்கள், தட்டச்சு செய்யுங்கள் அல்லது படம்/PDF சேர்க்கவும்.',
    homeFlow2Title: '02. விரைவு பாதுகாப்புச் சரிபார்ப்பு',
    homeFlow2Desc: 'வலி மாத்திரைகள், ஒவ்வாமை மற்றும் உணவு இடைவெளியை முதலில் சரிபார்க்கிறது.',
    homeFlow3Title: '03. தினசரி அட்டவணை & மருத்துவர் குறிப்பு',
    homeFlow3Desc: 'உணவு நேர மாத்திரை பட்டியல், அபாய எச்சரிக்கை மற்றும் ஆங்கில SBAR குறிப்பு.',
    homeSampleCardTitle: 'அப்போலோ இதய சிகிச்சை மாதிரி தாள்',
    homeSampleCardMeta: 'ஆஞ்சியோபிளாஸ்டிக்குப் பின் · 5 மருந்துகள் · முரண்பாடு மாதிரி',
    homeTrySampleCta: 'மாதிரி முயற்சி',
    homeDropStripLabel: 'டிஸ்சார்ஜ் படம் அல்லது PDF-ஐ இங்கே விடவும் அல்லது கிளிக் செய்யவும்',
    homeSpeakerYou: 'நீங்கள்',
    homePreviewSectionTitle: 'உங்கள் தனிப்பயன் பராமரிப்புத் திட்டத்தில் கிடைப்பவை',
    homePreviewSectionSub: 'ஒவ்வொரு மருந்தும் முரண்பாட்டிற்குச் சரிபார்க்கப்பட்டு குடும்ப உணவு நேரத்திற்கு ஏற்ப அமைக்கப்படும்.',
    homePreviewTableTitle: 'உதாரணம்: மருந்துச் சீட்டிலிருந்து எளிய குடும்ப அட்டவணை',
    homePreviewColRx: 'மருத்துவமனை சுருக்கம்',
    homePreviewColPlain: 'குடும்ப நேரமும் பாதுகாப்பு வழிமுறையும்',
    homePreviewTestLink: 'இந்த மாதிரியை மேலே வழிகாட்டியில் ஏற்றவும்',
    homeCapability1Title: '4 மொழிகளில் உடனடி மாற்றம்',
    homeCapability1Desc: 'மேலே மொழியை மாற்றினால் அட்டவணை, எச்சரிக்கைகள் மற்றும் ஒலி அனைத்தும் உடனே மாறும்.',
    homeCapability2Title: 'மருந்து முரண்பாடு & நேர ஆய்வு',
    homeCapability2Desc: 'ரத்தம் மெலிதாக்கும் மருந்துடன் வலி மாத்திரை போன்ற அபாயங்களை உடனே கண்டறியும்.',
    homeCapability3Title: 'மருத்துவர் SBAR சுருக்கம்',
    homeCapability3Desc: 'மறுபரிசோதனைக்கு ஒரு பக்க ஆங்கில மருத்துவச் சுருக்கத்தை உருவாக்கும்.',
    scanMedicineCameraTitle: 'கேமரா திறக்கவும் அல்லது மருந்து படம் பதிவேற்றவும்',
    scanningMedicineMsg: 'மருந்து பெயர் மற்றும் பயன் படிக்கப்படுகிறது...',
    medicineIdentifiedLabel: 'அடையாளம் காணப்பட்ட மருந்து',
    previewTabSchedule: 'தினசரி நேரம்',
    previewTabSafety: 'பாதுகாப்பு ஆய்வு',
    previewTabDoctor: 'மருத்துவர் குறிப்பு',
    openCameraOption: 'கேமரா திற',
    uploadMedicineOption: 'மருந்து படம் பதிவேற்று',
    capturePhotoBtn: 'படம் எடு',
    cancelCameraBtn: 'ரத்து செய்',
    cameraPermissionError: 'கேமரா அனுமதி கிடைக்கவில்லை. “மருந்து படம் பதிவேற்று” விருப்பத்தைப் பயன்படுத்தவும்.',

    disclaimer: 'இது மருத்துவரின் ஆலோசனைக்கு உதவியாக மட்டுமே; மருத்துவருக்கு மாற்றல்ல.',
  },
  bn: {
    navUpload: 'আপলোড',
    navPlan: 'দৈনিক পরিকল্পনা',
    navCheckIn: 'দৈনিক চেক-ইন',
    navClinician: 'ডাক্তারের নোট',
    signInGoogle: 'Google দিয়ে সাইন ইন করুন',
    signOut: 'সাইন আউট',
    languageLabel: 'ভাষা',
    translatingPlan: 'পরিকল্পনা অনুবাদ করা হচ্ছে...',
    savedPlansLabel: 'সংরক্ষিত পরিকল্পনা:',
    guestPreviewNotice:
      'আপনি অস্থায়ী সেশনে দেখছেন। সময়সূচী ও চেক-ইন সংরক্ষণ করতে Google দিয়ে সাইন ইন করুন।',
    saveToFirestore: 'Firestore-এ সেভ করুন',

    heroEyebrow: 'হাসপাতাল থেকে ফেরার পর বাড়িতে যত্ন · English, हिन्दी, தமிழ், বাংলা',
    heroTitle: 'জটিল ডিসচার্জ কাগজপত্রকে সহজ দৈনিক পরিকল্পনায় রূপান্তর করুন',
    heroSubtitle:
      'হাসপাতালের ডিসচার্জ সারাংশ বা প্রেসক্রিপশনের ছবি আপলোড করুন। DischargeDost ওষুধ পড়ে, ওষুধের সতর্কতা যাচাই করে, আপনার ভাষায় নিয়ম বোঝায় এবং প্রতিদিনের শারীরিক অবস্থা ট্র্যাক করে।',
    step1Title: 'ছবি বা PDF আপলোড করুন',
    step1Desc: 'যেকোনো ডিসচার্জ সারাংশ বা হাতে লেখা প্রেসক্রিপশনের ছবি।',
    step2Title: 'ওষুধ ও সময়ের যাচাই',
    step2Desc: 'ওষুধের মিথস্ক্রিয়া এবং খাওয়ার আগে/পরের নিয়ম যাচাই করে।',
    step3Title: 'প্রতিদিনের সতর্কতা নজরদারি',
    step3Desc: 'ডাক্তারের নোটসহ লাইভ কল, ভয়েস বা টেক্সট চেক-ইন।',
    fallbackHeroTitle: 'সহজ বাড়ির চিকিৎসা সহায়ক',
    fallbackHeroSub: 'বহুভাষিক ওষুধের সময়সূচী ও দৈনিক চেক-ইন',
    uploadCardTitle: 'ডিসচার্জ সারাংশ আপলোড করুন',
    uploadCardSub:
      'ডিসচার্জ কাগজের ছবি বা PDF আপলোড করুন, অথবা নিচের নমুনা সারাংশ ব্যবহার করে দেখুন।',
    dropzonePrompt: 'আপলোড করতে ক্লিক করুন অথবা ছবি / PDF এখানে টেনে আনুন',
    dropzoneHint: '১২ MB পর্যন্ত PNG, JPG, WebP বা PDF সমর্থিত',
    selectedFileLabel: 'নির্বাচিত ফাইল:',
    loadSampleBtn: 'নমুনা ডিসচার্জ ছবি লোড করুন',
    clearFileBtn: 'ফাইল সরান',
    readyForVision: 'বিশ্লেষণের জন্য প্রস্তুত',
    notesLabel: 'অতিরিক্ত নোট বা পেস্ট করা টেক্সট (ঐচ্ছিক)',
    notesHint:
      'রোগী বাড়িতে অন্য কোনো ব্যথার ওষুধ খেলে তা লিখুন, অথবা ছবি না থাকলে সরাসরি লেখা পেস্ট করুন।',
    notesPlaceholder:
      'উদাহরণ: রোগী হাঁটুর ব্যথার জন্য Ibuprofen 400mg খান, অথবা ডিসচার্জ সারাংশ এখানে পেস্ট করুন...',
    analyzeBtn: 'রিকভারি পরিকল্পনা তৈরি করুন',
    analyzingBtn: 'তথ্য পড়া ও যাচাই করা হচ্ছে...',

    medicinesCountLabel: 'ওষুধ',
    listenPlan: 'শুনে বুঝুন',
    stopAudio: 'অডিও থামান',
    plainSummaryTitle: 'হাসপাতাল ছাড়পত্রের সহজ সারসংক্ষেপ',
    scheduleTitle: 'প্রতিদিনের ওষুধের সময়সূচী',
    conflictsTitle: 'ওষুধের সতর্কতা ও সময়ের নিয়ম',
    flaggedCountLabel: 'সতর্কতা',
    severityHigh: 'উচ্চ অগ্রাধিকার সতর্কতা',
    severityTiming: 'সময়ের ব্যবধান প্রয়োজন',
    severityModerate: 'মাঝারি সতর্কতা',
    nextStepLabel: 'পরবর্তী পদক্ষেপ:',
    dietTitle: 'খাবার ও জলের নিয়ম',
    eatFreely: 'যা খেতে পারবেন',
    avoidFoods: 'যা এড়িয়ে চলবেন',
    hydrationLabel: 'জল পানের নির্দেশনা',
    activityTitle: 'বিশ্রাম ও কাজের নিয়ম',
    redFlagsTitle: 'এই লক্ষণগুলো দেখলে অবিলম্বে হাসপাতালে যান',
    followUpsTitle: 'পরবর্তী ডাক্তার দেখানোর তারিখ',
    markTaken: 'খেয়েছি',
    takenLabel: 'খাওয়া হয়েছে',
    toolChecksSummary: 'যাচাইকৃত ক্লিনিক্যাল টুল পরীক্ষা সম্পন্ন',

    checkInHeading: 'আজকের স্বাস্থ্য ও লক্ষণ চেক-ইন',
    checkInSub: 'রোগী আজ কেমন অনুভব করছেন তা বলুন বা লিখুন। জরুরি বিপদ সংকেত সাথে সাথে জানানো হবে।',
    dosesLoggedToday: 'আজকের নথিভুক্ত ডোজ:',
    quickSampleLabel: 'দ্রুত নমুনা উত্তর:',
    symptomPlaceholder:
      'রোগী আজ কেমন অনুভব করছেন লিখুন (ব্যথা, জ্বর, ফোলা, শ্বাসকষ্ট, ক্ষুধা, মাথা ঘোরা বা বাদ পড়া ওষুধ)...',
    recordVoice: 'ভয়েস রেকর্ড করুন',
    stopRecording: 'রেকর্ডিং থামান',
    voiceRecordedReady: 'ভয়েস নোট রেকর্ড হয়েছে এবং পাঠানোর জন্য প্রস্তুত',
    micDeniedMsg: 'মাইক্রোফোনের অনুমতি পাওয়া যায়নি। আপনি নিচে লক্ষণ লিখতে পারেন।',
    submitCheckIn: 'চেক-ইন যাচাই করুন',
    checkingSymptomsBtn: 'লক্ষণ যাচাই করা হচ্ছে...',
    redFlagBannerTitle: 'বিপদ সংকেত — দ্রুত ডাক্তারের পরামর্শ নিন',
    cautionBannerTitle: 'সতর্কতা — নজরে রাখুন ও আজ ক্লিনিকে যোগাযোগ করুন',
    stableBannerTitle: 'স্বাভাবিক অবস্থা — পরিকল্পনা চালিয়ে যান',
    listenBtn: 'শুনুন',
    playingBtn: 'চলছে...',
    openClinicianBriefBtn: 'ডাক্তারের নোট খুলুন',
    patientReportLabel: 'রোগীর বিবরণ:',
    triggeredFlagsLabel: 'শনাক্তকৃত সতর্কতা চিহ্ন:',
    clinicianSbarLabel: 'ডাক্তারের SBAR সারাংশ (ইংরেজি):',
    checkInHistoryTitle: 'চেক-ইন ইতিহাস',
    entriesCountLabel: 'এন্ট্রি',
    noCheckInsYet: 'এখনো কোনো চেক-ইন নেই। ট্র্যাকিং শুরু করতে উপরে আজকের লক্ষণ জানান।',
    voiceCheckInTag: 'ভয়েস চেক-ইন',
    textCheckInTag: 'টেক্সট চেক-ইন',
    statusRedFlag: 'বিপদ সংকেত',
    statusCaution: 'সতর্কতা',
    statusStable: 'স্বাভাবিক',

    liveCallTitle: 'লাইভ ভয়েস সহায়তা কল',
    liveCallSub: 'ওষুধ, খাবারের নিয়ম বা আজকের শারীরিক অবস্থা নিয়ে সরাসরি কথা বলে প্রশ্ন করুন।',
    startLiveCall: 'লাইভ কল শুরু করুন',
    endLiveCall: 'কল শেষ করুন',
    muteMic: 'মাইক মিউট',
    unmuteMic: 'মাইক আনমিউট',
    liveCallConnecting: 'লাইভ কল সংযুক্ত হচ্ছে...',
    liveCallReady: 'কল চালু আছে — স্বাভাবিকভাবে কথা বলুন',
    saveCallCheckIn: 'কল শেষ করে চেক-ইনে সেভ করুন',
    lastCallTranscript: 'সর্বশেষ কলের কথোপকথন',
    assistantSpeaking: 'DischargeDost কথা বলছে...',
    micMutedStatus: 'মাইক মিউট করা আছে',
    liveCallHint:
      'যেকোনো প্রশ্ন বলুন — যেমন “সন্ধ্যার ট্যাবলেট কি চায়ের সাথে খাওয়া যাবে?” বা “মাথা ঘুরছে কেন?”',
    typedQueryPlaceholder: 'অথবা কলের সময় প্রশ্ন টাইপ করুন...',
    sendBtn: 'পাঠান',
    urgentCallFlag: 'কলের সময় জরুরি সতর্কতা সংকেত পাওয়া গেছে',
    cautionCallFlag: 'কলের সময় সতর্কতা সংকেত পাওয়া গেছে',
    micRequiredError: 'লাইভ ভয়েস কলের জন্য মাইক্রোফোনের অনুমতি প্রয়োজন।',
    wsError: 'লাইভ ভয়েস সংযোগ বজায় রাখা যায়নি।',

    briefEyebrow: 'ইংরেজি SBAR ডাক্তার হ্যান্ডওভার',
    briefTitle: 'ডাক্তার রিকভারি সংক্ষেপ',
    copyBrief: 'নোট কপি করুন',
    copiedBrief: 'কপি হয়েছে',
    printBrief: 'প্রিন্ট / PDF সেভ',
    dischargeDateLabel: 'ডিসচার্জের তারিখ',
    todaysAdherenceLabel: 'আজকের ওষুধ গ্রহণ',
    dosesTakenSuffix: 'টি ডোজ নেওয়া হয়েছে',
    latestTriageLabel: 'সর্বশেষ অবস্থা',
    noCheckInYetLabel: 'এখনো কোনো চেক-ইন নেই',
    clinicalSbarTitle: 'ক্লিনিক্যাল SBAR সারাংশ (ইংরেজি)',
    latestAlertTitle: 'সর্বশেষ রোগী চেক-ইন সতর্কতা',
    medAuditTitle: 'ওষুধ ও সতর্কতা তালিকা',
    colMedicine: 'ওষুধ',
    colDose: 'ডোজ',
    colSlot: 'সময়',
    colInstruction: 'নির্দেশনা',

    intakeAssistantTitle: 'ইন্টারঅ্যাক্টিভ রিকভারি সহায়ক',
    intakeAssistantSub: 'চ্যাট করুন, লাইভ ভয়েস কলে কথা বলুন, বা ডিসচার্জ রিপোর্ট যোগ করুন — চূড়ান্ত পরিকল্পনা তৈরির আগে আর কিছু প্রয়োজন কি না জেনে নেব।',
    intakeGreetingNoFile: 'নমস্কার! ওষুধ বা বাড়ির যত্ন নিয়ে যেকোনো প্রশ্ন করুন, উপরে লাইভ ভয়েস কল শুরু করুন, অথবা আপনার ডিসচার্জ রিপোর্ট যোগ করুন।',
    intakePlaceholder: 'প্রশ্ন লিখুন, বাড়ির কোনো অতিরিক্ত ওষুধের কথা জানান, বা উত্তর দিন...',
    intakeBuildFinalPlan: 'চূড়ান্ত রিকভারি পরিকল্পনা তৈরি করুন',
    intakeQuickBuild: 'এখনই পরিকল্পনা তৈরি করুন',
    intakeReadyBanner: 'প্রয়োজনীয় সব তথ্য প্রস্তুত — আপনার দৈনিক পরিকল্পনা তৈরি করতে ক্লিক করুন।',
    intakeUploadHint: 'পরিকল্পনা তৈরি করতে প্রথমে ডিসচার্জ ছবি/PDF বা ওষুধের বিবরণ যোগ করুন।',
    intakeChipPainkiller: 'রক্ত পাতলা করার ওষুধের সাথে কি Ibuprofen খাওয়া যায়?',
    intakeChipAskFood: 'কোন ট্যাবলেট খাবারের আগে আর কোনটি পরে খেতে হবে?',
    intakeChipSample: 'নমুনা ডিসচার্জ রিপোর্ট লোড করে দেখুন',
    intakeReviewingAttachment: 'আপনার ডিসচার্জ রিপোর্ট পড়া হচ্ছে এবং আর কিছু জানা প্রয়োজন কি না দেখা হচ্ছে...',
    attachFileBtn: 'রিপোর্ট দিন',
    homeHeadline: 'হাসপাতাল ছাড়ার পর আর বিভ্রান্তি নয় — প্রতিটি ওষুধ ও যত্নের স্পষ্ট পরিকল্পনা।',
    homeLead:
      'লাইভ ভয়েস কলে কথা বলুন, যেকোনো ওষুধের পাতা স্ক্যান করুন বা ডিসচার্জ সারাংশ দিন — DischargeDost ওষুধের সতর্কতা যাচাই করে সহজ পারিবারিক রুটিন তৈরি করে।',
    homeFlow1Title: '01. কথা বলুন বা রিপোর্ট দিন',
    homeFlow1Desc: 'লাইভ কলে প্রশ্ন করুন, চ্যাট করুন বা ডিসচার্জ ছবি/PDF যোগ করুন।',
    homeFlow2Title: '02. দ্রুত নিরাপত্তা যাচাই',
    homeFlow2Desc: 'চূড়ান্ত তালিকার আগে ব্যথার ওষুধ, অ্যালার্জি ও খাবারের নিয়ম জেনে নেয়।',
    homeFlow3Title: '03. দৈনিক তালিকা ও ডাক্তারের নোট',
    homeFlow3Desc: 'খাবার অনুযায়ী ওষুধের রুটিন, বিপদ সংকেত এবং ইংরেজি SBAR সারাংশ পান।',
    homeSampleCardTitle: 'অ্যাপোলো কার্ডিওলজি নমুনা রিপোর্ট',
    homeSampleCardMeta: 'অ্যাঞ্জিওপ্লাস্টির পর · ৫টি ওষুধ · সতর্কতা ডেমো',
    homeTrySampleCta: 'নমুনা দেখুন',
    homeDropStripLabel: 'ডিসচার্জ ছবি বা PDF এখানে টেনে আনুন অথবা ক্লিক করে যোগ করুন',
    homeSpeakerYou: 'আপনি',
    homePreviewSectionTitle: 'আপনার ব্যক্তিগত রিকভারি পরিকল্পনায় যা থাকছে',
    homePreviewSectionSub: 'প্রতিটি ওষুধের মিথস্ক্রিয়া যাচাই করে পরিবারের খাবারের সময়ের সাথে মিলিয়ে সাজানো হয়।',
    homePreviewTableTitle: 'উদাহরণ: প্রেসক্রিপশন থেকে সহজ পারিবারিক রুটিন',
    homePreviewColRx: 'হাসপাতালের সংক্ষিপ্ত লেখা',
    homePreviewColPlain: 'পারিবারিক সময় ও নিরাপত্তা নির্দেশনা',
    homePreviewTestLink: 'উপরের সহায়কে এই নমুনাটি লোড করুন',
    homeCapability1Title: '৪টি ভাষায় তাৎক্ষণিক সুবিধা',
    homeCapability1Desc: 'উপরের হেডার থেকে ভাষা বদলালে সময়সূচী, সতর্কতা ও অডিও সাথে সাথে বদলে যায়।',
    homeCapability2Title: 'ওষুধের মিথস্ক্রিয়া ও সময় যাচাই',
    homeCapability2Desc: 'রক্ত পাতলা করার ওষুধের সাথে ব্যথার ওষুধের ঝুঁকি ও খাবারের ব্যবধান চিহ্নিত করে।',
    homeCapability3Title: 'ডাক্তারের জন্য SBAR নোট',
    homeCapability3Desc: 'পরবর্তী ভিজিটের জন্য এক পৃষ্ঠার স্পষ্ট ইংরেজি ক্লিনিক্যাল নোট তৈরি করে।',
    scanMedicineCameraTitle: 'ক্যামেরা খুলুন বা ওষুধের ছবি আপলোড করুন',
    scanningMedicineMsg: 'ওষুধের নাম ও কাজ পড়া হচ্ছে...',
    medicineIdentifiedLabel: 'শনাক্ত করা ওষুধ',
    previewTabSchedule: 'দৈনিক সময়সূচী',
    previewTabSafety: 'সুরক্ষা যাচাই',
    previewTabDoctor: 'ডাক্তার নোট',
    openCameraOption: 'ক্যামেরা খুলুন',
    uploadMedicineOption: 'ওষুধের ছবি আপলোড করুন',
    capturePhotoBtn: 'ছবি তুলুন',
    cancelCameraBtn: 'বাতিল করুন',
    cameraPermissionError: 'ক্যামেরা পাওয়া যায়নি বা অনুমতি দেওয়া হয়নি। “ওষুধের ছবি আপলোড করুন” ব্যবহার করুন।',

    disclaimer: 'এটি ডাক্তারের পরামর্শের সহায়ক মাত্র, চিকিৎসার বিকল্প নয়।',
  },
};
