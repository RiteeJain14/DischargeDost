import React, { useEffect, useRef, useState } from 'react';
import {
  AlertOctagon,
  ArrowRight,
  Camera,
  CheckCircle2,
  FileImage,
  FileText,
  ImagePlus,
  Loader2,
  Mic,
  MicOff,
  Paperclip,
  Phone,
  PhoneOff,
  Send,
  X,
} from 'lucide-react';
import {
  UI_COPY,
  type DailyCheckIn,
  type FollowUpReport,
  type LanguageCode,
  type RecoveryPlan,
} from '../types';

const FOLLOWUP_MODE_COPY: Record<
  LanguageCode,
  {
    modeNew: string;
    modeFollowUp: string;
    updatingPrefix: string;
    medsCountLabel: string;
    checkInsCountLabel: string;
    followUpsCountLabel: string;
    followUpGreeting: string;
    followUpPlaceholder: string;
    followUpCta: string;
    followUpSaving: string;
    followUpHint: string;
    followUpReadyHint: string;
    attachFollowUpBtn: string;
  }
> = {
  en: {
    modeNew: 'New Discharge Plan',
    modeFollowUp: 'Add Follow-Up Report',
    updatingPrefix: 'Updating:',
    medsCountLabel: 'meds',
    checkInsCountLabel: 'check-ins',
    followUpsCountLabel: 'follow-ups',
    followUpGreeting:
      'Your original discharge summary and recent daily check-ins are loaded. Attach your doctor’s follow-up prescription, OPD note, or lab report (or ask a question) — I’ll compare changes against your current plan, re-check drug interactions, and update your schedule.',
    followUpPlaceholder: 'Describe what the doctor changed, or ask about your report, medicines, or check-ins...',
    followUpCta: 'Update Selected Plan',
    followUpSaving: 'Updating Recovery Plan...',
    followUpHint: 'Attach a doctor follow-up photo/PDF or share updates to revise this plan.',
    followUpReadyHint: 'Follow-up details reviewed — click Update Selected Plan to save changes.',
    attachFollowUpBtn: 'Attach Follow-Up',
  },
  hi: {
    modeNew: 'नया डिस्चार्ज प्लान',
    modeFollowUp: 'फ़ॉलो-अप रिपोर्ट जोड़ें',
    updatingPrefix: 'अपडेट हो रहा है:',
    medsCountLabel: 'दवाएँ',
    checkInsCountLabel: 'चेक-इन',
    followUpsCountLabel: 'फ़ॉलो-अप',
    followUpGreeting:
      'आपकी पुरानी डिस्चार्ज रिपोर्ट और हाल के डेली चेक-इन लोड हैं। डॉक्टर की फ़ॉलो-अप पर्ची, OPD नोट या लैब रिपोर्ट अपलोड करें (या सवाल पूछें) — मैं पुराने प्लान और चेक-इन से मिलाकर दवाओं की सुरक्षा जांचूंगा और शेड्यूल अपडेट करूंगा।',
    followUpPlaceholder: 'डॉक्टर ने क्या बदला लिखें, या पुरानी रिपोर्ट/चेक-इन के बारे में पूछें...',
    followUpCta: 'चुना हुआ प्लान अपडेट करें',
    followUpSaving: 'प्लान अपडेट हो रहा है...',
    followUpHint: 'इस प्लान को अपडेट करने के लिए फ़ॉलो-अप फोटो/PDF जोड़ें या बदलाव लिखें।',
    followUpReadyHint: 'फ़ॉलो-अप जानकारी तैयार है — बदलाव सहेजने के लिए अपडेट पर क्लिक करें।',
    attachFollowUpBtn: 'फ़ॉलो-अप जोड़ें',
  },
  ta: {
    modeNew: 'புதிய டிஸ்சார்ஜ் திட்டம்',
    modeFollowUp: 'தொடர் அறிக்கை சேர்',
    updatingPrefix: 'புதுப்பிக்கப்படுவது:',
    medsCountLabel: 'மருந்துகள்',
    checkInsCountLabel: 'சரிபார்ப்புகள்',
    followUpsCountLabel: 'தொடர் அறிக்கைகள்',
    followUpGreeting:
      'உங்கள் முந்தைய டிஸ்சார்ஜ் அறிக்கை மற்றும் சமீபத்திய தினசரி சரிபார்ப்புகள் ஏற்றப்பட்டுள்ளன. மருத்துவரின் தொடர் பரிந்துரை, OPD குறிப்பு அல்லது ஆய்வக அறிக்கையை இணைக்கவும் — உங்கள் திட்டத்துடன் ஒப்பிட்டு புதுப்பிப்பேன்.',
    followUpPlaceholder: 'மருத்துவர் மாற்றியதை எழுதுங்கள் அல்லது உங்கள் அறிக்கை பற்றி கேளுங்கள்...',
    followUpCta: 'தேர்ந்தெடுத்த திட்டத்தை புதுப்பி',
    followUpSaving: 'திட்டம் புதுப்பிக்கப்படுகிறது...',
    followUpHint: 'இத்திட்டத்தைப் புதுப்பிக்க தொடர் அறிக்கை படம்/PDF அல்லது குறிப்பு சேர்க்கவும்.',
    followUpReadyHint: 'தொடர் விவரங்கள் தயார் — மாற்றங்களைச் சேமிக்க புதுப்பிக்கவும்.',
    attachFollowUpBtn: 'தொடர் அறிக்கை',
  },
  bn: {
    modeNew: 'নতুন ডিসচার্জ প্ল্যান',
    modeFollowUp: 'ফলো-আপ রিপোর্ট যোগ করুন',
    updatingPrefix: 'আপডেট হচ্ছে:',
    medsCountLabel: 'ওষুধ',
    checkInsCountLabel: 'চেক-ইন',
    followUpsCountLabel: 'ফলো-আপ',
    followUpGreeting:
      'আপনার আগের ডিসচার্জ রিপোর্ট এবং সাম্প্রতিক দৈনিক চেক-ইনগুলো লোড করা আছে। ডাক্তারের ফলো-আপ প্রেসক্রিপশন, OPD নোট বা ল্যাব রিপোর্ট আপলোড করুন (অথবা প্রশ্ন করুন) — আমি আগের প্ল্যানের সাথে মিলিয়ে সময়সূচী আপডেট করব।',
    followUpPlaceholder: 'ডাক্তার কী বদলেছেন লিখুন, বা আপনার রিপোর্ট ও চেক-ইন নিয়ে প্রশ্ন করুন...',
    followUpCta: 'নির্বাচিত প্ল্যান আপডেট করুন',
    followUpSaving: 'প্ল্যান আপডেট হচ্ছে...',
    followUpHint: 'এই প্ল্যান আপডেট করতে ফলো-আপ ছবি/PDF যোগ করুন বা পরিবর্তন লিখুন।',
    followUpReadyHint: 'ফলো-আপ তথ্য প্রস্তুত — পরিবর্তন সংরক্ষণ করতে আপডেট বাটনে ক্লিক করুন।',
    attachFollowUpBtn: 'ফলো-আপ যোগ করুন',
  },
};

