import React, { useEffect, useRef, useState } from 'react';
import {
  AlertOctagon,
  Loader2,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Send,
} from 'lucide-react';
import { UI_COPY, type LanguageCode, type RecoveryPlan } from '../types';

interface LiveCallPanelProps {
  plan: RecoveryPlan;
  language: LanguageCode;
  medicinesTaken: string[];
  onSaveCallSummary: (transcriptSummary: string) => Promise<void>;
  onViewClinicianBrief: () => void;
}

interface TranscriptEntry {
  id: string;
  speaker: 'patient' | 'assistant';
  text: string;
}

interface RedFlagAlertPayload {
  severity: 'stable' | 'caution' | 'red_flag';
  matchedTriggers: string[];
  escalationProtocol: string;
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

export function LiveCallPanel({
  plan,
  language,
  medicinesTaken,
  onSaveCallSummary,
  onViewClinicianBrief,
}: LiveCallPanelProps) {
  const copy = UI_COPY[language];

  const [callState, setCallState] = useState<CallState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [typedQuery, setTypedQuery] = useState('');
  const [callError, setCallError] = useState<string | null>(null);
  const [redFlagAlert, setRedFlagAlert] = useState<RedFlagAlertPayload | null>(null);
  const [isSavingSummary, setIsSavingSummary] = useState(false);

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
  const transcriptScrollRef = useRef<HTMLDivElement | null>(null);

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
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [transcript]);

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

  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, []);

  const appendTranscript = (speaker: 'patient' | 'assistant', chunk: string) => {
    const clean = chunk.trim();
    if (!clean) return;
    setTranscript((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.speaker === speaker) {
        const needsSpace = !last.text.endsWith(' ') && !clean.startsWith(' ');
        const updated = {
          ...last,
          text: `${last.text}${needsSpace ? ' ' : ''}${clean}`,
        };
        return [...prev.slice(0, -1), updated];
      }
      return [...prev, { id: `${Date.now()}_${Math.random()}`, speaker, text: clean }];
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

  const startCall = async () => {
    if (callState !== 'idle') return;
    setCallError(null);
    setRedFlagAlert(null);
    setTranscript([]);
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
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/live-checkin`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'start',
            language,
            medicinesTaken,
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

          // Mute feedback loop through zero-gain node
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
          appendTranscript('patient', msg.text);
          return;
        }
        if (msg.type === 'outputTranscript' && msg.text) {
          appendTranscript('assistant', msg.text);
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
          setCallError(msg.message || 'Live voice session error.');
          cleanupResources();
          setCallState('idle');
          callStateRef.current = 'idle';
          return;
        }
        if (msg.type === 'closed') {
          cleanupResources();
          setCallState('idle');
          callStateRef.current = 'idle';
        }
      };

      ws.onerror = () => {
        setCallError(copy.wsError);
        cleanupResources();
        setCallState('idle');
        callStateRef.current = 'idle';
      };

      ws.onclose = () => {
        if (callStateRef.current !== 'idle') {
          cleanupResources();
          setCallState('idle');
          callStateRef.current = 'idle';
        }
      };
    } catch {
      setCallError(copy.micRequiredError);
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

  const handleEndAndSave = async () => {
    const patientLines = transcript
      .filter((entry) => entry.speaker === 'patient')
      .map((entry) => entry.text)
      .join(' ');
    endCall();
    if (!patientLines.trim()) return;
    setIsSavingSummary(true);
    try {
      await onSaveCallSummary(patientLines.trim());
    } finally {
      setIsSavingSummary(false);
    }
  };

  const handleSendTypedQuery = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = typedQuery.trim();
    if (!clean || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    appendTranscript('patient', clean);
    wsRef.current.send(JSON.stringify({ type: 'text', text: clean }));
    setTypedQuery('');
  };

  const hasPatientSpeech = transcript.some((t) => t.speaker === 'patient');

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2 className="font-display text-lg font-semibold text-slate-900">
              {copy.liveCallTitle}
            </h2>
            {callState === 'active' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 tabular-nums">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                {formatDuration(elapsedSeconds)}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600">{copy.liveCallSub}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {callState === 'idle' && (
            <button
              type="button"
              onClick={startCall}
              disabled={isSavingSummary}
              className="px-4 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
            >
              {isSavingSummary ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Phone className="w-4 h-4" />
              )}
              {copy.startLiveCall}
            </button>
          )}

          {callState === 'connecting' && (
            <button
              type="button"
              onClick={endCall}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
            >
              <Loader2 className="w-4 h-4 animate-spin text-teal-700" />
              {copy.liveCallConnecting}
            </button>
          )}

          {callState === 'active' && (
            <>
              <button
                type="button"
                onClick={toggleMute}
                className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  isMuted
                    ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-teal-700" />}
                {isMuted ? copy.unmuteMic : copy.muteMic}
              </button>

              {hasPatientSpeech && (
                <button
                  type="button"
                  onClick={handleEndAndSave}
                  className="px-3.5 py-2 text-xs font-medium text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copy.saveCallCheckIn}
                </button>
              )}

              <button
                type="button"
                onClick={endCall}
                className="px-3.5 py-2 text-xs font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <PhoneOff className="w-4 h-4" />
                {copy.endLiveCall}
              </button>
            </>
          )}
        </div>
      </div>

      {callError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {callError}
        </div>
      )}

      {redFlagAlert && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-red-900 font-semibold text-sm">
              <AlertOctagon className="w-5 h-5 text-red-700 shrink-0" />
              <span>
                {redFlagAlert.severity === 'red_flag'
                  ? copy.urgentCallFlag
                  : copy.cautionCallFlag}
              </span>
            </div>
            <button
              type="button"
              onClick={onViewClinicianBrief}
              className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md cursor-pointer"
            >
              {copy.openClinicianBriefBtn}
            </button>
          </div>
          <p className="text-xs text-red-800">{redFlagAlert.escalationProtocol}</p>
        </div>
      )}

      {(callState === 'active' || transcript.length > 0) && (
        <div className="border border-slate-200 rounded-lg bg-slate-50/70 p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {callState === 'active'
                ? isAssistantSpeaking
                  ? copy.assistantSpeaking
                  : isMuted
                  ? copy.micMutedStatus
                  : copy.liveCallReady
                : copy.lastCallTranscript}
            </span>
            {callState === 'idle' && hasPatientSpeech && (
              <button
                type="button"
                onClick={handleEndAndSave}
                disabled={isSavingSummary}
                className="text-teal-800 font-medium hover:underline cursor-pointer"
              >
                {copy.saveCallCheckIn}
              </button>
            )}
          </div>

          <div
            ref={transcriptScrollRef}
            className="max-h-60 overflow-y-auto space-y-2.5 pr-1"
          >
            {transcript.length === 0 ? (
              <p className="text-xs text-slate-500 italic">{copy.liveCallHint}</p>
            ) : (
              transcript.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex ${entry.speaker === 'patient' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3.5 py-2 text-sm leading-relaxed ${
                      entry.speaker === 'patient'
                        ? 'bg-teal-700 text-white'
                        : 'bg-white border border-slate-200 text-slate-800'
                    }`}
                  >
                    {entry.text}
                  </div>
                </div>
              ))
            )}
          </div>

          {callState === 'active' && (
            <form onSubmit={handleSendTypedQuery} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={typedQuery}
                onChange={(e) => setTypedQuery(e.target.value)}
                placeholder={copy.typedQueryPlaceholder}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!typedQuery.trim()}
                className="px-3 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 rounded-lg cursor-pointer flex items-center gap-1"
              >
                <Send className="w-3.5 h-3.5" />
                {copy.sendBtn}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
