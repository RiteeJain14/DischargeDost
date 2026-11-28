import type { User } from 'firebase/auth';
import { Globe, Loader2 } from 'lucide-react';
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

  const navItems: Array<{ id: ActiveTab; label: string; disabled?: boolean }> = [
    { id: 'upload', label: copy.navUpload },
    { id: 'plan', label: copy.navPlan, disabled: !hasPlan },
    { id: 'checkin', label: copy.navCheckIn, disabled: !hasPlan },
    { id: 'clinician', label: copy.navClinician, disabled: !hasPlan },
  ];

  return (
    <header className="no-print bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => onSelectTab('upload')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 rounded"
        >
          DischargeDost
        </button>

        <nav
          aria-label="Primary sections"
          className="hidden lg:flex items-center gap-6"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                onClick={() => onSelectTab(item.id)}
                className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  isActive
                    ? 'text-teal-800 border-teal-700'
                    : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
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
            className="px-3.5 sm:px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
          >
            {user ? copy.signOut : copy.signInGoogle}
          </button>
        </div>
      </div>

      {/* Tablet / Mobile single-row tab strip */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden flex items-center gap-5 px-4 sm:px-6 py-2 border-t border-slate-100 overflow-x-auto"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              onClick={() => onSelectTab(item.id)}
              className={`text-xs font-medium whitespace-nowrap shrink-0 py-1.5 border-b-2 transition-colors disabled:opacity-40 ${
                isActive
                  ? 'text-teal-800 border-teal-700'
                  : 'text-slate-600 border-transparent'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
