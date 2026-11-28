import { useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Check, Copy, Download, Loader2 } from 'lucide-react';
import {
  UI_COPY,
  type DailyCheckIn,
  type FollowUpReport,
  type LanguageCode,
  type MedicineSlot,
  type RecoveryPlan,
} from '../types';

interface ClinicianBriefViewProps {
  plan: RecoveryPlan;
  language: LanguageCode;
  takenSlots: Record<string, boolean>;
  checkIns: DailyCheckIn[];
  followUps: FollowUpReport[];
}

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable?: { finalY: number };
};

const ENGLISH_SLOT_LABELS: Record<MedicineSlot, string> = {
  morning_before: 'Morning (Before Breakfast)',
  morning_after: 'Morning (After Breakfast)',
  afternoon: 'Afternoon (Lunch)',
  evening: 'Evening / Dinner',
  bedtime: 'Bedtime (Night)',
  as_needed: 'As Needed (SOS)',
};

function sanitizePdfText(raw: string | undefined | null): string {
  if (!raw) return '-';
  const cleaned = raw
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00B7/g, '|')
    .replace(/\u2022/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned || '-';
}

function parseSbarRows(note: string): Array<[string, string]> {
  const clean = sanitizePdfText(note);
  const pattern =
    /(?:^|\n|\s)(Situation|Background|Assessment|Recommendation|S|B|A|R)\s*:\s*/gi;
  const matches: Array<{ label: string; index: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(clean)) !== null) {
    const rawKey = m[1].toUpperCase();
    const labelMap: Record<string, string> = {
      S: 'SITUATION',
      SITUATION: 'SITUATION',
      B: 'BACKGROUND',
      BACKGROUND: 'BACKGROUND',
      A: 'ASSESSMENT',
      ASSESSMENT: 'ASSESSMENT',
      R: 'RECOMMENDATION',
      RECOMMENDATION: 'RECOMMENDATION',
    };
    const label = labelMap[rawKey];
    if (label) {
      matches.push({ label, index: m.index, end: m.index + m[0].length });
    }
  }

  if (matches.length >= 2) {
    const rows: Array<[string, string]> = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].end;
      const end = i + 1 < matches.length ? matches[i + 1].index : clean.length;
      const body = clean.slice(start, end).trim();
      if (body) {
        rows.push([matches[i].label, body]);
      }
    }
    if (rows.length > 0) return rows;
  }

  return [['SUMMARY', clean]];
}