interface ChatMessage {
  id: string;
  speaker: 'patient' | 'assistant';
  text: string;
  source?: 'chat' | 'voice';
}

interface RedFlagAlertPayload {
  severity: 'stable' | 'caution' | 'red_flag';
  matchedTriggers: string[];
  escalationProtocol: string;
}

interface ScannedMedicineInfo {
  previewUrl: string;
  medicineName: string;
  primaryUse: string;
  timingTip: string;
  cautionNote: string;
}

interface FrontIntakePanelProps {
  language: LanguageCode;
  selectedPlan: RecoveryPlan | null;
  hasSavedPlans: boolean;
  checkIns: DailyCheckIn[];
  followUps: FollowUpReport[];
  uploadMode: 'new' | 'followup';
  onChangeUploadMode: (mode: 'new' | 'followup') => void;
  fileBase64?: string;
  fileMime?: string;
  fileName: string | null;
  previewUrl: string | null;
  attachmentVersion: number;
  isAnalyzing: boolean;
  errorMessage: string | null;
  onTriggerFileSelect: () => void;
  onFileDropped: (file: File | undefined) => void;
  onClearFile: () => void;
  onLoadSampleAndReview: () => void;
  onBuildFinalPlan: (intakeNotes: string) => Promise<void>;
}

type CallState = 'idle' | 'connecting' | 'active';

function downsampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === 16000) return input;
  const ratio = inputSampleRate / 16000;
  const newLength = Math.floor(input.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      sum += input[j];
      count++;
    }
    result[i] = count > 0 ? sum / count : input[start] ?? 0;
  }
  return result;
}

function pcmFloatToBase64(floatSamples: Float32Array): string {
  const int16 = new Int16Array(floatSamples.length);
  for (let i = 0; i < floatSamples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, floatSamples[i]));
    int16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64PcmToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }
  return float32;
}

