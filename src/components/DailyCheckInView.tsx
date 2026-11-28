import React, { useEffect, useRef, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  RotateCcw,
  Send,
  Square,
  Volume2,
} from 'lucide-react';
import { SAMPLE_CHECKIN_PRESETS_BY_LANG } from '../lib/sampleDischarge';
import { UI_COPY, type DailyCheckIn, type LanguageCode, type RecoveryPlan } from '../types';

interface DailyCheckInViewProps {
  plan: RecoveryPlan;
  language: LanguageCode;
  takenSlots: Record<string, boolean>;
  checkIns: DailyCheckIn[];
  onSubmitCheckIn: (payload: {
    symptomsText: string;
    audioBase64?: string;
    audioMimeType?: string;
    inputMode: 'text' | 'voice';
    medicinesTaken: string[];
  }) => Promise<DailyCheckIn | null>;
  isEvaluating: boolean;
  errorMessage: string | null;
  onViewClinicianBrief: () => void;
}

interface CheckInChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  source?: 'chat' | 'voice';
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

const CHAT_COPY: Record<
  LanguageCode,
  {
    greeting: string;
    inputPlaceholder: string;
    liveInputPlaceholder: string;
    transcribingMsg: string;
    thinkingMsg: string;
    readyHint: string;
    chatFirstHint: string;
    finalizeBtn: string;
    savingBtn: string;
    resetChatBtn: string;
    savedNotice: string;
    liveVoiceBtn: string;
  }
> = {
  en: {
    greeting:
      'Hi! How is the patient feeling today? Type, tap the mic to dictate, or start Live Voice to talk naturally — click Save Check-In below once you are done.',
    inputPlaceholder: 'Type how you feel, ask a question, or tap the mic...',
    liveInputPlaceholder: 'Live voice is active — speak naturally or type a follow-up...',
    transcribingMsg: 'Transcribing voice note...',
    thinkingMsg: 'Checking symptoms and preparing follow-up...',
    readyHint: 'Ready to log — tap Save Check-In whenever you are done.',
    chatFirstHint: 'Chat or talk live first — your check-in is saved only when you tap Save Check-In.',
    finalizeBtn: 'Save Check-In',
    savingBtn: 'Saving Check-In...',
    resetChatBtn: 'New Chat',
    savedNotice: 'Today’s check-in has been saved to your history below.',
    liveVoiceBtn: 'Live Voice',
  },
  hi: {
    greeting:
      'नमस्ते! मरीज़ आज कैसा महसूस कर रहे हैं? लिखें, माइक से बोलें या लाइव वॉयस शुरू करें — बातचीत पूरी होने पर नीचे चेक-इन सहेजें पर क्लिक करें।',
    inputPlaceholder: 'अपना हाल लिखें, सवाल पूछें या माइक दबाएं...',
    liveInputPlaceholder: 'लाइव वॉयस चालू है — सीधे बोलें या संदेश लिखें...',
    transcribingMsg: 'आवाज़ को टेक्स्ट में बदला जा रहा है...',
    thinkingMsg: 'लक्षणों की जांच और जवाब तैयार हो रहा है...',
    readyHint: 'जानकारी तैयार है — जब चाहें नीचे चेक-इन सहेजें दबाएं।',
    chatFirstHint: 'पहले आराम से बात करें — नीचे चेक-इन सहेजें दबाने पर ही यह दर्ज होगा।',
    finalizeBtn: 'चेक-इन सहेजें',
    savingBtn: 'चेक-इन सहेजा जा रहा है...',
    resetChatBtn: 'नई बातचीत',
    savedNotice: 'आज का चेक-इन नीचे इतिहास में सहेज दिया गया है।',
    liveVoiceBtn: 'लाइव वॉयस',
  },
  ta: {
    greeting:
      'வணக்கம்! இன்று நோயாளி எப்படி உணர்கிறார்? எழுதவும், மைக்கில் பேசவும் அல்லது நேரடி குரல் அழைப்பைத் தொடங்கவும் — முடிந்ததும் கீழே சேமிக்கவும்.',
    inputPlaceholder: 'அறிகுறிகளை எழுதுங்கள், கேள்வி கேளுங்கள் அல்லது மைக் அழுத்தவும்...',
    liveInputPlaceholder: 'நேரடி குரல் செயலில் உள்ளது — இயல்பாகப் பேசுங்கள் அல்லது எழுதுங்கள்...',
    transcribingMsg: 'குரல் பதிவை எழுத்தாக மாற்றுகிறது...',
    thinkingMsg: 'அறிகுறிகளைச் சரிபார்த்து பதில் தயாராகிறது...',
    readyHint: 'தயாராக உள்ளது — முடிந்ததும் கீழே உள்ள சேமி பொத்தானை அழுத்தவும்.',
    chatFirstHint: 'முதலில் பேசுங்கள் அல்லது எழுதுங்கள் — சேமி அழுத்திய பின்னரே பதிவாகும்.',
    finalizeBtn: 'சரிபார்ப்பை சேமி',
    savingBtn: 'சேமிக்கப்படுகிறது...',
    resetChatBtn: 'புதிய உரையாடல்',
    savedNotice: 'இன்றைய சரிபார்ப்பு கீழே வரலாற்றில் சேமிக்கப்பட்டது.',
    liveVoiceBtn: 'நேரடி குரல்',
  },
  bn: {
    greeting:
      'নমস্কার! রোগী আজ কেমন অনুভব করছেন? লিখুন, মাইকে বলুন বা লাইভ ভয়েসে সরাসরি কথা বলুন — শেষ হলে নিচে চেক-ইন সেভ করুন চাপুন।',
    inputPlaceholder: 'কেমন লাগছে লিখুন, প্রশ্ন করুন বা মাইক চাপুন...',
    liveInputPlaceholder: 'লাইভ ভয়েস চালু আছে — সরাসরি কথা বলুন বা লিখুন...',
    transcribingMsg: 'ভয়েস নোট টেক্সটে রূপান্তর করা হচ্ছে...',
    thinkingMsg: 'লক্ষণ যাচাই ও উত্তর তৈরি হচ্ছে...',
    readyHint: 'তথ্য প্রস্তুত — শেষ হলে নিচের চেক-ইন সেভ করুন বাটনে চাপুন।',
    chatFirstHint: 'আগে কথা বলুন বা লিখুন — নিচের সেভ বাটনে চাপলেই চেক-ইন সংরক্ষিত হবে।',
    finalizeBtn: 'চেক-ইন সেভ করুন',
    savingBtn: 'সেভ হচ্ছে...',
    resetChatBtn: 'নতুন চ্যাট',
    savedNotice: 'আজকের চেক-ইন নিচে ইতিহাসে সংরক্ষিত হয়েছে।',
    liveVoiceBtn: 'লাইভ ভয়েস',
  },
};

