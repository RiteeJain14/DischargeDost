import React, { useRef, useState } from 'react';
import { FileImage, FileText, Loader2, Sparkles, Upload } from 'lucide-react';
import { renderSampleDischargeImage } from '../lib/sampleDischarge';
import { UI_COPY, type LanguageCode } from '../types';

interface UploadWorkspaceProps {
  language: LanguageCode;
  isAnalyzing: boolean;
  errorMessage: string | null;
  onAnalyze: (payload: {
    imageBase64?: string;
    mimeType?: string;
    rawText?: string;
    language: LanguageCode;
  }) => Promise<void>;
}

const HERO_IMAGE_SRC = '/src/assets/images/recovery_care_table_1795698814548.jpg';

export function UploadWorkspace({
  language,
  isAnalyzing,
  errorMessage,
  onAnalyze,
}: UploadWorkspaceProps) {
  const copy = UI_COPY[language];
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | undefined>(undefined);
  const [fileMime, setFileMime] = useState<string | undefined>(undefined);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawText, setRawText] = useState('');
  const [heroImgFailed, setHeroImgFailed] = useState(false);

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
    };
    reader.readAsDataURL(file);
  };

  const handleUseSamplePhoto = () => {
    const sample = renderSampleDischargeImage();
    setPreviewUrl(sample.dataUrl);
    setFileBase64(sample.base64);
    setFileMime(sample.mimeType);
    setFileName('apollo_cardiology_discharge_sample.png');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileBase64 && !rawText.trim()) return;
    await onAnalyze({
      imageBase64: fileBase64,
      mimeType: fileMime,
      rawText: rawText.trim() || undefined,
      language,
    });
  };

  const canSubmit = Boolean((fileBase64 || rawText.trim()) && !isAnalyzing);

  return (
    <section className="space-y-10">
      {/* Editorial Hero Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-between bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
          <div>
            <p className="text-xs font-medium text-teal-800 tracking-wide">
              {copy.heroEyebrow}
            </p>
            <h1 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 text-balance leading-tight">
              {copy.heroTitle}
            </h1>
            <p className="mt-4 text-base text-slate-600 leading-relaxed max-w-2xl">
              {copy.heroSubtitle}
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div>
              <p className="font-mono text-xs font-semibold text-slate-500">01</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{copy.step1Title}</p>
              <p className="mt-1 text-xs text-slate-600">{copy.step1Desc}</p>
            </div>
            <div>
              <p className="font-mono text-xs font-semibold text-slate-500">02</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{copy.step2Title}</p>
              <p className="mt-1 text-xs text-slate-600">{copy.step2Desc}</p>
            </div>
            <div>
              <p className="font-mono text-xs font-semibold text-slate-500">03</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{copy.step3Title}</p>
              <p className="mt-1 text-xs text-slate-600">{copy.step3Desc}</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 min-h-[260px]">
          {!heroImgFailed ? (
            <img
              src={HERO_IMAGE_SRC}
              alt="Sunlit home table with wooden weekly medicine organizer, warm water cup, and recovery notebook"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-slate-100 to-teal-50">
              <FileText className="w-10 h-10 text-teal-700" />
              <p className="mt-3 text-sm font-medium text-slate-800">
                {copy.fallbackHeroTitle}
              </p>
              <p className="mt-1 text-xs text-slate-600">{copy.fallbackHeroSub}</p>
            </div>
          )}
        </div>
      </div>

      {/* Upload & Extraction Workbench */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
      >
        <div className="pb-6 border-b border-slate-200">
          <h2 className="font-display text-xl font-semibold text-slate-900">
            {copy.uploadCardTitle}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{copy.uploadCardSub}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Dropzone & Sample Trigger */}
          <div className="lg:col-span-6 space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => handleFileSelected(e.target.files?.[0])}
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFileSelected(e.dataTransfer.files?.[0]);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className="border border-dashed border-slate-300 hover:border-teal-600 bg-slate-50 hover:bg-teal-50/40 rounded-xl p-6 text-center transition-colors cursor-pointer"
            >
              <Upload className="w-8 h-8 text-teal-700 mx-auto" />
              <p className="mt-3 text-sm font-medium text-slate-900">{copy.dropzonePrompt}</p>
              <p className="mt-1 text-xs text-slate-500">{copy.dropzoneHint}</p>
              {fileName && (
                <p className="mt-3 text-xs font-mono text-teal-800 truncate">
                  {copy.selectedFileLabel} {fileName}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleUseSamplePhoto}
                className="px-4 py-2 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
              >
                <FileImage className="w-4 h-4" />
                {copy.loadSampleBtn}
              </button>
              {fileBase64 && (
                <button
                  type="button"
                  onClick={() => {
                    setPreviewUrl(null);
                    setFileBase64(undefined);
                    setFileMime(undefined);
                    setFileName(null);
                  }}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  {copy.clearFileBtn}
                </button>
              )}
            </div>

            {previewUrl && (
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
                  <span className="truncate">{fileName}</span>
                  <span>{copy.readyForVision}</span>
                </div>
                <img
                  src={previewUrl}
                  alt="Uploaded hospital discharge document preview"
                  referrerPolicy="no-referrer"
                  className="w-full max-h-72 object-contain bg-white"
                />
              </div>
            )}
          </div>

          {/* Right: Optional Notes / Paste Text */}
          <div className="lg:col-span-6 space-y-4">
            <div>
              <label
                htmlFor="discharge-notes"
                className="block text-sm font-medium text-slate-900"
              >
                {copy.notesLabel}
              </label>
              <p className="mt-1 text-xs text-slate-500">{copy.notesHint}</p>
              <textarea
                id="discharge-notes"
                rows={7}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={copy.notesPlaceholder}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20"
              />
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {errorMessage}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
              <p className="text-xs text-slate-500">{copy.disclaimer}</p>
              <button
                type="submit"
                disabled={!canSubmit}
                className="px-5 py-2.5 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center justify-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {copy.analyzingBtn}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {copy.analyzeBtn}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}