function formatDuration(seconds: number): string {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function FrontIntakePanel({
  language,
  selectedPlan,
  hasSavedPlans,
  checkIns,
  followUps,
  uploadMode,
  onChangeUploadMode,
  fileBase64,
  fileMime,
  fileName,
  previewUrl,
  attachmentVersion,
  isAnalyzing,
  errorMessage,
  onTriggerFileSelect,
  onFileDropped,
  onClearFile,
  onLoadSampleAndReview,
  onBuildFinalPlan,
}: FrontIntakePanelProps) {
  const copy = UI_COPY[language];
  const fuCopy = FOLLOWUP_MODE_COPY[language];
  const isFollowUpMode = Boolean(selectedPlan && uploadMode === 'followup');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [readyToBuildPlan, setReadyToBuildPlan] = useState(false);
  const [intakeSummary, setIntakeSummary] = useState('');
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [isScanningMedicine, setIsScanningMedicine] = useState(false);
  const [scannedMedicine, setScannedMedicine] = useState<ScannedMedicineInfo | null>(null);
  const [showCameraMenu, setShowCameraMenu] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const [callState, setCallState] = useState<CallState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [redFlagAlert, setRedFlagAlert] = useState<RedFlagAlertPayload | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const callStateRef = useRef<CallState>('idle');
  const mutedRef = useRef(false);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastReviewedVersionRef = useRef(0);
  const medicineCameraInputRef = useRef<HTMLInputElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraMenuRef = useRef<HTMLDivElement | null>(null);
  const pendingLiveAttachmentRef = useRef<{
    data: string;
    mimeType: string;
    fileName: string;
  } | null>(null);

  const hasReport = Boolean(fileBase64);
  const canBuildPlan = Boolean(fileBase64 || messages.some((m) => m.speaker === 'patient'));

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    if (callState !== 'active') return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [callState]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const buildCombinedIntakeNotes = (summaryStr: string, msgs: ChatMessage[]): string => {
    const patientNotes = msgs
      .filter((m) => m.speaker === 'patient')
      .map((m) => m.text.trim())
      .filter(Boolean);
    const blocks = [
      summaryStr.trim() ? `Clarifying summary: ${summaryStr.trim()}` : '',
      patientNotes.length > 0 ? `Patient/caregiver replies: ${patientNotes.join(' | ')}` : '',
    ].filter(Boolean);
    return blocks.join('\n');
  };

  const stopAllOutputAudio = () => {
    activeSourcesRef.current.forEach((node) => {
      try {
        node.stop();
      } catch {
        // ignore
      }
    });
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setIsAssistantSpeaking(false);
  };

  const cleanupResources = () => {
    stopAllOutputAudio();

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {
        // ignore
      }
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {
        // ignore
      }
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (inputCtxRef.current) {
      inputCtxRef.current.close().catch(() => {});
      inputCtxRef.current = null;
    }
    if (outputCtxRef.current) {
      outputCtxRef.current.close().catch(() => {});
      outputCtxRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
  };

  const stopMedicineCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      cleanupResources();
      stopMedicineCamera();
    };
  }, []);

  useEffect(() => {
    if (!isCameraOpen || !cameraStreamRef.current || !cameraVideoRef.current) return;
    const videoEl = cameraVideoRef.current;
    videoEl.srcObject = cameraStreamRef.current;
    videoEl.play().catch(() => {});
  }, [isCameraOpen]);

  useEffect(() => {
    if (!showCameraMenu) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (cameraMenuRef.current && !cameraMenuRef.current.contains(event.target as Node)) {
        setShowCameraMenu(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowCameraMenu(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showCameraMenu]);

  const appendLiveTranscript = (speaker: 'patient' | 'assistant', chunk: string) => {
    const clean = chunk.trim();
    if (!clean) return;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.speaker === speaker && last.source === 'voice') {
        const needsSpace = !last.text.endsWith(' ') && !clean.startsWith(' ');
        return [
          ...prev.slice(0, -1),
          { ...last, text: `${last.text}${needsSpace ? ' ' : ''}${clean}` },
        ];
      }
      return [
        ...prev,
        { id: `${Date.now()}_${Math.random()}`, speaker, text: clean, source: 'voice' },
      ];
    });
  };

  const playPcmChunk = (base64Audio: string) => {
    const outputCtx = outputCtxRef.current;
    if (!outputCtx) return;
    if (outputCtx.state === 'suspended') {
      outputCtx.resume().catch(() => {});
    }
    const samples = base64PcmToFloat32(base64Audio);
    if (samples.length === 0) return;

    const buffer = outputCtx.createBuffer(1, samples.length, 24000);
    buffer.getChannelData(0).set(samples);

    const node = outputCtx.createBufferSource();
    node.buffer = buffer;
    node.connect(outputCtx.destination);

    const startTime = Math.max(outputCtx.currentTime, nextStartTimeRef.current);
    node.start(startTime);
    nextStartTimeRef.current = startTime + buffer.duration;

    activeSourcesRef.current.add(node);
    setIsAssistantSpeaking(true);

    node.onended = () => {
      activeSourcesRef.current.delete(node);
      if (activeSourcesRef.current.size === 0) {
        setIsAssistantSpeaking(false);
      }
    };
  };

  const buildExistingPlanContextPayload = () => {
    if (!isFollowUpMode || !selectedPlan) return null;
    return {
      title: selectedPlan.title,
      hospitalName: selectedPlan.hospitalName,
      dischargeDate: selectedPlan.dischargeDate,
      patientContext: selectedPlan.patientContext,
      plainSummary: selectedPlan.plainSummary,
      medicines: selectedPlan.medicines,
      conflicts: selectedPlan.conflicts,
      dietPlan: selectedPlan.dietPlan,
      activityRules: selectedPlan.activityRules,
      redFlags: selectedPlan.redFlags,
      followUpAppointments: selectedPlan.followUpAppointments,
      clinicianNote: selectedPlan.clinicianNote,
    };
  };

  const callIntakeChatApi = async (updatedMessages: ChatMessage[]) => {
    setIsThinking(true);
    setChatError(null);
    try {
      const existingPlanContext = buildExistingPlanContextPayload();
      const res = await fetch('/api/intake/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.speaker === 'assistant' ? 'assistant' : 'user',
            text: m.text,
          })),
          imageBase64: fileBase64,
          mimeType: fileMime,
          language,
          existingPlanContext,
          checkIns: existingPlanContext ? checkIns.slice(0, 8) : [],
          previousFollowUps: existingPlanContext ? followUps.slice(0, 6) : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not reach intake assistant.');
      }
      if (data.reply) {
        setMessages((prev) => [
          ...prev,
          { id: `ast_${Date.now()}`, speaker: 'assistant', text: data.reply, source: 'chat' },
        ]);
      }
      const rawReplies: string[] = Array.isArray(data.followUpQuestions)
        ? data.followUpQuestions.map(String)
        : [];
      const isReady = Boolean(data.readyToBuildPlan);
      const duplicateCtaPattern =
        /\b(update\s+(the\s+|my\s+)?(selected\s+)?plan|build\s+(the\s+|my\s+)?(final\s+)?(recovery\s+)?plan|save\s+(the\s+|my\s+)?plan)\b/i;
      const filteredReplies = isReady
        ? []
        : rawReplies.filter((item) => {
            const normalized = item.trim().toLowerCase();
            if (!normalized) return false;
            if (
              normalized === fuCopy.followUpCta.toLowerCase() ||
              normalized === copy.intakeBuildFinalPlan.toLowerCase()
            ) {
              return false;
            }
            return !duplicateCtaPattern.test(normalized);
          });
      setQuickReplies(filteredReplies);
      setReadyToBuildPlan(isReady);
      if (typeof data.intakeSummaryForPlan === 'string' && data.intakeSummaryForPlan.trim()) {
        setIntakeSummary(data.intakeSummaryForPlan);
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Intake assistant error.');
    } finally {
      setIsThinking(false);
    }
  };

  const sendAttachmentOverLiveWs = (
    data: string,
    mimeType: string | undefined,
    name: string | null,
  ) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const safeName = name || 'discharge_report';
    setChatError(null);
    setIsThinking(true);
    setMessages((prev) => [
      ...prev,
      {
        id: `usr_att_${Date.now()}`,
        speaker: 'patient',
        text: name ? `${copy.selectedFileLabel} ${name}` : 'Discharge document attached',
        source: 'chat',
      },
    ]);
    wsRef.current.send(
      JSON.stringify({
        type: 'attachment',
        data,
        mimeType: mimeType || 'image/jpeg',
        fileName: safeName,
      }),
    );
  };

  useEffect(() => {
    if (attachmentVersion === 0 || attachmentVersion === lastReviewedVersionRef.current) return;
    lastReviewedVersionRef.current = attachmentVersion;

    if (!fileBase64) return;

    if (callStateRef.current === 'active' && wsRef.current?.readyState === WebSocket.OPEN) {
      sendAttachmentOverLiveWs(fileBase64, fileMime, fileName);
      return;
    }

    if (callStateRef.current === 'connecting') {
      pendingLiveAttachmentRef.current = {
        data: fileBase64,
        mimeType: fileMime || 'image/jpeg',
        fileName: fileName || 'discharge_report',
      };
      setIsThinking(true);
      return;
    }

    const attachmentNote: ChatMessage = {
      id: `usr_att_${Date.now()}`,
      speaker: 'patient',
      text: fileName ? `${copy.selectedFileLabel} ${fileName}` : 'Discharge document attached',
      source: 'chat',
    };
    const nextMsgs = [...messages, attachmentNote];
    setMessages(nextMsgs);
    callIntakeChatApi(nextMsgs);
  }, [attachmentVersion]);

  const sendUserText = async (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setChatError(null);

    if (callStateRef.current === 'active' && wsRef.current?.readyState === WebSocket.OPEN) {
      setMessages((prev) => [
        ...prev,
        { id: `usr_${Date.now()}`, speaker: 'patient', text: clean, source: 'voice' },
      ]);
      wsRef.current.send(JSON.stringify({ type: 'text', text: clean }));
      return;
    }

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      speaker: 'patient',
      text: clean,
      source: 'chat',
    };
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs);
    setQuickReplies([]);
    await callIntakeChatApi(nextMsgs);
  };

  const identifyMedicineImage = async (dataUrl: string, mimeType: string) => {
    setChatError(null);
    setIsScanningMedicine(true);
    setScannedMedicine(null);

    try {
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const res = await fetch('/api/medicine/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: mimeType || 'image/jpeg',
          language,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not identify medicine photo.');
      }

      const medName = String(data.medicineName || '').trim();
      const medUse = String(data.primaryUse || '').trim();
      const summaryLine =
        String(data.chatInputText || '').trim() ||
        [medName, medUse].filter(Boolean).join(' — ');

      setScannedMedicine({
        previewUrl: dataUrl,
        medicineName: medName || copy.medicineIdentifiedLabel,
        primaryUse: medUse,
        timingTip: String(data.timingTip || '').trim(),
        cautionNote: String(data.cautionNote || '').trim(),
      });

      if (summaryLine) {
        setInputText((prev) => (prev.trim() ? `${prev.trim()} | ${summaryLine}` : summaryLine));
        window.setTimeout(() => chatInputRef.current?.focus(), 60);
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Failed to read medicine photo.');
    } finally {
      setIsScanningMedicine(false);
    }
  };

  const handleMedicinePhotoSelected = (file: File | undefined) => {
    if (!file) return;
    setChatError(null);
    setIsScanningMedicine(true);
    setScannedMedicine(null);

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        setIsScanningMedicine(false);
        setChatError('Could not read the selected photo.');
        return;
      }
      await identifyMedicineImage(dataUrl, file.type || 'image/jpeg');
    };
    reader.onerror = () => {
      setIsScanningMedicine(false);
      setChatError('Could not read the selected photo.');
    };
    reader.readAsDataURL(file);
  };

  const openLiveMedicineCamera = async () => {
    setShowCameraMenu(false);
    setChatError(null);
    setScannedMedicine(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setChatError(copy.cameraPermissionError);
      return;
    }

    try {
      stopMedicineCamera();
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
      cameraStreamRef.current = stream;
      setIsCameraOpen(true);
    } catch {
      stopMedicineCamera();
      setChatError(copy.cameraPermissionError);
    }
  };

  const handleCaptureFromCamera = async () => {
    const videoEl = cameraVideoRef.current;
    if (!videoEl || videoEl.videoWidth === 0 || videoEl.videoHeight === 0) return;

    const maxDim = 1280;
    const scale = Math.min(1, maxDim / Math.max(videoEl.videoWidth, videoEl.videoHeight));
    const width = Math.max(1, Math.round(videoEl.videoWidth * scale));
    const height = Math.max(1, Math.round(videoEl.videoHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoEl, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

    stopMedicineCamera();
    await identifyMedicineImage(dataUrl, 'image/jpeg');
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isThinking || isScanningMedicine) return;
    const textToSend = inputText;
    setInputText('');
    setScannedMedicine(null);
    await sendUserText(textToSend);
  };

  const startCall = async () => {
    if (callState !== 'idle') return;
    setChatError(null);
    setRedFlagAlert(null);
    setElapsedSeconds(0);
    setIsMuted(false);
    mutedRef.current = false;
    setCallState('connecting');
    callStateRef.current = 'connecting';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/live-intake`);
      wsRef.current = ws;

      ws.onopen = () => {
        const existingPlanContext = buildExistingPlanContextPayload();
        ws.send(
          JSON.stringify({
            type: 'start',
            language,
            hasReport,
            fileName: fileName || undefined,
            imageBase64: fileBase64,
            imageMimeType: fileMime,
            chatSummary: buildCombinedIntakeNotes(intakeSummary, messages),
            existingPlanContext,
            checkIns: existingPlanContext ? checkIns.slice(0, 8) : [],
            previousFollowUps: existingPlanContext ? followUps.slice(0, 6) : [],
          }),
        );
      };

      ws.onmessage = (event) => {
        let msg: {
          type?: string;
          data?: string;
          text?: string;
          summary?: string;
          fileName?: string;
          message?: string;
          result?: RedFlagAlertPayload;
        };
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === 'ready') {
          setCallState('active');
          callStateRef.current = 'active';

          const source = inputCtx.createMediaStreamSource(stream);
          const processor = inputCtx.createScriptProcessor(4096, 1, 1);
          sourceRef.current = source;
          processorRef.current = processor;

          const silentGain = inputCtx.createGain();
          silentGain.gain.value = 0;

          processor.onaudioprocess = (ev) => {
            if (callStateRef.current !== 'active' || mutedRef.current) return;
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
            const channelData = ev.inputBuffer.getChannelData(0);
            const resampled = downsampleTo16k(channelData, inputCtx.sampleRate);
            const b64 = pcmFloatToBase64(resampled);
            wsRef.current.send(JSON.stringify({ type: 'audio', data: b64 }));
          };

          source.connect(processor);
          processor.connect(silentGain);
          silentGain.connect(inputCtx.destination);

          if (pendingLiveAttachmentRef.current) {
            const queued = pendingLiveAttachmentRef.current;
            pendingLiveAttachmentRef.current = null;
            sendAttachmentOverLiveWs(queued.data, queued.mimeType, queued.fileName);
          }
          return;
        }

        if (msg.type === 'attachmentProcessing') {
          setIsThinking(true);
          return;
        }
        if (msg.type === 'attachmentReady') {
          setIsThinking(false);
          if (typeof msg.summary === 'string' && msg.summary.trim()) {
            setIntakeSummary(msg.summary.trim());
          }
          return;
        }
        if (msg.type === 'attachmentError') {
          setIsThinking(false);
          setChatError(msg.message || 'Could not read the uploaded discharge report.');
          return;
        }

        if (msg.type === 'audio' && msg.data) {
          playPcmChunk(msg.data);
          return;
        }
        if (msg.type === 'inputTranscript' && msg.text) {
          appendLiveTranscript('patient', msg.text);
          return;
        }
        if (msg.type === 'outputTranscript' && msg.text) {
          appendLiveTranscript('assistant', msg.text);
          return;
        }
        if (msg.type === 'interrupted') {
          stopAllOutputAudio();
          return;
        }
        if (msg.type === 'redFlagAlert' && msg.result) {
          setRedFlagAlert(msg.result);
          return;
        }
        if (msg.type === 'error') {
          pendingLiveAttachmentRef.current = null;
          setIsThinking(false);
          setChatError(msg.message || copy.wsError);
          cleanupResources();
          setCallState('idle');
          callStateRef.current = 'idle';
          return;
        }
        if (msg.type === 'closed') {
          pendingLiveAttachmentRef.current = null;
          setIsThinking(false);
          cleanupResources();
          setCallState('idle');
          callStateRef.current = 'idle';
        }
      };

      ws.onerror = () => {
        pendingLiveAttachmentRef.current = null;
        setIsThinking(false);
        setChatError(copy.wsError);
        cleanupResources();
        setCallState('idle');
        callStateRef.current = 'idle';
      };

      ws.onclose = () => {
        pendingLiveAttachmentRef.current = null;
        setIsThinking(false);
        if (callStateRef.current !== 'idle') {
          cleanupResources();
          setCallState('idle');
          callStateRef.current = 'idle';
        }
      };
    } catch {
      setChatError(copy.micRequiredError);
      cleanupResources();
      setCallState('idle');
      callStateRef.current = 'idle';
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    mutedRef.current = next;
  };

  const endCall = () => {
    cleanupResources();
    setCallState('idle');
    callStateRef.current = 'idle';
  };

  const handleFinalizeClick = async () => {
    if (callState !== 'idle') {
      endCall();
    }
    const notes = buildCombinedIntakeNotes(intakeSummary, messages);
    await onBuildFinalPlan(notes);
  };

  const starterPrompts =
    messages.length === 0 && !hasReport && !isFollowUpMode
      ? [copy.intakeChipSample, copy.intakeChipPainkiller, copy.intakeChipAskFood]
      : [];

  const combinedError = errorMessage || chatError;
  const waveActive = callState === 'active' && (isAssistantSpeaking || !isMuted);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingFile(false);
        onFileDropped(e.dataTransfer.files?.[0]);
      }}
      className={`h-full flex flex-col justify-between bg-white border rounded-2xl shadow-[0_14px_40px_-18px_rgba(15,23,42,0.08)] overflow-hidden divide-y divide-slate-200/80 transition-colors ${
        isDraggingFile ? 'border-teal-600 ring-2 ring-teal-600/20' : 'border-slate-200'
      }`}
    >
      {/* Console Header */}
      <div className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 bg-white">
        <div className="min-w-0">
          <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight text-slate-900">
            {copy.intakeAssistantTitle}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 sm:line-clamp-1">
            {copy.intakeAssistantSub}
          </p>
        </div>

        <div
          className={`w-full sm:w-auto shrink-0 ${
            callState === 'active'
              ? 'grid grid-cols-3 sm:flex items-center gap-2'
              : 'grid grid-cols-2 sm:flex items-center gap-2'
          }`}
        >
          <button
            type="button"
            onClick={onTriggerFileSelect}
            className="min-h-[44px] sm:min-h-[38px] px-3.5 py-2 text-xs font-medium text-slate-700 hover:text-teal-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl sm:rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Paperclip className="w-3.5 h-3.5 text-teal-700 shrink-0" />
            <span className="truncate">
              {isFollowUpMode ? fuCopy.attachFollowUpBtn : copy.attachFileBtn}
            </span>
          </button>

          {callState === 'idle' && (
            <button
              type="button"
              onClick={startCall}
              className="min-h-[44px] sm:min-h-[38px] px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 active:scale-[0.99] rounded-xl sm:rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{copy.startLiveCall}</span>
            </button>
          )}

          {callState === 'connecting' && (
            <button
              type="button"
              onClick={endCall}
              className="min-h-[44px] sm:min-h-[38px] px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl sm:rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700 shrink-0" />
              <span className="truncate">{copy.liveCallConnecting}</span>
            </button>
          )}

          {callState === 'active' && (
            <>
              <button
                type="button"
                onClick={toggleMute}
                className={`min-h-[44px] sm:min-h-[38px] px-3 py-2 text-xs font-medium rounded-xl sm:rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center justify-center gap-1.5 ${
                  isMuted
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {isMuted ? (
                  <MicOff className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Mic className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                )}
                <span className="truncate">{isMuted ? copy.unmuteMic : copy.muteMic}</span>
              </button>
              <button
                type="button"
                onClick={endCall}
                className="min-h-[44px] sm:min-h-[38px] px-3 py-2 text-xs font-medium text-white bg-red-700 hover:bg-red-800 rounded-xl sm:rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <PhoneOff className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{copy.endLiveCall}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mode Switcher Bar (Shown when a Saved Recovery Plan exists or is selected) */}
      {(selectedPlan || hasSavedPlans) && (
        <div className="px-4 sm:px-6 py-2.5 bg-slate-50/75 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div
            role="tablist"
            aria-label="Upload mode"
            className="grid grid-cols-2 sm:inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg shrink-0"
          >
            <button
              type="button"
              role="tab"
              aria-selected={uploadMode === 'followup'}
              onClick={() => onChangeUploadMode('followup')}
              className={`min-h-[36px] sm:min-h-[32px] px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                uploadMode === 'followup'
                  ? 'bg-white text-teal-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {fuCopy.modeFollowUp}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={uploadMode === 'new'}
              onClick={() => onChangeUploadMode('new')}
              className={`min-h-[36px] sm:min-h-[32px] px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                uploadMode === 'new'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {fuCopy.modeNew}
            </button>
          </div>

          {isFollowUpMode && selectedPlan && (
            <p className="text-xs text-slate-600 truncate">
              <span className="text-slate-400">{fuCopy.updatingPrefix}</span>{' '}
              <span className="font-semibold text-teal-900">{selectedPlan.title}</span>
              <span className="text-slate-300 mx-1.5" aria-hidden="true">·</span>
              <span className="text-slate-500">
                {selectedPlan.medicines.length} {fuCopy.medsCountLabel}
              </span>
              <span className="text-slate-300 mx-1.5" aria-hidden="true">·</span>
              <span className="text-slate-500">
                {checkIns.length} {fuCopy.checkInsCountLabel}
              </span>
              {followUps.length > 0 && (
                <>
                  <span className="text-slate-300 mx-1.5" aria-hidden="true">·</span>
                  <span className="text-slate-500">
                    {followUps.length} {fuCopy.followUpsCountLabel}
                  </span>
                </>
              )}
            </p>
          )}
        </div>
      )}

      {/* Real-Time Live Voice Call Strip */}
      {callState === 'active' && (
        <div className="px-4 sm:px-6 py-3 bg-teal-950 text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <div className="flex items-center gap-0.5 h-4 shrink-0" aria-hidden="true">
              {[
                '[animation-delay:0ms]',
                '[animation-delay:150ms]',
                '[animation-delay:300ms]',
                '[animation-delay:120ms]',
                '[animation-delay:240ms]',
              ].map((delayClass, idx) => (
                <span
                  key={idx}
                  className={`w-0.5 h-3.5 rounded-full bg-teal-300 ${
                    waveActive ? `voice-bar ${delayClass}` : 'opacity-40'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-medium truncate">
              {isAssistantSpeaking
                ? copy.assistantSpeaking
                : isMuted
                ? copy.micMutedStatus
                : copy.liveCallReady}
            </span>
          </div>
          <span className="font-mono text-xs text-teal-200 tabular-nums shrink-0">
            {formatDuration(elapsedSeconds)}
          </span>
        </div>
      )}

      {/* Attached Discharge Paper Preview Strip (Only when a report is attached) */}
      {fileBase64 && (
        <div className="bg-teal-50/40 px-4 sm:px-6 py-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {previewUrl ? (
                <button
                  type="button"
                  onClick={() => setShowFullPreview((v) => !v)}
                  className="shrink-0 cursor-pointer rounded-md overflow-hidden border border-slate-200 bg-white hover:border-teal-600 transition-colors"
                  title={fileName ?? undefined}
                >
                  <img
                    src={previewUrl}
                    alt="Attached discharge summary thumbnail"
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 object-cover"
                  />
                </button>
              ) : (
                <div className="w-11 h-11 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-teal-700" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate">{fileName}</p>
                <p className="text-xs text-teal-800">{copy.readyForVision}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowFullPreview(false);
                onClearFile();
              }}
              className="min-h-[40px] px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-white rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>{copy.clearFileBtn}</span>
            </button>
          </div>

          {showFullPreview && previewUrl && (
            <img
              src={previewUrl}
              alt="Expanded discharge document preview"
              referrerPolicy="no-referrer"
              className="w-full max-h-60 object-contain rounded-lg border border-slate-200 bg-white"
            />
          )}
        </div>
      )}

      {/* Red-Flag Clinical Escalation Strip */}
      {redFlagAlert && (
        <div className="bg-red-50 px-4 sm:px-6 py-3.5 space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-red-900">
            <AlertOctagon className="w-4 h-4 text-red-700 shrink-0" />
            <span>
              {redFlagAlert.severity === 'red_flag'
                ? copy.urgentCallFlag
                : copy.cautionCallFlag}
            </span>
          </div>
          <p className="text-xs text-red-800">{redFlagAlert.escalationProtocol}</p>
        </div>
      )}

      {/* Conversation Feed */}
      <div
        ref={scrollRef}
        className="flex-1 px-4 sm:px-6 py-4 sm:py-5 min-h-[260px] sm:min-h-[310px] max-h-[52vh] sm:max-h-[420px] overflow-y-auto space-y-4 bg-white"
      >
        <div className="space-y-3.5">
          <div className="space-y-1 max-w-[94%] sm:max-w-[90%]">
            <p className="text-[11px] font-medium text-slate-400">DischargeDost</p>
            <div className="rounded-2xl rounded-tl-sm bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-800">
              {isFollowUpMode ? fuCopy.followUpGreeting : copy.intakeGreetingNoFile}
            </div>
          </div>

          {starterPrompts.length > 0 && callState === 'idle' && !isThinking && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {starterPrompts.map((chip, idx) => {
                const isSample = chip === copy.intakeChipSample;
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      if (isSample) {
                        onLoadSampleAndReview();
                      } else {
                        sendUserText(chip);
                      }
                    }}
                    className={`min-h-[44px] rounded-xl border px-3.5 py-3 text-left text-xs font-medium leading-snug transition-colors cursor-pointer flex items-center sm:items-start gap-2 ${
                      idx === 0
                        ? 'bg-teal-50/50 border-teal-200 text-teal-950 hover:bg-teal-50 hover:border-teal-400'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    {isSample && <FileImage className="w-4 h-4 text-teal-700 shrink-0 sm:mt-0.5" />}
                    <span>{chip}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {messages.map((entry) => {
          const isPatient = entry.speaker === 'patient';
          return (
            <div
              key={entry.id}
              className={`flex flex-col ${isPatient ? 'items-end' : 'items-start'} space-y-1`}
            >
              <span className="text-[11px] font-medium text-slate-400">
                {isPatient ? copy.homeSpeakerYou : 'DischargeDost'}
              </span>
              <div
                className={`max-w-[90%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  isPatient
                    ? 'bg-teal-700 text-white rounded-br-sm'
                    : 'bg-slate-100/85 text-slate-800 rounded-tl-sm'
                }`}
              >
                {entry.text}
              </div>
            </div>
          );
        })}

        {isThinking && (
          <div className="flex flex-col items-start space-y-1">
            <span className="text-[11px] font-medium text-slate-400">DischargeDost</span>
            <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-xs font-medium text-slate-600 bg-slate-100/85 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700 shrink-0" />
              <span>{copy.intakeReviewingAttachment}</span>
            </div>
          </div>
        )}

        {quickReplies.length > 0 && !readyToBuildPlan && callState === 'idle' && !isThinking && (
          <div className="flex flex-wrap gap-2 pt-1">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => sendUserText(reply)}
                className="min-h-[40px] px-3.5 py-2 text-xs font-medium text-teal-900 bg-teal-50/70 hover:bg-teal-100/80 border border-teal-200 rounded-xl sm:rounded-lg transition-colors text-left cursor-pointer"
              >
                {reply}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Composer Dock & Build Final Recovery Plan Row */}
      <div className="px-4 sm:px-6 py-4 bg-slate-50/60 space-y-3">
        <input
          ref={medicineCameraInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            handleMedicinePhotoSelected(e.target.files?.[0]);
            e.target.value = '';
          }}
        />

        {isCameraOpen && (
          <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
            <div className="relative bg-slate-950">
              <video
                ref={cameraVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full max-h-64 object-cover"
              />
            </div>
            <div className="p-2.5 bg-slate-900 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={stopMedicineCamera}
                className="min-h-[44px] sm:min-h-[38px] px-3.5 py-2 text-xs font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copy.cancelCameraBtn}
              </button>
              <button
                type="button"
                onClick={handleCaptureFromCamera}
                className="min-h-[44px] sm:min-h-[38px] px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5 shrink-0" />
                <span>{copy.capturePhotoBtn}</span>
              </button>
            </div>
          </div>
        )}

        {isScanningMedicine && (
          <div className="rounded-xl bg-white border border-teal-200 px-3.5 py-2.5 flex items-center gap-2.5 text-xs font-medium text-teal-900">
            <Loader2 className="w-4 h-4 animate-spin text-teal-700 shrink-0" />
            <span>{copy.scanningMedicineMsg}</span>
          </div>
        )}

        {scannedMedicine && !isScanningMedicine && (
          <div className="rounded-xl bg-white border border-teal-200 p-3 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <img
                src={scannedMedicine.previewUrl}
                alt={scannedMedicine.medicineName}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0"
              />
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-xs font-semibold text-slate-900">
                    {scannedMedicine.medicineName}
                  </span>
                  <span className="text-[11px] text-teal-700 font-medium">
                    · {copy.medicineIdentifiedLabel}
                  </span>
                </div>
                {scannedMedicine.primaryUse && (
                  <p className="text-xs text-slate-600 leading-snug">
                    {scannedMedicine.primaryUse}
                  </p>
                )}
                {scannedMedicine.timingTip && (
                  <p className="text-[11px] text-slate-500">
                    {scannedMedicine.timingTip}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setScannedMedicine(null)}
              aria-label="Dismiss medicine summary"
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <form
          onSubmit={handleSubmitForm}
          className="bg-white border border-slate-300/90 focus-within:border-teal-700 focus-within:ring-2 focus-within:ring-teal-700/15 rounded-xl p-1.5 flex items-center gap-1.5 sm:gap-2 transition-shadow"
        >
          <div ref={cameraMenuRef} className="relative shrink-0">
            <button
              type="button"
              disabled={isScanningMedicine}
              onClick={() => setShowCameraMenu((open) => !open)}
              title={copy.scanMedicineCameraTitle}
              aria-label={copy.scanMedicineCameraTitle}
              aria-expanded={showCameraMenu}
              aria-haspopup="menu"
              className={`min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                showCameraMenu || isCameraOpen
                  ? 'bg-teal-700 text-white'
                  : 'text-teal-700 hover:text-teal-900 hover:bg-teal-50'
              }`}
            >
              {isScanningMedicine ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </button>

            {showCameraMenu && (
              <div
                role="menu"
                className="absolute left-0 bottom-full mb-2 w-56 rounded-xl bg-white border border-slate-200 shadow-lg py-1.5 z-30"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={openLiveMedicineCamera}
                  className="w-full min-h-[44px] px-3.5 py-2 text-left text-xs font-medium text-slate-800 hover:bg-teal-50 hover:text-teal-900 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-teal-700 shrink-0" />
                  <span>{copy.openCameraOption}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowCameraMenu(false);
                    stopMedicineCamera();
                    medicineCameraInputRef.current?.click();
                  }}
                  className="w-full min-h-[44px] px-3.5 py-2 text-left text-xs font-medium text-slate-800 hover:bg-teal-50 hover:text-teal-900 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <ImagePlus className="w-4 h-4 text-teal-700 shrink-0" />
                  <span>{copy.uploadMedicineOption}</span>
                </button>
              </div>
            )}
          </div>

          <input
            ref={chatInputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isFollowUpMode ? fuCopy.followUpPlaceholder : copy.intakePlaceholder}
            className="flex-1 min-w-0 bg-transparent px-1.5 py-2 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isThinking || isScanningMedicine}
            className="min-h-[40px] px-3.5 sm:px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5 shrink-0" />
            <span>{copy.sendBtn}</span>
          </button>
        </form>

        {combinedError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800"
          >
            {combinedError}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-0.5">
          <div
            className={`flex items-start sm:items-center gap-2 text-xs leading-relaxed ${
              readyToBuildPlan && canBuildPlan
                ? 'text-emerald-800 font-medium'
                : 'text-slate-600'
            }`}
          >
            {readyToBuildPlan && canBuildPlan && (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5 sm:mt-0" />
            )}
            <span>
              {readyToBuildPlan && canBuildPlan
                ? isFollowUpMode
                  ? fuCopy.followUpReadyHint
                  : copy.intakeReadyBanner
                : isFollowUpMode
                ? fuCopy.followUpHint
                : copy.intakeUploadHint}
            </span>
          </div>

          <button
            type="button"
            disabled={!canBuildPlan || isAnalyzing}
            onClick={handleFinalizeClick}
            className={`w-full sm:w-auto min-h-[46px] sm:min-h-[40px] px-4 py-2.5 sm:py-2 text-xs font-semibold text-white rounded-xl sm:rounded-lg transition-all active:scale-[0.99] whitespace-nowrap shrink-0 cursor-pointer disabled:bg-slate-300 disabled:text-white disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
              readyToBuildPlan && canBuildPlan
                ? 'bg-emerald-700 hover:bg-emerald-800'
                : 'bg-teal-700 hover:bg-teal-800'
            }`}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>{isFollowUpMode ? fuCopy.followUpSaving : copy.analyzingBtn}</span>
              </>
            ) : (
              <>
                <span>{isFollowUpMode ? fuCopy.followUpCta : copy.intakeBuildFinalPlan}</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