export function DailyCheckInView({
  plan,
  language,
  takenSlots,
  checkIns,
  onSubmitCheckIn,
  isEvaluating,
  errorMessage,
  onViewClinicianBrief,
}: DailyCheckInViewProps) {
  const copy = UI_COPY[language];
  const chatCopy = CHAT_COPY[language];
  const presets = SAMPLE_CHECKIN_PRESETS_BY_LANG[language];

  const [messages, setMessages] = useState<CheckInChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [isChatThinking, setIsChatThinking] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [liveSeverity, setLiveSeverity] = useState<'stable' | 'caution' | 'red_flag' | null>(null);
  const [liveRedFlags, setLiveRedFlags] = useState<string[]>([]);
  const [readyToFinalize, setReadyToFinalize] = useState(false);
  const [compiledSummary, setCompiledSummary] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  // Voice-note dictation state (when live call is idle)
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [usedVoiceInput, setUsedVoiceInput] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  // Real-time Gemini Live voice call state
  const [callState, setCallState] = useState<CallState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [latestResult, setLatestResult] = useState<DailyCheckIn | null>(checkIns[0] ?? null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Refs for Live Voice WebSocket & WebAudio (avoid stale closures)
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
  const voiceTurnClosedRef = useRef(true);

  const messagesRef = useRef<CheckInChatMessage[]>([]);
  const compiledSummaryRef = useRef('');
  const usedVoiceInputRef = useRef(false);
  const isFinalizingRef = useRef(false);

  const medicinesTaken = plan.medicines
    .filter((m, idx) => {
      const key = `${m.slot}_${m.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${idx}`.slice(
        0,
        120,
      );
      return Boolean(takenSlots[key]);
    })
    .map((m) => m.name);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    compiledSummaryRef.current = compiledSummary;
  }, [compiledSummary]);

  useEffect(() => {
    usedVoiceInputRef.current = usedVoiceInput;
  }, [usedVoiceInput]);

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
  }, [messages, isChatThinking]);

  const stopAllOutputAudio = () => {
    activeSourcesRef.current.forEach((node) => {
      try {
        node.stop();
      } catch {
        // ignore if already stopped
      }
    });
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setIsAssistantSpeaking(false);
  };

  const cleanupLiveResources = () => {
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

  useEffect(() => {
    return () => {
      cleanupLiveResources();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const endLiveCall = () => {
    cleanupLiveResources();
    setCallState('idle');
    callStateRef.current = 'idle';
    voiceTurnClosedRef.current = true;
  };

  const resetChat = () => {
    endLiveCall();
    setMessages([]);
    messagesRef.current = [];
    setQuickReplies([]);
    setInputText('');
    setChatError(null);
    setMicError(null);
    setLiveSeverity(null);
    setLiveRedFlags([]);
    setReadyToFinalize(false);
    setCompiledSummary('');
    compiledSummaryRef.current = '';
    setUsedVoiceInput(false);
    usedVoiceInputRef.current = false;
    setJustSaved(false);
  };

  const finalizeCheckInWithData = async (
    overrideMessages?: CheckInChatMessage[],
    overrideSummary?: string,
    overrideDraft?: string,
    overrideVoiceMode?: boolean,
  ) => {
    if (isFinalizingRef.current) return;

    const msgsToUse = overrideMessages ?? messagesRef.current;
    const summaryToUse = (overrideSummary ?? compiledSummaryRef.current).trim();
    const draftText = (overrideDraft ?? inputText).trim();
    const patientReplies = msgsToUse
      .filter((m) => m.role === 'user')
      .map((m) => m.text.trim())
      .filter(Boolean);

    const combinedPatientNotes = [
      summaryToUse,
      patientReplies.length > 0 ? `Patient replies: ${patientReplies.join(' | ')}` : '',
      draftText ? `Additional note: ${draftText}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    if (!combinedPatientNotes) return;

    isFinalizingRef.current = true;
    if (callStateRef.current !== 'idle') {
      endLiveCall();
    }

    try {
      const result = await onSubmitCheckIn({
        symptomsText: combinedPatientNotes,
        inputMode: overrideVoiceMode ?? usedVoiceInputRef.current ? 'voice' : 'text',
        medicinesTaken,
      });
      if (result) {
        setLatestResult(result);
        resetChat();
        setJustSaved(true);
      }
    } finally {
      isFinalizingRef.current = false;
    }
  };

  const appendLiveVoiceTranscript = (role: 'user' | 'assistant', chunk: string) => {
    const clean = chunk.trim();
    if (!clean) return;
    setJustSaved(false);
    if (role === 'user') {
      setUsedVoiceInput(true);
      usedVoiceInputRef.current = true;
      setReadyToFinalize(true);
    }

    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role && last.source === 'voice' && !voiceTurnClosedRef.current) {
        const needsSpace = !last.text.endsWith(' ') && !clean.startsWith(' ');
        const updated = {
          ...last,
          text: `${last.text}${needsSpace ? ' ' : ''}${clean}`,
        };
        const next = [...prev.slice(0, -1), updated];
        messagesRef.current = next;
        return next;
      }
      voiceTurnClosedRef.current = false;
      const next: CheckInChatMessage[] = [
        ...prev,
        { id: `live_${Date.now()}_${Math.random()}`, role, text: clean, source: 'voice' },
      ];
      messagesRef.current = next;
      return next;
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

  const startLiveCall = async () => {
    if (callState !== 'idle' || isEvaluating) return;
    if (isRecording) {
      stopRecording();
    }
    setChatError(null);
    setMicError(null);
    setQuickReplies([]);
    setJustSaved(false);
    setElapsedSeconds(0);
    setIsMuted(false);
    mutedRef.current = false;
    voiceTurnClosedRef.current = true;
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

      const priorChatSummary = messagesRef.current
        .map((m) => `${m.role === 'assistant' ? 'DischargeDost' : 'Patient'}: ${m.text}`)
        .join('\n');

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/live-checkin`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'start',
            language,
            medicinesTaken,
            chatSummary: priorChatSummary,
            planContext: {
              title: plan.title,
              patientContext: plan.patientContext,
              plainSummary: plan.plainSummary,
              medicines: plan.medicines,
              conflicts: plan.conflicts,
              dietPlan: plan.dietPlan,
              activityRules: plan.activityRules,
              redFlags: plan.redFlags,
              followUpAppointments: plan.followUpAppointments,
            },
          }),
        );
      };

      ws.onmessage = (event) => {
        let msg: {
          type?: string;
          data?: string;
          text?: string;
          summary?: string;
          message?: string;
          result?: {
            severity: 'stable' | 'caution' | 'red_flag';
            matchedTriggers?: string[];
          };
        };
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === 'ready') {
          setCallState('active');
          callStateRef.current = 'active';
          setUsedVoiceInput(true);
          usedVoiceInputRef.current = true;

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
          return;
        }

        if (msg.type === 'audio' && msg.data) {
          playPcmChunk(msg.data);
          return;
        }
        if (msg.type === 'inputTranscript' && msg.text) {
          appendLiveVoiceTranscript('user', msg.text);
          return;
        }
        if (msg.type === 'outputTranscript' && msg.text) {
          appendLiveVoiceTranscript('assistant', msg.text);
          return;
        }
        if (msg.type === 'turnComplete') {
          voiceTurnClosedRef.current = true;
          return;
        }
        if (msg.type === 'interrupted') {
          stopAllOutputAudio();
          voiceTurnClosedRef.current = true;
          return;
        }
        if (msg.type === 'redFlagAlert' && msg.result) {
          setLiveSeverity(msg.result.severity);
          if (Array.isArray(msg.result.matchedTriggers)) {
            setLiveRedFlags(msg.result.matchedTriggers);
          }
          setReadyToFinalize(true);
          return;
        }
        if (msg.type === 'requestSaveCheckIn') {
          const toolSummary = typeof msg.summary === 'string' ? msg.summary.trim() : '';
          finalizeCheckInWithData(
            messagesRef.current,
            toolSummary || compiledSummaryRef.current,
            '',
            true,
          );
          return;
        }
        if (msg.type === 'error') {
          setChatError(msg.message || 'Live voice session error.');
          endLiveCall();
          return;
        }
        if (msg.type === 'closed') {
          endLiveCall();
        }
      };

      ws.onerror = () => {
        setChatError(copy.wsError);
        endLiveCall();
      };

      ws.onclose = () => {
        if (callStateRef.current !== 'idle') {
          endLiveCall();
        }
      };
    } catch {
      setMicError(copy.micRequiredError);
      endLiveCall();
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    mutedRef.current = next;
  };

  const sendChatMessage = async (rawText: string) => {
    const clean = rawText.trim();
    if (!clean || isChatThinking || isEvaluating) return;

    setChatError(null);
    setJustSaved(false);

    // If Live Voice call is active, send typed message straight into the live call
    if (callState === 'active' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      voiceTurnClosedRef.current = true;
      const userMsg: CheckInChatMessage = {
        id: `usr_${Date.now()}`,
        role: 'user',
        text: clean,
        source: 'chat',
      };
      const nextMsgs = [...messagesRef.current, userMsg];
      setMessages(nextMsgs);
      messagesRef.current = nextMsgs;
      setReadyToFinalize(true);
      wsRef.current.send(JSON.stringify({ type: 'text', text: clean }));
      return;
    }

    const userMsg: CheckInChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      text: clean,
      source: 'chat',
    };
    const nextMessages = [...messagesRef.current, userMsg];
    setMessages(nextMessages);
    messagesRef.current = nextMessages;
    setQuickReplies([]);
    setIsChatThinking(true);

    try {
      const res = await fetch('/api/checkin/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, text: m.text })),
          language,
          medicinesTaken,
          planContext: {
            title: plan.title,
            patientContext: plan.patientContext,
            medicines: plan.medicines,
            conflicts: plan.conflicts,
            dietPlan: plan.dietPlan,
            redFlags: plan.redFlags,
            followUpAppointments: plan.followUpAppointments,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not reach check-in assistant.');
      }

      let updatedMessages = nextMessages;
      if (typeof data.reply === 'string' && data.reply.trim()) {
        updatedMessages = [
          ...nextMessages,
          {
            id: `ast_${Date.now()}`,
            role: 'assistant',
            text: data.reply.trim(),
            source: 'chat',
          },
        ];
        setMessages(updatedMessages);
        messagesRef.current = updatedMessages;
      }

      setQuickReplies(Array.isArray(data.quickReplies) ? data.quickReplies : []);
      if (data.severity === 'red_flag' || data.severity === 'caution' || data.severity === 'stable') {
        setLiveSeverity(data.severity);
      }
      if (Array.isArray(data.matchedRedFlags)) {
        setLiveRedFlags(data.matchedRedFlags);
      }
      setReadyToFinalize(Boolean(data.readyToFinalize));

      const nextCompiled =
        typeof data.compiledCheckInSummary === 'string' && data.compiledCheckInSummary.trim()
          ? data.compiledCheckInSummary.trim()
          : compiledSummaryRef.current;
      if (nextCompiled) {
        setCompiledSummary(nextCompiled);
        compiledSummaryRef.current = nextCompiled;
      }

      // If the user explicitly confirmed saving inside chat, log it right away!
      if (data.userConfirmedSave) {
        await finalizeCheckInWithData(updatedMessages, nextCompiled, '', usedVoiceInputRef.current);
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Check-in chat error.');
    } finally {
      setIsChatThinking(false);
    }
  };

  const handleSendForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isChatThinking || isTranscribing || isEvaluating) return;
    const textToSend = inputText;
    setInputText('');
    await sendChatMessage(textToSend);
  };

  const startRecording = async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);
      const baseMime = (recorder.mimeType || preferredMime || 'audio/webm').split(';')[0];

      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: baseMime });
        if (blob.size === 0) return;

        setIsTranscribing(true);
        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = typeof reader.result === 'string' ? reader.result : '';
          const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
          if (!base64) {
            setIsTranscribing(false);
            return;
          }

          try {
            const res = await fetch('/api/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audioBase64: base64,
                audioMimeType: baseMime,
                language,
              }),
            });
            const data = await res.json();
            if (res.ok && typeof data.transcript === 'string' && data.transcript.trim()) {
              const transcript = data.transcript.trim();
              setInputText((prev) =>
                prev.trim() ? `${prev.trim()} ${transcript}` : transcript,
              );
              setUsedVoiceInput(true);
              usedVoiceInputRef.current = true;
              window.setTimeout(() => inputRef.current?.focus(), 50);
            } else {
              setMicError(data.error || 'Could not transcribe voice note. Please try again.');
            }
          } catch {
            setMicError('Could not transcribe voice note. Please try again.');
          } finally {
            setIsTranscribing(false);
          }
        };
        reader.onerror = () => {
          setIsTranscribing(false);
          setMicError('Could not read the recorded voice note.');
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setMicError(copy.micDeniedMsg);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleSpeakGuidance = async (text: string) => {
    setIsSpeaking(true);
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }),
      });
      const data = await res.json();
      if (res.ok && data.audioBase64) {
        const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
        audio.onended = () => setIsSpeaking(false);
        await audio.play();
        return;
      }
    } catch {
      // ignore
    }
    setIsSpeaking(false);
  };

  const hasUserMessages = messages.some((m) => m.role === 'user');
  const canFinalize = Boolean(hasUserMessages || inputText.trim());
  const waveActive = callState === 'active' && (isAssistantSpeaking || !isMuted);
  const activeBanner = latestResult ?? checkIns[0] ?? null;
  const combinedError = errorMessage || chatError;

  return (
    <section className="space-y-8">
      {/* Interactive Daily Check-In Chat + Live Voice Card */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-200/80 shadow-[0_12px_36px_-18px_rgba(15,23,42,0.08)]">
        {/* Header */}
        <div className="px-5 sm:px-7 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 bg-white">
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
              {copy.checkInHeading}
            </h1>
            <p className="mt-0.5 text-sm text-slate-600">{copy.checkInSub}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <span className="text-xs font-mono text-slate-500 tabular-nums mr-1">
              {copy.dosesLoggedToday} {medicinesTaken.length}/{plan.medicines.length}
            </span>

            {callState === 'idle' && (
              <button
                type="button"
                onClick={startLiveCall}
                disabled={isEvaluating || isTranscribing}
                className="min-h-[40px] sm:min-h-[38px] px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-xl sm:rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5 shrink-0" />
                <span>{chatCopy.liveVoiceBtn}</span>
              </button>
            )}

            {callState === 'connecting' && (
              <button
                type="button"
                onClick={endLiveCall}
                className="min-h-[40px] sm:min-h-[38px] px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl sm:rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700 shrink-0" />
                <span>{copy.liveCallConnecting}</span>
              </button>
            )}

            {callState === 'active' && (
              <>
                <button
                  type="button"
                  onClick={toggleMute}
                  className={`min-h-[40px] sm:min-h-[38px] px-3 py-2 text-xs font-medium rounded-xl sm:rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
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
                  <span>{isMuted ? copy.unmuteMic : copy.muteMic}</span>
                </button>
                <button
                  type="button"
                  onClick={endLiveCall}
                  className="min-h-[40px] sm:min-h-[38px] px-3 py-2 text-xs font-medium text-white bg-red-700 hover:bg-red-800 rounded-xl sm:rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <PhoneOff className="w-3.5 h-3.5 shrink-0" />
                  <span>{copy.endLiveCall}</span>
                </button>
              </>
            )}

            {messages.length > 0 && callState === 'idle' && (
              <button
                type="button"
                onClick={resetChat}
                className="min-h-[40px] sm:min-h-[38px] px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl sm:rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{chatCopy.resetChatBtn}</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Live Voice Status Strip */}
        {callState === 'active' && (
          <div className="px-5 sm:px-7 py-3 bg-teal-950 text-white flex items-center justify-between gap-4">
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

        {/* Live Mid-Chat Clinical Warning Strip */}
        {(liveSeverity === 'red_flag' || liveSeverity === 'caution') && (
          <div
            className={`px-5 sm:px-7 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
              liveSeverity === 'red_flag' ? 'bg-red-50' : 'bg-amber-50'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              {liveSeverity === 'red_flag' ? (
                <AlertOctagon className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              )}
              <div className="text-xs leading-relaxed">
                <p
                  className={`font-semibold ${
                    liveSeverity === 'red_flag' ? 'text-red-900' : 'text-amber-900'
                  }`}
                >
                  {liveSeverity === 'red_flag'
                    ? copy.redFlagBannerTitle
                    : copy.cautionBannerTitle}
                </p>
                {liveRedFlags.length > 0 && (
                  <p
                    className={
                      liveSeverity === 'red_flag' ? 'text-red-800' : 'text-amber-800'
                    }
                  >
                    {liveRedFlags.join(' · ')}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onViewClinicianBrief}
              className="min-h-[36px] px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copy.openClinicianBriefBtn}
            </button>
          </div>
        )}

        {/* Unified Conversation Feed (Text + Live Voice) */}
        <div
          ref={scrollRef}
          className="px-5 sm:px-7 py-5 min-h-[260px] max-h-[420px] overflow-y-auto space-y-4 bg-white"
        >
          {/* Opening Greeting */}
          <div className="space-y-3">
            <div className="space-y-1 max-w-[92%] sm:max-w-[85%]">
              <p className="text-[11px] font-medium text-slate-400">DischargeDost</p>
              <div className="rounded-2xl rounded-tl-sm bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-800">
                {chatCopy.greeting}
              </div>
            </div>

            {justSaved && messages.length === 0 && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-medium text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{chatCopy.savedNotice}</span>
              </div>
            )}

            {/* Starter Quick Presets (when chat hasn't begun yet and live call is idle) */}
            {messages.length === 0 && callState === 'idle' && !isChatThinking && (
              <div className="space-y-2 pt-1">
                <p className="text-xs text-slate-500">{copy.quickSampleLabel}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {presets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => sendChatMessage(preset.text)}
                      className="min-h-[44px] rounded-xl border border-slate-200 bg-white hover:bg-teal-50/50 hover:border-teal-300 px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 hover:text-teal-950 transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Chat & Live Voice Bubbles */}
          {messages.map((entry) => {
            const isUser = entry.role === 'user';
            return (
              <div
                key={entry.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
              >
                <span className="text-[11px] font-medium text-slate-400">
                  {isUser ? copy.homeSpeakerYou : 'DischargeDost'}
                </span>
                <div
                  className={`max-w-[90%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isUser
                      ? 'bg-teal-700 text-white rounded-br-sm'
                      : 'bg-slate-100/85 text-slate-800 rounded-tl-sm'
                  }`}
                >
                  {entry.text}
                </div>
              </div>
            );
          })}

          {isChatThinking && (
            <div className="flex flex-col items-start space-y-1">
              <span className="text-[11px] font-medium text-slate-400">DischargeDost</span>
              <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-xs font-medium text-slate-600 bg-slate-100/85 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700 shrink-0" />
                <span>{chatCopy.thinkingMsg}</span>
              </div>
            </div>
          )}

          {/* Contextual Follow-Up Quick Replies (only for follow-up questions, never duplicate save chips) */}
          {quickReplies.length > 0 && callState === 'idle' && !isChatThinking && !readyToFinalize && (
            <div className="flex flex-wrap gap-2 pt-1">
              {quickReplies.map((reply) => (
                <button
                  key={reply}
                  type="button"
                  onClick={() => sendChatMessage(reply)}
                  className="min-h-[40px] px-3.5 py-2 text-xs font-medium text-teal-900 bg-teal-50/70 hover:bg-teal-100/80 border border-teal-200 rounded-xl sm:rounded-lg transition-colors text-left cursor-pointer"
                >
                  {reply}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Composer + Single Save Check-In Footer */}
        <div className="px-5 sm:px-7 py-4 bg-slate-50/60 space-y-3">
          {isTranscribing && (
            <div className="rounded-xl bg-white border border-teal-200 px-3.5 py-2 text-xs font-medium text-teal-900 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700 shrink-0" />
              <span>{chatCopy.transcribingMsg}</span>
            </div>
          )}

          <form
            onSubmit={handleSendForm}
            className="bg-white border border-slate-300/90 focus-within:border-teal-700 focus-within:ring-2 focus-within:ring-teal-700/15 rounded-xl p-1.5 flex items-center gap-1.5 sm:gap-2 transition-shadow"
          >
            {callState === 'idle' &&
              (!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isTranscribing || isChatThinking || isEvaluating}
                  title={copy.recordVoice}
                  aria-label={copy.recordVoice}
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center text-teal-700 hover:text-teal-900 hover:bg-teal-50 disabled:opacity-50 rounded-lg transition-colors shrink-0 cursor-pointer"
                >
                  <Mic className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  title={copy.stopRecording}
                  aria-label={copy.stopRecording}
                  className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>{copy.stopRecording}</span>
                </button>
              ))}

            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                callState === 'active' ? chatCopy.liveInputPlaceholder : chatCopy.inputPlaceholder
              }
              className="flex-1 min-w-0 bg-transparent px-2 py-2 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isChatThinking || isTranscribing || isEvaluating}
              className="min-h-[40px] px-3.5 sm:px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5 shrink-0" />
              <span>{copy.sendBtn}</span>
            </button>
          </form>

          {micError && <p className="text-xs text-red-700">{micError}</p>}

          {combinedError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
              {combinedError}
            </div>
          )}

          {/* Single Save Check-In Footer Row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
            <div
              className={`flex items-start sm:items-center gap-2 text-xs leading-relaxed ${
                readyToFinalize && canFinalize
                  ? 'text-emerald-800 font-medium'
                  : 'text-slate-500'
              }`}
            >
              {readyToFinalize && canFinalize && (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5 sm:mt-0" />
              )}
              <span>
                {readyToFinalize && canFinalize ? chatCopy.readyHint : chatCopy.chatFirstHint}
              </span>
            </div>

            <button
              type="button"
              onClick={() => finalizeCheckInWithData()}
              disabled={isEvaluating || isChatThinking || isTranscribing || !canFinalize}
              className={`min-h-[44px] sm:min-h-[40px] w-full sm:w-auto px-5 py-2.5 text-xs font-semibold rounded-xl sm:rounded-lg transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center justify-center gap-2 disabled:cursor-not-allowed ${
                readyToFinalize && canFinalize
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm'
                  : 'bg-slate-900 hover:bg-slate-800 text-white disabled:bg-slate-200 disabled:text-slate-400'
              }`}
            >
              {isEvaluating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{chatCopy.savingBtn}</span>
                </>
              ) : (
                <>
                  <ClipboardCheck className="w-4 h-4" />
                  <span>{chatCopy.finalizeBtn}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Latest Saved Evaluation Result */}
      {activeBanner && (
        <div
          className={`rounded-xl border p-6 sm:p-8 space-y-4 ${
            activeBanner.severity === 'red_flag'
              ? 'bg-red-50 border-red-300'
              : activeBanner.severity === 'caution'
              ? 'bg-amber-50 border-amber-300'
              : 'bg-emerald-50/70 border-emerald-300'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              {activeBanner.severity === 'red_flag' ? (
                <AlertOctagon className="w-6 h-6 text-red-700 shrink-0" />
              ) : activeBanner.severity === 'caution' ? (
                <AlertTriangle className="w-6 h-6 text-amber-700 shrink-0" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0" />
              )}
              <h2 className="font-display text-lg font-bold text-slate-900">
                {activeBanner.severity === 'red_flag'
                  ? copy.redFlagBannerTitle
                  : activeBanner.severity === 'caution'
                  ? copy.cautionBannerTitle
                  : copy.stableBannerTitle}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSpeakGuidance(activeBanner.guidance)}
                disabled={isSpeaking}
                className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer flex items-center gap-1.5"
              >
                <Volume2 className="w-3.5 h-3.5" />
                {isSpeaking ? copy.playingBtn : copy.listenBtn}
              </button>
              <button
                type="button"
                onClick={onViewClinicianBrief}
                className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                {copy.openClinicianBriefBtn}
              </button>
            </div>
          </div>

          <p className="text-sm text-slate-700">
            <span className="font-semibold">{copy.patientReportLabel}</span>{' '}
            {activeBanner.symptomNote}
          </p>

          <p className="text-base text-slate-900 leading-relaxed">{activeBanner.guidance}</p>

          {activeBanner.matchedRedFlags.length > 0 && (
            <div className="pt-2">
              <p className="text-xs font-semibold text-red-900">{copy.triggeredFlagsLabel}</p>
              <ul className="mt-1 space-y-1 text-sm text-red-800">
                {activeBanner.matchedRedFlags.map((flag, i) => (
                  <li key={i}>• {flag}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-3 border-t border-slate-300/60">
            <p className="text-xs font-semibold text-slate-700">{copy.clinicianSbarLabel}</p>
            <p className="mt-1 text-sm font-mono text-slate-800">
              {activeBanner.clinicianAlertSummary}
            </p>
          </div>
        </div>
      )}

      {/* Check-In History */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            {copy.checkInHistoryTitle}
          </h2>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {checkIns.length} {copy.entriesCountLabel}
          </span>
        </div>

        {checkIns.length === 0 ? (
          <p className="text-sm text-slate-500">{copy.noCheckInsYet}</p>
        ) : (
          <div className="divide-y divide-slate-200">
            {checkIns.map((item) => (
              <div key={item.id} className="py-4 first:pt-2 last:pb-0 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono">{item.checkInDate}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {item.inputMode === 'voice' ? copy.voiceCheckInTag : copy.textCheckInTag}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      item.severity === 'red_flag'
                        ? 'text-red-700'
                        : item.severity === 'caution'
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {item.severity === 'red_flag'
                      ? copy.statusRedFlag
                      : item.severity === 'caution'
                      ? copy.statusCaution
                      : copy.statusStable}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-900">{item.symptomNote}</p>
                <p className="text-sm text-slate-600">{item.guidance}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
