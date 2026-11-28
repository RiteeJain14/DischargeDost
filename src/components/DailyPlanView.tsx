import { useRef, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldAlert,
  Utensils,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  SLOT_LABELS,
  UI_COPY,
  type LanguageCode,
  type MedicineItem,
  type MedicineSlot,
  type RecoveryPlan,
  type ToolCallRecord,
} from '../types';

interface DailyPlanViewProps {
  plan: RecoveryPlan;
  language: LanguageCode;
  takenSlots: Record<string, boolean>;
  onToggleDose: (slotKey: string, nextTaken: boolean) => void;
  isTranslating: boolean;
  toolCalls: ToolCallRecord[];
  onGoToCheckIn: () => void;
}

const SLOT_ORDER: MedicineSlot[] = [
  'morning_before',
  'morning_after',
  'afternoon',
  'evening',
  'bedtime',
  'as_needed',
];

export function DailyPlanView({
  plan,
  language,
  takenSlots,
  onToggleDose,
  isTranslating,
  toolCalls,
  onGoToCheckIn,
}: DailyPlanViewProps) {
  const copy = UI_COPY[language];
  const slotNames = SLOT_LABELS[language];

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleListenAloud = async () => {
    if (isSpeaking && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsSpeaking(false);
      return;
    }

    setIsLoadingAudio(true);
    setAudioError(null);
    try {
      const spokenScript = [
        plan.plainSummary,
        `${copy.scheduleTitle}: ${plan.medicines
          .slice(0, 6)
          .map((m) => `${m.name} ${m.dose}, ${m.timeLabel}, ${m.foodRule}`)
          .join('. ')}`,
      ].join('. ');

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: spokenScript, language }),
      });
      const data = await res.json();
      if (!res.ok || !data.audioBase64) {
        throw new Error(data.error || 'Unable to generate speech.');
      }
      const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
      audioRef.current = audio;
      audio.onended = () => setIsSpeaking(false);
      await audio.play();
      setIsSpeaking(true);
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : 'Audio playback failed.');
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const makeSlotKey = (med: MedicineItem, idx: number) =>
    `${med.slot}_${med.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${idx}`.slice(0, 120);

  const totalMeds = plan.medicines.length;
  const takenCount = plan.medicines.filter((m, idx) => Boolean(takenSlots[makeSlotKey(m, idx)])).length;

  const groupedSlots = SLOT_ORDER.map((slot) => ({
    slot,
    label: slotNames[slot],
    items: plan.medicines
      .map((med, idx) => ({ med, idx, slotKey: makeSlotKey(med, idx) }))
      .filter(({ med }) => med.slot === slot),
  })).filter((g) => g.items.length > 0);

  return (
    <section className="space-y-8">
      {/* Plan Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{plan.hospitalName}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{plan.dischargeDate}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">
                {totalMeds} {copy.medicinesCountLabel}
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 text-balance">
              {plan.title}
            </h1>
            <p className="text-sm text-slate-600">{plan.patientContext}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleListenAloud}
              disabled={isLoadingAudio}
              className="px-4 py-2 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
            >
              {isLoadingAudio ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isSpeaking ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
              {isSpeaking ? copy.stopAudio : copy.listenPlan}
            </button>
          </div>
        </div>

        {isTranslating && (
          <p className="mt-4 text-xs text-teal-700 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {copy.translatingPlan}
          </p>
        )}
        {audioError && <p className="mt-3 text-xs text-red-700">{audioError}</p>}

        <div className="mt-6 pt-6 border-t border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">{copy.plainSummaryTitle}</h2>
          <p className="mt-2 text-base text-slate-700 leading-relaxed">{plan.plainSummary}</p>
        </div>
      </div>

      {/* Drug Interaction & Timing Conflict Alerts */}
      {plan.conflicts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-lg font-semibold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0" />
              {copy.conflictsTitle}
            </h2>
            <span className="text-xs font-mono text-slate-500">
              {plan.conflicts.length} {copy.flaggedCountLabel}
            </span>
          </div>

          <div className="divide-y divide-slate-200">
            {plan.conflicts.map((conflict, idx) => {
              const isHigh = conflict.severity === 'high';
              const isTiming = conflict.severity === 'timing';
              const severityText = isHigh
                ? copy.severityHigh
                : isTiming
                ? copy.severityTiming
                : copy.severityModerate;
              const toneClass = isHigh
                ? 'text-red-700 bg-red-50 border-red-200'
                : isTiming
                ? 'text-slate-700 bg-slate-100 border-slate-200'
                : 'text-amber-800 bg-amber-50 border-amber-200';

              return (
                <div key={`${conflict.pair}-${idx}`} className="py-4 first:pt-2 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{conflict.pair}</p>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded border ${toneClass}`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {severityText}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{conflict.explanation}</p>
                  <p className="mt-1.5 text-xs font-medium text-teal-800">
                    {copy.nextStepLabel} {conflict.recommendation}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Daily Medicine Schedule */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-900">
              {copy.scheduleTitle}
            </h2>
            <p className="mt-1 text-xs text-slate-500">{copy.disclaimer}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
              {takenCount} / {totalMeds} {copy.takenLabel}
            </span>
            <button
              type="button"
              onClick={onGoToCheckIn}
              className="px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copy.navCheckIn}
            </button>
          </div>
        </div>

        <div className="space-y-8">
          {groupedSlots.map((group) => (
            <div key={group.slot} className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-teal-700" />
                <span>{group.label}</span>
              </div>

              <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                {group.items.map(({ med, idx, slotKey }) => {
                  const isTaken = Boolean(takenSlots[slotKey]);
                  return (
                    <div
                      key={slotKey}
                      className={`p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-colors ${
                        isTaken ? 'bg-emerald-50/40' : 'bg-white'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-base font-semibold text-slate-900">
                            {med.name}
                          </span>
                          <span className="font-mono text-xs text-slate-600">{med.dose}</span>
                          <span aria-hidden="true" className="text-slate-300">
                            ·
                          </span>
                          <span className="text-xs font-medium text-teal-800">{med.timeLabel}</span>
                        </div>
                        <p className="text-sm text-slate-600">{med.purpose}</p>
                        <p className="text-xs text-slate-500">
                          {med.foodRule} <span aria-hidden="true">·</span> {med.duration}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => onToggleDose(slotKey, !isTaken)}
                        className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 ${
                          isTaken
                            ? 'bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-800'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-teal-700 hover:text-teal-800'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {isTaken ? copy.takenLabel : copy.markTaken}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Diet, Activity & Red Flags Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <h2 className="font-display text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Utensils className="w-5 h-5 text-teal-700" />
            {copy.dietTitle}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-semibold text-emerald-800">{copy.eatFreely}</p>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                {plan.dietPlan.allowed.map((item, i) => (
                  <li key={i} className="leading-snug">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold text-red-800">{copy.avoidFoods}</p>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                {plan.dietPlan.avoid.map((item, i) => (
                  <li key={i} className="leading-snug">
                    • {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-700">{copy.hydrationLabel}</p>
            <p className="mt-1 text-sm text-slate-600">{plan.dietPlan.hydrationGoal}</p>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <h2 className="font-display text-lg font-semibold text-red-900">
              {copy.redFlagsTitle}
            </h2>
            <ul className="mt-2 space-y-1.5 text-sm text-red-800">
              {plan.redFlags.map((rf, i) => (
                <li key={i}>• {rf}</li>
              ))}
            </ul>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900">{copy.activityTitle}</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
              {plan.activityRules.map((rule, i) => (
                <li key={i}>• {rule}</li>
              ))}
            </ul>
          </div>

          {plan.followUpAppointments.length > 0 && (
            <div className="pt-4 border-t border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-700" />
                {copy.followUpsTitle}
              </h3>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                {plan.followUpAppointments.map((appt, i) => (
                  <li key={i}>• {appt}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Transparent Gemini Function Call Verification Summary (when invoked) */}
      {toolCalls.length > 0 && (
        <details className="bg-white border border-slate-200 rounded-xl p-5">
          <summary className="text-xs font-medium text-slate-600 cursor-pointer">
            {copy.toolChecksSummary} ({toolCalls.map((t) => t.name).join(', ')})
          </summary>
          <pre className="mt-3 text-xs font-mono text-slate-700 bg-slate-50 p-3 rounded-lg overflow-x-auto">
            {JSON.stringify(toolCalls, null, 2)}
          </pre>
        </details>
      )}
    </section>
  );
}
