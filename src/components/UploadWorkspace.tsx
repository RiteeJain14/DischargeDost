import { useMemo, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { renderSampleDischargeImage } from '../lib/sampleDischarge';
import {
  UI_COPY,
  type DailyCheckIn,
  type FollowUpReport,
  type LanguageCode,
  type RecoveryPlan,
} from '../types';
import { FrontIntakePanel } from './FrontIntakePanel';

interface UploadWorkspaceProps {
  language: LanguageCode;
  activePlan: RecoveryPlan | null;
  hasSavedPlans: boolean;
  checkIns: DailyCheckIn[];
  followUps: FollowUpReport[];
  uploadMode: 'new' | 'followup';
  onChangeUploadMode: (mode: 'new' | 'followup') => void;
  isAnalyzing: boolean;
  errorMessage: string | null;
  onAnalyze: (payload: {
    imageBase64?: string;
    mimeType?: string;
    rawText?: string;
    intakeNotes?: string;
    language: LanguageCode;
  }) => Promise<void>;
  onApplyFollowUp: (payload: {
    imageBase64?: string;
    mimeType?: string;
    rawText?: string;
    intakeNotes?: string;
    language: LanguageCode;
  }) => Promise<void>;
}

export function UploadWorkspace({
  language,
  activePlan,
  hasSavedPlans,
  checkIns,
  followUps,
  uploadMode,
  onChangeUploadMode,
  isAnalyzing,
  errorMessage,
  onAnalyze,
  onApplyFollowUp,
}: UploadWorkspaceProps) {
  const copy = UI_COPY[language];

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const agentAnchorRef = useRef<HTMLDivElement | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | undefined>(undefined);
  const [fileMime, setFileMime] = useState<string | undefined>(undefined);
  const [fileName, setFileName] = useState<string | null>(null);
  const [attachmentVersion, setAttachmentVersion] = useState(0);

  const sampleThumbUrl = useMemo(() => {
    try {
      return renderSampleDischargeImage().dataUrl;
    } catch {
      return null;
    }
  }, []);

  const handleFileSelected = (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setFileMime(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      setFileBase64(base64);
      if (file.type.startsWith('image/')) {
        setPreviewUrl(result);
      } else {
        setPreviewUrl(null);
      }
      setAttachmentVersion((v) => v + 1);
    };
    reader.readAsDataURL(file);
  };

  const handleUseSamplePhoto = () => {
    const sample = renderSampleDischargeImage();
    setPreviewUrl(sample.dataUrl);
    setFileBase64(sample.base64);
    setFileMime(sample.mimeType);
    setFileName('apollo_cardiology_discharge_sample.png');
    setAttachmentVersion((v) => v + 1);
  };

  const handleLoadSampleAndScroll = () => {
    handleUseSamplePhoto();
    agentAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleClearFile = () => {
    setPreviewUrl(null);
    setFileBase64(undefined);
    setFileMime(undefined);
    setFileName(null);
  };

  const handleBuildPlan = async (intakeNotes: string) => {
    if (!fileBase64 && !intakeNotes.trim()) return;
    const payload = {
      imageBase64: fileBase64,
      mimeType: fileMime,
      intakeNotes: intakeNotes.trim() || undefined,
      language,
    };
    if (activePlan && uploadMode === 'followup') {
      await onApplyFollowUp(payload);
    } else {
      await onAnalyze(payload);
    }
  };

  return (
    <div className="pb-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => {
          handleFileSelected(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {/* Section 1: Mobile-First & 12-Col Web Interactive Clinical Workbench */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">
        {/* Block A: Editorial Headline & Lead */}
        <div className="order-1 lg:col-span-5 lg:col-start-1 lg:row-start-1 space-y-3 sm:space-y-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-teal-800">
            <span>{copy.heroEyebrow}</span>
          </div>

          <h1 className="font-display text-2xl sm:text-3xl lg:text-[36px] font-bold tracking-tight text-slate-900 leading-[1.16] text-balance">
            {copy.homeHeadline}
          </h1>

          <p className="text-sm sm:text-[15px] text-slate-600 leading-relaxed">
            {copy.homeLead}
          </p>
        </div>

        {/* Block B: Live Interactive Agent Console */}
        <div
          ref={agentAnchorRef}
          className="order-2 lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:row-span-2 lg:self-stretch scroll-mt-20"
        >
          <FrontIntakePanel
            language={language}
            selectedPlan={activePlan}
            hasSavedPlans={hasSavedPlans}
            checkIns={checkIns}
            followUps={followUps}
            uploadMode={uploadMode}
            onChangeUploadMode={onChangeUploadMode}
            fileBase64={fileBase64}
            fileMime={fileMime}
            fileName={fileName}
            previewUrl={previewUrl}
            attachmentVersion={attachmentVersion}
            isAnalyzing={isAnalyzing}
            errorMessage={errorMessage}
            onTriggerFileSelect={() => fileInputRef.current?.click()}
            onFileDropped={handleFileSelected}
            onClearFile={handleClearFile}
            onLoadSampleAndReview={handleUseSamplePhoto}
            onBuildFinalPlan={handleBuildPlan}
          />
        </div>

        {/* Block C: Sample Case Launcher + Numbered Editorial Workflow */}
        <div className="order-3 lg:col-span-5 lg:col-start-1 lg:row-start-2 flex flex-col justify-between space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
            <div className="flex items-center gap-3.5 min-w-0">
              {sampleThumbUrl ? (
                <img
                  src={sampleThumbUrl}
                  alt="Sample Apollo Cardiology discharge summary preview"
                  referrerPolicy="no-referrer"
                  className="w-12 h-14 rounded-md object-cover border border-slate-200 bg-slate-50 shrink-0"
                />
              ) : (
                <div className="w-12 h-14 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-teal-700" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {copy.homeSampleCardTitle}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                  {copy.homeSampleCardMeta}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLoadSampleAndScroll}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-[38px] px-4 py-2 text-xs font-semibold text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl sm:rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center justify-center"
            >
              {copy.homeTrySampleCta}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-1 divide-y md:divide-y-0 md:divide-x lg:divide-x-0 lg:divide-y divide-slate-200/80 border-y border-slate-200/80">
            <div className="py-3.5 md:px-4 md:first:pl-0 lg:px-0">
              <p className="text-sm font-semibold text-slate-900">{copy.homeFlow1Title}</p>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{copy.homeFlow1Desc}</p>
            </div>
            <div className="py-3.5 md:px-4 lg:px-0">
              <p className="text-sm font-semibold text-slate-900">{copy.homeFlow2Title}</p>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{copy.homeFlow2Desc}</p>
            </div>
            <div className="py-3.5 md:px-4 md:last:pr-0 lg:px-0">
              <p className="text-sm font-semibold text-slate-900">{copy.homeFlow3Title}</p>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{copy.homeFlow3Desc}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