export function ClinicianBriefView({
  plan,
  language,
  takenSlots,
  checkIns,
  followUps,
}: ClinicianBriefViewProps) {
  const copy = UI_COPY[language];
  const [copied, setCopied] = useState(false);
  const [pdfSaved, setPdfSaved] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

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
    ...(followUps.length > 0
      ? [
          '',
          `FOLLOW-UP DOCTOR REPORTS (${followUps.length}):`,
          ...followUps
            .slice(0, 6)
            .map(
              (f) =>
                `- ${f.reportDate} (${f.doctorOrClinic || 'Clinic'}): ${f.clinicianSummary || f.summary}`,
            ),
        ]
      : []),
  ].join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plainTextSummary);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for sandboxed iframe environments
      const textarea = document.createElement('textarea');
      textarea.value = plainTextSummary;
      textarea.className = 'fixed opacity-0 pointer-events-none';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } finally {
        document.body.removeChild(textarea);
      }
    }
  };

  const handleDownloadPdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      let pdfPlan: RecoveryPlan = plan;
      const hasNonLatin = /[^\u0000-\u024F]/.test(
        [
          plan.patientContext,
          ...plan.medicines.map((m) => m.foodRule),
          ...plan.conflicts.map((c) => c.explanation),
          ...plan.redFlags,
        ].join(' '),
      );
      if (language !== 'en' || hasNonLatin) {
        try {
          const res = await fetch('/api/discharge/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan, targetLanguage: 'en' }),
          });
          const data = await res.json();
          if (res.ok && data.plan) {
            pdfPlan = { ...plan, ...data.plan, language: 'en' };
          }
        } catch {
          // Proceed with existing plan data if translation call fails
        }
      }

      const pdf = new jsPDF({ unit: 'pt', format: 'a4' }) as JsPdfWithAutoTable;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;
      let y = 0;

      const ensureSpace = (needed: number) => {
        if (y + needed > pageHeight - 56) {
          pdf.addPage();
          y = 44;
        }
      };

      const drawSectionTitle = (title: string, accentRgb: [number, number, number] = [15, 118, 110]) => {
        ensureSpace(34);
        pdf.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
        pdf.rect(margin, y, 3, 14, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(15, 23, 42);
        pdf.text(title, margin + 10, y + 11);
        y += 22;
      };

      // Top Clinical Header Banner
      pdf.setFillColor(15, 118, 110);
      pdf.rect(0, 0, pageWidth, 8, 'F');

      pdf.setFillColor(248, 250, 252);
      pdf.rect(0, 8, pageWidth, 86, 'F');
      pdf.setDrawColor(226, 232, 240);
      pdf.line(0, 94, pageWidth, 94);

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(15, 118, 110);
      pdf.text('DISCHARGEDOST  |  CLINICIAN SBAR HANDOVER BRIEF', margin, 29);

      const generatedOn = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Generated: ${generatedOn}`, pageWidth - margin, 29, { align: 'right' });

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.setTextColor(15, 23, 42);
      pdf.text('Clinician Recovery Brief', margin, 52);

      const subtitleLine = sanitizePdfText(`${pdfPlan.hospitalName}  |  ${pdfPlan.patientContext}`);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(71, 85, 105);
      const subLines = pdf.splitTextToSize(subtitleLine, contentWidth) as string[];
      pdf.text(subLines.slice(0, 2), margin, 68);

      y = 110;

      // 3-Column Structured KPI Summary Cards
      const triageLabel = latestCheckIn
        ? latestCheckIn.severity === 'red_flag'
          ? 'RED FLAG ALERT'
          : latestCheckIn.severity === 'caution'
          ? 'CAUTION'
          : 'STABLE'
        : 'No Check-In Yet';

      const triageColor: [number, number, number] =
        latestCheckIn?.severity === 'red_flag'
          ? [185, 28, 28]
          : latestCheckIn?.severity === 'caution'
          ? [180, 83, 9]
          : latestCheckIn?.severity === 'stable'
          ? [4, 120, 87]
          : [71, 85, 105];

      const cardGap = 10;
      const cardWidth = (contentWidth - cardGap * 2) / 3;
      const cardHeight = 46;
      const kpiCards: Array<{ label: string; value: string; color: [number, number, number] }> = [
        {
          label: 'DISCHARGE DATE',
          value: sanitizePdfText(pdfPlan.dischargeDate || 'Not specified'),
          color: [15, 23, 42],
        },
        {
          label: "TODAY'S ADHERENCE",
          value: `${takenCount} / ${pdfPlan.medicines.length} doses taken`,
          color: [15, 118, 110],
        },
        {
          label: 'LATEST TRIAGE STATUS',
          value: triageLabel,
          color: triageColor,
        },
      ];

      kpiCards.forEach((card, idx) => {
        const x = margin + idx * (cardWidth + cardGap);
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(203, 213, 225);
        pdf.roundedRect(x, y, cardWidth, cardHeight, 4, 4, 'FD');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.setTextColor(100, 116, 139);
        pdf.text(card.label, x + 10, y + 16);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(card.color[0], card.color[1], card.color[2]);
        const valText = pdf.splitTextToSize(card.value, cardWidth - 20) as string[];
        pdf.text(valText[0] || '-', x + 10, y + 34);
      });

      y += cardHeight + 20;

      // Section 1: Structured Clinical SBAR Summary Table
      drawSectionTitle('1. Clinical SBAR Summary');
      const sbarRows = parseSbarRows(pdfPlan.clinicianNote || pdfPlan.plainSummary);
      autoTable(pdf, {
        startY: y,
        margin: { left: margin, right: margin },
        body: sbarRows,
        theme: 'grid',
        styles: {
          font: 'helvetica',
          fontSize: 9.5,
          cellPadding: { top: 7, right: 9, bottom: 7, left: 9 },
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.6,
          valign: 'top',
        },
        columnStyles: {
          0: {
            cellWidth: 112,
            fontStyle: 'bold',
            fontSize: 8.5,
            fillColor: [240, 253, 250],
            textColor: [15, 118, 110],
          },
          1: {
            cellWidth: contentWidth - 112,
          },
        },
      });
      y = (pdf.lastAutoTable?.finalY ?? y + 60) + 18;

      // Section 2: Latest Patient Check-In Alert (if available)
      if (latestCheckIn) {
        const alertAccent: [number, number, number] =
          latestCheckIn.severity === 'red_flag'
            ? [185, 28, 28]
            : latestCheckIn.severity === 'caution'
            ? [180, 83, 9]
            : [4, 120, 87];
        const alertFill: [number, number, number] =
          latestCheckIn.severity === 'red_flag'
            ? [254, 242, 242]
            : latestCheckIn.severity === 'caution'
            ? [255, 251, 235]
            : [236, 253, 245];

        drawSectionTitle(`2. Latest Patient Check-In (${sanitizePdfText(latestCheckIn.checkInDate)})`, alertAccent);
        autoTable(pdf, {
          startY: y,
          margin: { left: margin, right: margin },
          body: [
            ['TRIAGE STATUS', triageLabel],
            ['CLINICIAN ALERT', sanitizePdfText(latestCheckIn.clinicianAlertSummary || latestCheckIn.symptomNote)],
          ],
          theme: 'grid',
          styles: {
            font: 'helvetica',
            fontSize: 9.5,
            cellPadding: { top: 6, right: 9, bottom: 6, left: 9 },
            textColor: [30, 41, 59],
            lineColor: [226, 232, 240],
            lineWidth: 0.6,
          },
          columnStyles: {
            0: {
              cellWidth: 112,
              fontStyle: 'bold',
              fontSize: 8.5,
              fillColor: alertFill,
              textColor: alertAccent,
            },
            1: {
              fillColor: [255, 255, 255],
            },
          },
        });
        y = (pdf.lastAutoTable?.finalY ?? y + 50) + 18;
      }

      // Section 3: Medication & Timing Audit Table
      const medSecNum = latestCheckIn ? '3' : '2';
      drawSectionTitle(`${medSecNum}. Medication & Timing Audit (${pdfPlan.medicines.length} Prescribed)`);
      autoTable(pdf, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['#', 'Medicine', 'Dose', 'Schedule Slot', 'Meal & Timing Guidance']],
        body: pdfPlan.medicines.map((m, idx) => [
          String(idx + 1),
          sanitizePdfText(m.name),
          sanitizePdfText(m.dose),
          ENGLISH_SLOT_LABELS[m.slot] || sanitizePdfText(m.slot.replace(/_/g, ' ')),
          sanitizePdfText(m.foodRule || m.timeLabel),
        ]),
        theme: 'grid',
        headStyles: {
          fillColor: [15, 118, 110],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8.5,
          cellPadding: { top: 7, right: 7, bottom: 7, left: 7 },
        },
        styles: {
          font: 'helvetica',
          fontSize: 8.8,
          cellPadding: { top: 6, right: 7, bottom: 6, left: 7 },
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.5,
          valign: 'top',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 22, halign: 'center', fontStyle: 'bold', textColor: [100, 116, 139] },
          1: { cellWidth: 120, fontStyle: 'bold', textColor: [15, 23, 42] },
          2: { cellWidth: 74 },
          3: { cellWidth: 112 },
          4: { cellWidth: contentWidth - 328 },
        },
      });
      y = (pdf.lastAutoTable?.finalY ?? y + 80) + 18;

      // Section 4: Flagged Drug & Timing Conflicts Table
      const conflictSecNum = latestCheckIn ? '4' : '3';
      drawSectionTitle(
        `${conflictSecNum}. Drug Interaction & Timing Screening (${pdfPlan.conflicts.length} Flagged)`,
        pdfPlan.conflicts.length > 0 ? [185, 28, 28] : [15, 118, 110],
      );
      if (pdfPlan.conflicts.length > 0) {
        autoTable(pdf, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [['Severity', 'Medicine Pair / Rule', 'Clinical Explanation & Recommended Action']],
          body: pdfPlan.conflicts.map((c) => [
            c.severity.toUpperCase(),
            sanitizePdfText(c.pair),
            `${sanitizePdfText(c.explanation)}\nNext step: ${sanitizePdfText(c.recommendation)}`,
          ]),
          theme: 'grid',
          headStyles: {
            fillColor: [153, 27, 27],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8.5,
            cellPadding: { top: 7, right: 7, bottom: 7, left: 7 },
          },
          styles: {
            font: 'helvetica',
            fontSize: 8.8,
            cellPadding: { top: 6, right: 7, bottom: 6, left: 7 },
            textColor: [30, 41, 59],
            lineColor: [226, 232, 240],
            lineWidth: 0.5,
            valign: 'top',
          },
          columnStyles: {
            0: { cellWidth: 66, fontStyle: 'bold', halign: 'center' },
            1: { cellWidth: 144, fontStyle: 'bold', textColor: [15, 23, 42] },
            2: { cellWidth: contentWidth - 210 },
          },
          didParseCell: (hookData) => {
            if (hookData.section === 'body' && hookData.column.index === 0) {
              const sev = String(hookData.cell.raw || '').toUpperCase();
              if (sev === 'HIGH') {
                hookData.cell.styles.fillColor = [254, 226, 226];
                hookData.cell.styles.textColor = [153, 27, 27];
              } else if (sev === 'MODERATE') {
                hookData.cell.styles.fillColor = [254, 243, 199];
                hookData.cell.styles.textColor = [146, 64, 14];
              } else {
                hookData.cell.styles.fillColor = [241, 245, 249];
                hookData.cell.styles.textColor = [51, 65, 85];
              }
            }
          },
        });
        y = (pdf.lastAutoTable?.finalY ?? y + 60) + 18;
      } else {
        autoTable(pdf, {
          startY: y,
          margin: { left: margin, right: margin },
          body: [['No major drug interactions or timing conflicts flagged on this regimen.']],
          theme: 'grid',
          styles: {
            font: 'helvetica',
            fontSize: 9,
            cellPadding: 8,
            fillColor: [236, 253, 245],
            textColor: [6, 95, 70],
            lineColor: [167, 243, 208],
            lineWidth: 0.5,
          },
        });
        y = (pdf.lastAutoTable?.finalY ?? y + 36) + 18;
      }

      // Section 5: Red Flags & Follow-Up Schedule Side-by-Side
      if (pdfPlan.redFlags.length > 0 || pdfPlan.followUpAppointments.length > 0) {
        const careSecNum = latestCheckIn ? '5' : '4';
        drawSectionTitle(`${careSecNum}. Emergency Red Flags & Follow-Up Care`);
        const redFlagBullets =
          pdfPlan.redFlags.length > 0
            ? pdfPlan.redFlags.map((rf) => `- ${sanitizePdfText(rf)}`).join('\n')
            : 'Follow hospital emergency discharge advice.';
        const followUpBullets =
          pdfPlan.followUpAppointments.length > 0
            ? pdfPlan.followUpAppointments.map((ap) => `- ${sanitizePdfText(ap)}`).join('\n')
            : 'Check hospital discharge card for review date.';

        autoTable(pdf, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [['Urgent Warning Signs (Seek Immediate Care)', 'Scheduled Follow-Up Visits']],
          body: [[redFlagBullets, followUpBullets]],
          theme: 'grid',
          headStyles: {
            fillColor: [30, 41, 59],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8.5,
            cellPadding: { top: 7, right: 8, bottom: 7, left: 8 },
          },
          styles: {
            font: 'helvetica',
            fontSize: 8.8,
            cellPadding: { top: 7, right: 8, bottom: 7, left: 8 },
            textColor: [30, 41, 59],
            lineColor: [226, 232, 240],
            lineWidth: 0.5,
            valign: 'top',
          },
          columnStyles: {
            0: { cellWidth: contentWidth / 2, textColor: [127, 29, 29], fillColor: [255, 250, 250] },
            1: { cellWidth: contentWidth / 2, fillColor: [255, 255, 255] },
          },
        });
        y = (pdf.lastAutoTable?.finalY ?? y + 60) + 18;
      }

      // Section 6: Follow-Up Doctor Reports & Prescription Updates
      if (followUps.length > 0) {
        const fuSecNum = (latestCheckIn ? 5 : 4) + (pdfPlan.redFlags.length > 0 || pdfPlan.followUpAppointments.length > 0 ? 1 : 0);
        drawSectionTitle(`${fuSecNum}. Follow-Up Doctor Reports (${followUps.length} Logged)`);
        autoTable(pdf, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [['Date', 'Clinic / Doctor', 'Clinical Summary & Regimen Changes']],
          body: followUps.slice(0, 8).map((rep) => [
            sanitizePdfText(rep.reportDate),
            sanitizePdfText(rep.doctorOrClinic || 'Follow-Up Visit'),
            sanitizePdfText(rep.clinicianSummary || rep.summary),
          ]),
          theme: 'grid',
          headStyles: {
            fillColor: [15, 118, 110],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8.5,
            cellPadding: { top: 7, right: 7, bottom: 7, left: 7 },
          },
          styles: {
            font: 'helvetica',
            fontSize: 8.8,
            cellPadding: { top: 6, right: 7, bottom: 6, left: 7 },
            textColor: [30, 41, 59],
            lineColor: [226, 232, 240],
            lineWidth: 0.5,
            valign: 'top',
          },
          columnStyles: {
            0: { cellWidth: 74, fontStyle: 'bold' },
            1: { cellWidth: 120, fontStyle: 'bold', textColor: [15, 23, 42] },
            2: { cellWidth: contentWidth - 194 },
          },
        });
      }

      // Running Footer & Page Numbers on Every Page
      const totalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setDrawColor(226, 232, 240);
        pdf.line(margin, pageHeight - 36, pageWidth - margin, pageHeight - 36);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.8);
        pdf.setTextColor(100, 116, 139);
        pdf.text(
          "DischargeDost Clinical Handover  |  Supports your doctor's discharge advice and never replaces licensed medical care.",
          margin,
          pageHeight - 22,
        );
        pdf.text(`Page ${p} of ${totalPages}`, pageWidth - margin, pageHeight - 22, {
          align: 'right',
        });
      }

      const safeDate = (pdfPlan.dischargeDate || new Date().toISOString().slice(0, 10))
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .slice(0, 20);
      pdf.save(`DischargeDost-Clinician-Brief-${safeDate}.pdf`);
      setPdfSaved(true);
      window.setTimeout(() => setPdfSaved(false), 2500);
    } catch {
      window.print();
    } finally {
      setIsExportingPdf(false);
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
              className="min-h-[40px] px-4 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
              {copied ? copy.copiedBrief : copy.copyBrief}
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="min-h-[40px] px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
            >
              {isExportingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : pdfSaved ? (
                <Check className="w-4 h-4" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isExportingPdf ? 'Generating PDF...' : pdfSaved ? 'PDF Downloaded' : copy.printBrief}
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

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">{copy.clinicalSbarTitle}</h2>
          <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-200">
            {parseSbarRows(plan.clinicianNote || plan.plainSummary).map(([label, text]) => (
              <div
                key={label}
                className="grid grid-cols-1 sm:grid-cols-12 bg-white"
              >
                <div className="sm:col-span-3 bg-teal-50/70 px-4 py-3 text-xs font-semibold tracking-wide text-teal-900">
                  {label}
                </div>
                <div className="sm:col-span-9 px-4 py-3 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {text}
                </div>
              </div>
            ))}
          </div>
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

        {followUps.length > 0 && (
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Follow-Up Doctor Reports ({followUps.length})
            </h2>
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
              {followUps.map((rep) => (
                <div key={rep.id} className="p-4 space-y-1.5 bg-white">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-semibold text-slate-900">{rep.reportDate}</span>
                    {rep.doctorOrClinic && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{rep.doctorOrClinic}</span>
                      </>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {rep.clinicianSummary || rep.summary}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
