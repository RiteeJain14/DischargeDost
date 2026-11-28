import { useState } from 'react';
import { Check, Copy, Printer } from 'lucide-react';
import { UI_COPY, type DailyCheckIn, type LanguageCode, type RecoveryPlan } from '../types';

interface ClinicianBriefViewProps {
  plan: RecoveryPlan;
  language: LanguageCode;
  takenSlots: Record<string, boolean>;
  checkIns: DailyCheckIn[];
}

export function ClinicianBriefView({
  plan,
  language,
  takenSlots,
  checkIns,
}: ClinicianBriefViewProps) {
  const copy = UI_COPY[language];
  const [copied, setCopied] = useState(false);

  const takenCount = plan.medicines.filter((m, idx) => {
    const key = `${m.slot}_${m.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${idx}`.slice(
      0,
      120,
    );
    return Boolean(takenSlots[key]);
  }).length;

  const latestCheckIn = checkIns[0] ?? null;

  const plainTextSummary = [
    `DISCHARGEDOST CLINICIAN HANDOVER BRIEF`,
    `Hospital: ${plan.hospitalName} | Discharge Date: ${plan.dischargeDate}`,
    `Diagnosis / Context: ${plan.patientContext}`,
    ``,
    `SBAR SUMMARY:`,
    plan.clinicianNote,
    ``,
    `PRESCRIBED REGIMEN (${takenCount}/${plan.medicines.length} doses logged today):`,
    ...plan.medicines.map((m) => `- ${m.name} (${m.dose}) | ${m.slot} | ${m.foodRule}`),
    ``,
    `FLAGGED INTERACTIONS / TIMING CHECKS (${plan.conflicts.length}):`,
    ...(plan.conflicts.length > 0
      ? plan.conflicts.map((c) => `- [${c.severity.toUpperCase()}] ${c.pair}: ${c.explanation}`)
      : ['- None flagged']),
    ``,
    `LATEST PATIENT CHECK-IN:`,
    latestCheckIn
      ? `[${latestCheckIn.severity.toUpperCase()} · ${latestCheckIn.checkInDate}] ${latestCheckIn.clinicianAlertSummary}`
      : 'No check-ins submitted yet.',
  ].join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plainTextSummary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked in some iframe contexts
    }
  };

  return (
    <section className="space-y-6">
      <div className="print-only-card bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <p className="text-xs font-mono text-slate-500">
              {copy.briefEyebrow} · {plan.hospitalName}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold text-slate-900">
              {copy.briefTitle}
            </h1>
          </div>

          <div className="no-print flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
              {copied ? copy.copiedBrief : copy.copyBrief}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              {copy.printBrief}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pb-6 border-b border-slate-200">
          <div>
            <p className="text-xs text-slate-500">{copy.dischargeDateLabel}</p>
            <p className="mt-1 font-mono text-sm font-semibold text-slate-900">
              {plan.dischargeDate}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{copy.todaysAdherenceLabel}</p>
            <p className="mt-1 font-mono text-sm font-semibold text-slate-900 tabular-nums">
              {takenCount} / {plan.medicines.length} {copy.dosesTakenSuffix}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">{copy.latestTriageLabel}</p>
            <p
              className={`mt-1 text-sm font-semibold ${
                latestCheckIn?.severity === 'red_flag'
                  ? 'text-red-700'
                  : latestCheckIn?.severity === 'caution'
                  ? 'text-amber-700'
                  : 'text-emerald-700'
              }`}
            >
              {latestCheckIn
                ? latestCheckIn.severity === 'red_flag'
                  ? copy.statusRedFlag
                  : latestCheckIn.severity === 'caution'
                  ? copy.statusCaution
                  : copy.statusStable
                : copy.noCheckInYetLabel}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">{copy.clinicalSbarTitle}</h2>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {plan.clinicianNote}
          </p>
        </div>

        {latestCheckIn && (
          <div className="pt-4 border-t border-slate-200 space-y-2">
            <h2 className="text-sm font-semibold text-slate-900">
              {copy.latestAlertTitle} ({latestCheckIn.checkInDate})
            </h2>
            <p className="text-sm font-mono text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-4">
              {latestCheckIn.clinicianAlertSummary}
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-slate-200 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">{copy.medAuditTitle}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2 pr-4 font-medium">{copy.colMedicine}</th>
                  <th className="py-2 pr-4 font-medium">{copy.colDose}</th>
                  <th className="py-2 pr-4 font-medium">{copy.colSlot}</th>
                  <th className="py-2 font-medium">{copy.colInstruction}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plan.medicines.map((m, i) => (
                  <tr key={i}>
                    <td className="py-2.5 pr-4 font-medium text-slate-900">{m.name}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-slate-600">{m.dose}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs text-slate-600">{m.slot}</td>
                    <td className="py-2.5 text-slate-600">{m.foodRule}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
