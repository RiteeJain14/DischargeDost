import React, { useRef, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mic,
  Send,
  Square,
  Volume2,
} from 'lucide-react';
import { SAMPLE_CHECKIN_PRESETS_BY_LANG } from '../lib/sampleDischarge';
import { UI_COPY, type DailyCheckIn, type LanguageCode, type RecoveryPlan } from '../types';
import { LiveCallPanel } from './LiveCallPanel';

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
  const presets = SAMPLE_CHECKIN_PRESETS_BY_LANG[language];
  const [symptomsText, setSymptomsText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<{ base64: string; mimeType: string } | null>(
    null,
  );
  const [micError, setMicError] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<DailyCheckIn | null>(checkIns[0] ?? null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const medicinesTaken = plan.medicines
    .filter((m, idx) => {
      const key = `${m.slot}_${m.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${idx}`.slice(
        0,
        120,
      );
      return Boolean(takenSlots[key]);
    })
    .map((m) => m.name);

  const startRecording = async () => {
    setMicError(null);
    setRecordedAudio(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = typeof reader.result === 'string' ? reader.result : '';
          const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
          setRecordedAudio({ base64, mimeType });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptomsText.trim() && !recordedAudio) return;

    const result = await onSubmitCheckIn({
      symptomsText: symptomsText.trim(),
      audioBase64: recordedAudio?.base64,
      audioMimeType: recordedAudio?.mimeType,
      inputMode: recordedAudio ? 'voice' : 'text',
      medicinesTaken,
    });
    if (result) {
      setLatestResult(result);
      setSymptomsText('');
      setRecordedAudio(null);
    }
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

  const handleSaveLiveCallSummary = async (transcriptSummary: string) => {
    const result = await onSubmitCheckIn({
      symptomsText: transcriptSummary,
      inputMode: 'voice',
      medicinesTaken,
    });
    if (result) {
      setLatestResult(result);
    }
  };

  const activeBanner = latestResult ?? checkIns[0] ?? null;

  return (
    <section className="space-y-8">
      <LiveCallPanel
        plan={plan}
        language={language}
        medicinesTaken={medicinesTaken}
        onSaveCallSummary={handleSaveLiveCallSummary}
        onViewClinicianBrief={onViewClinicianBrief}
      />

      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              {copy.checkInHeading}
            </h1>
            <p className="mt-1 text-sm text-slate-600">{copy.checkInSub}</p>
          </div>
          <span className="text-xs font-mono text-slate-600 tabular-nums shrink-0">
            {copy.dosesLoggedToday} {medicinesTaken.length} / {plan.medicines.length}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">{copy.quickSampleLabel}</span>
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setSymptomsText(preset.text)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <textarea
            rows={4}
            value={symptomsText}
            onChange={(e) => setSymptomsText(e.target.value)}
            placeholder={copy.symptomPlaceholder}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
          />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  className="px-4 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
                >
                  <Mic className="w-4 h-4 text-teal-700" />
                  {copy.recordVoice}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="px-4 py-2 text-xs font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  {copy.stopRecording}
                </button>
              )}

              {recordedAudio && (
                <span className="text-xs font-medium text-teal-800">
                  {copy.voiceRecordedReady}
                </span>
              )}
              {micError && <span className="text-xs text-red-700">{micError}</span>}
            </div>

            <button
              type="submit"
              disabled={isEvaluating || (!symptomsText.trim() && !recordedAudio)}
              className="px-5 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
            >
              {isEvaluating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {copy.checkingSymptomsBtn}
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  {copy.submitCheckIn}
                </>
              )}
            </button>
          </div>

          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {errorMessage}
            </div>
          )}
        </form>
      </div>

      {/* Latest Evaluation Result */}
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
