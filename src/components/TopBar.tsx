import type { User } from 'firebase/auth';
import { ClipboardList, FileText, Globe, HeartPulse, Loader2, Upload } from 'lucide-react';
import { LANGUAGE_OPTIONS, UI_COPY, type LanguageCode } from '../types';

export type ActiveTab = 'upload' | 'plan' | 'checkin' | 'clinician';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  hasPlan: boolean;
  language: LanguageCode;
  onChangeLanguage: (lang: LanguageCode) => void;
  isTranslating?: boolean;
  user: User | null;
  onAuthAction: () => void;
}

export function TopBar({
  activeTab,
  onSelectTab,
  hasPlan,
  language,
  onChangeLanguage,
  isTranslating = false,
  user,
  onAuthAction,
}: TopBarProps) {
  const copy = UI_COPY[language];

  const navItems: Array<{
    id: ActiveTab;
    label: string;
    icon: React.ReactNode;
    disabled?: boolean;
  }> = [
    { id: 'upload', label: copy.navUpload, icon: <Upload className="w-3.5 h-3.5 shrink-0" /> },
    {
      id: 'plan',
      label: copy.navPlan,
      icon: <ClipboardList className="w-3.5 h-3.5 shrink-0" />,
      disabled: !hasPlan,
    },
    {
      id: 'checkin',
      label: copy.navCheckIn,
      icon: <HeartPulse className="w-3.5 h-3.5 shrink-0" />,
      disabled: !hasPlan,
    },
    {
      id: 'clinician',
      label: copy.navClinician,
      icon: <FileText className="w-3.5 h-3.5 shrink-0" />,
      disabled: !hasPlan,
    },
  ];

  return (
    <header className="no-print bg-white/95 backdrop-blur border-b border-slate-200/80 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-[68px] flex items-center justify-between gap-3 sm:gap-5">
        <button
          type="button"
          onClick={() => onSelectTab('upload')}
          className="group flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 rounded-xl py-1 pr-1"
        >
          <span className="relative w-10 h-10 rounded-[13px] bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 shadow-[0_6px_14px_-6px_rgba(13,148,136,0.6)] ring-1 ring-inset ring-white/20 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-[1.03]">
            <svg
              viewBox="0 0 36 36"
              fill="none"
              className="w-7 h-7"
              aria-hidden="true"
            >
              {/* Sculpted Home Silhouette representing Post-Hospital Home Recovery */}
              <path
                d="M18 6.5L7.5 15.2C6.85 15.74 6.5 16.54 6.5 17.38V26.2C6.5 28.02 7.98 29.5 9.8 29.5H26.2C28.02 29.5 29.5 28.02 29.5 26.2V17.38C29.5 16.54 29.15 15.74 28.5 15.2L18 6.5Z"
                fill="white"
              />
              {/* Crisp Carved Clinical Cross inside the Home */}
              <rect x="16.1" y="14.4" width="3.8" height="10.8" rx="1.2" fill="#0F766E" />
              <rect x="12.6" y="17.9" width="10.8" height="3.8" rx="1.2" fill="#0F766E" />
              {/* Warm Companion Care Dot at the Roof Peak */}
              <circle cx="18" cy="11.3" r="1.45" fill="#34D399" />
            </svg>
          </span>
          <span className="flex flex-col">
            <span className="font-display text-lg sm:text-[21px] font-extrabold tracking-tight leading-none text-slate-900">
              Discharge<span className="text-teal-700">Dost</span>
            </span>
            <span className="hidden sm:block text-[10px] font-semibold tracking-[0.09em] uppercase text-slate-500 mt-1 leading-none">
              Home Recovery Care
            </span>
          </span>
        </button>

        <nav
          aria-label="Primary sections"
          className="hidden lg:flex items-center gap-1 p-1 bg-slate-100/90 border border-slate-200/80 rounded-xl"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                onClick={() => onSelectTab(item.id)}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  isActive
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'text-slate-800 hover:text-teal-900 hover:bg-white'
                }`}
              >
                <span className={isActive ? 'text-teal-100' : 'text-teal-700'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {/* Desktop / Tablet Segmented Language Switcher */}
          <div
            role="group"
            aria-label={copy.languageLabel}
            className="hidden sm:flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200/80"
          >
            <span className="pl-1.5 pr-1 text-slate-500 flex items-center">
              {isTranslating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700" />
              ) : (
                <Globe className="w-3.5 h-3.5" />
              )}
            </span>
            {LANGUAGE_OPTIONS.map((opt) => (
              <button
                key={opt.code}
                type="button"
                disabled={isTranslating}
                onClick={() => onChangeLanguage(opt.code)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
                  language === opt.code
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.nativeLabel}
              </button>
            ))}
          </div>

          {/* Mobile Compact Language Dropdown */}
          <div className="sm:hidden flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5">
            {isTranslating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-700 shrink-0" />
            ) : (
              <Globe className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            )}
            <select
              aria-label={copy.languageLabel}
              value={language}
              disabled={isTranslating}
              onChange={(e) => onChangeLanguage(e.target.value as LanguageCode)}
              className="bg-transparent text-xs font-medium text-slate-900 focus:outline-none cursor-pointer"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.nativeLabel}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={onAuthAction}
            className="px-3.5 sm:px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
          >
            {user ? copy.signOut : copy.signInGoogle}
          </button>
        </div>
      </div>

      {/* Tablet / Mobile highlighted tab strip */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden flex items-center gap-1.5 px-4 sm:px-6 py-2 bg-slate-50/90 border-t border-slate-200/80 overflow-x-auto"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              onClick={() => onSelectTab(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors disabled:opacity-40 ${
                isActive
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'bg-white text-slate-800 border border-slate-200/90 hover:border-teal-300 hover:text-teal-900'
              }`}
            >
              <span className={isActive ? 'text-teal-100' : 'text-teal-700'}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}
