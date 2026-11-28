import { useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { ClinicianBriefView } from './components/ClinicianBriefView';
import { DailyCheckInView } from './components/DailyCheckInView';
import { DailyPlanView } from './components/DailyPlanView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TopBar, type ActiveTab } from './components/TopBar';
import { UploadWorkspace } from './components/UploadWorkspace';
import {
  auth,
  getUserPreferredLanguage,
  isFirebaseConfigured,
  saveDailyCheckIn,
  saveFollowUpReport,
  saveRecoveryPlan,
  signInWithGoogle,
  signOutUser,
  subscribeDoseLogs,
  subscribePlanCheckIns,
  subscribePlanFollowUps,
  subscribeUserPlans,
  testFirestoreConnection,
  toggleDoseLog,
  updateRecoveryPlanTranslation,
  upsertUserProfile,
} from './lib/firebase';
import {
  UI_COPY,
  type DailyCheckIn,
  type FollowUpReport,
  type LanguageCode,
  type RecoveryPlan,
  type ToolCallRecord,
} from './types';

const LANG_STORAGE_KEY = 'dischargedost_lang';

function isValidLang(value: string | null): value is LanguageCode {
  return value === 'en' || value === 'hi' || value === 'ta' || value === 'bn';
}

function getInitialLanguage(): LanguageCode {
  try {
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (isValidLang(stored)) return stored;
  } catch {
    // ignore storage errors
  }
  return 'en';
}

function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function DischargeDostApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileSynced, setProfileSynced] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('upload');
  const [language, setLanguage] = useState<LanguageCode>(getInitialLanguage);

  const [savedPlans, setSavedPlans] = useState<RecoveryPlan[]>([]);
  const [activePlan, setActivePlan] = useState<RecoveryPlan | null>(null);

  const [takenSlots, setTakenSlots] = useState<Record<string, boolean>>({});
  const [checkIns, setCheckIns] = useState<DailyCheckIn[]>([]);
  const [followUps, setFollowUps] = useState<FollowUpReport[]>([]);
  const [uploadMode, setUploadMode] = useState<'new' | 'followup'>('new');
  const [toolCalls, setToolCalls] = useState<ToolCallRecord[]>([]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const languageRef = useRef<LanguageCode>(language);
  const autoTranslatedKeyRef = useRef<string | null>(null);
  const userClearedPlanRef = useRef(false);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  const todayKey = getTodayDateKey();

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setAuthReady(true);
      setProfileSynced(true);
      return;
    }
    testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);

      if (currentUser) {
        let hasStoredLang = false;
        try {
          hasStoredLang = isValidLang(window.localStorage.getItem(LANG_STORAGE_KEY));
        } catch {
          hasStoredLang = false;
        }

        try {
          if (!hasStoredLang) {
            const savedPref = await getUserPreferredLanguage(currentUser.uid);
            if (savedPref) {
              setLanguage(savedPref);
              languageRef.current = savedPref;
              try {
                window.localStorage.setItem(LANG_STORAGE_KEY, savedPref);
              } catch {
                // ignore
              }
            }
          }
          await upsertUserProfile(languageRef.current);
        } catch (err) {
          console.error('Profile sync failed:', err);
        } finally {
          setProfileSynced(true);
        }
      } else {
        setProfileSynced(true);
      }
    });
    return () => unsub();
  }, []);

  // Subscribe to user's Firestore recovery plans when signed in
  useEffect(() => {
    if (!authReady || !user) {
      setSavedPlans([]);
      return;
    }
    const unsub = subscribeUserPlans(
      user.uid,
      (plans) => {
        setSavedPlans(plans);
        setActivePlan((prev) => {
          if (prev && plans.some((p) => p.id === prev.id)) {
            return plans.find((p) => p.id === prev.id) ?? prev;
          }
          if (userClearedPlanRef.current) {
            return null;
          }
          if (!prev && plans.length > 0) {
            setUploadMode('followup');
            return plans[0];
          }
          return prev ?? plans[0] ?? null;
        });
      },
      (err) => {
        setSyncNotice(err.message);
      },
    );
    return () => unsub();
  }, [authReady, user]);

  // Subscribe to check-ins, follow-up reports & daily dose logs when viewing a Firestore-persisted plan
  useEffect(() => {
    if (!authReady || !user || !activePlan || activePlan.id.startsWith('local_')) {
      return;
    }
    const unsubCheckIns = subscribePlanCheckIns(
      activePlan.id,
      user.uid,
      (items) => setCheckIns(items),
      (err) => setSyncNotice(err.message),
    );
    const unsubFollowUps = subscribePlanFollowUps(
      activePlan.id,
      user.uid,
      (items) => setFollowUps(items),
      (err) => setSyncNotice(err.message),
    );
    const unsubDoses = subscribeDoseLogs(
      activePlan.id,
      user.uid,
      todayKey,
      (map) => setTakenSlots(map),
      (err) => setSyncNotice(err.message),
    );
    return () => {
      unsubCheckIns();
      unsubFollowUps();
      unsubDoses();
    };
  }, [authReady, user, activePlan?.id, todayKey]);

  const translatePlanToLanguage = async (
    planToTranslate: RecoveryPlan,
    targetLanguage: LanguageCode,
  ) => {
    if (planToTranslate.language === targetLanguage) return;
    setIsTranslating(true);
    setSyncNotice(null);

    try {
      const res = await fetch('/api/discharge/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planToTranslate, targetLanguage }),
      });
      const data = await res.json();
      if (!res.ok || !data.plan) {
        throw new Error(data.error || 'Failed to translate plan.');
      }

      const updated: RecoveryPlan = {
        ...planToTranslate,
        ...data.plan,
        language: targetLanguage,
      };
      setActivePlan((current) =>
        current && current.id === planToTranslate.id ? updated : current,
      );

      if (user && !planToTranslate.id.startsWith('local_')) {
        await updateRecoveryPlanTranslation(planToTranslate.id, updated);
      }
    } catch (err) {
      setSyncNotice(err instanceof Error ? err.message : 'Translation failed.');
    } finally {
      setIsTranslating(false);
    }
  };

  // Keep active plan automatically synchronized with the global header language
  useEffect(() => {
    if (!profileSynced || !activePlan || isTranslating) return;
    if (activePlan.language === language) return;

    const translationKey = `${activePlan.id}:${language}`;
    if (autoTranslatedKeyRef.current === translationKey) return;
    autoTranslatedKeyRef.current = translationKey;

    translatePlanToLanguage(activePlan, language);
  }, [profileSynced, activePlan?.id, activePlan?.language, language, isTranslating]);

  const handleLanguageChange = (nextLanguage: LanguageCode) => {
    if (nextLanguage === language) return;
    setLanguage(nextLanguage);
    languageRef.current = nextLanguage;
    autoTranslatedKeyRef.current = null;
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, nextLanguage);
    } catch {
      // ignore storage errors
    }

    if (user) {
      upsertUserProfile(nextLanguage).catch((err) => {
        console.error('Failed to persist language preference:', err);
      });
    }
  };

  const handleChangeUploadMode = (mode: 'new' | 'followup') => {
    setUploadMode(mode);
    if (mode === 'new') {
      userClearedPlanRef.current = true;
      autoTranslatedKeyRef.current = null;
      setActivePlan(null);
      setCheckIns([]);
      setFollowUps([]);
      setTakenSlots({});
    } else {
      userClearedPlanRef.current = false;
      if (!activePlan && savedPlans.length > 0) {
        autoTranslatedKeyRef.current = null;
        setActivePlan(savedPlans[0]);
      }
    }
  };

  const handleAuthAction = async () => {
    setSyncNotice(null);
    try {
      if (user) {
        await signOutUser();
        userClearedPlanRef.current = false;
        setActivePlan(null);
        setCheckIns([]);
        setFollowUps([]);
        setTakenSlots({});
        setUploadMode('new');
        setActiveTab('upload');
      } else {
        const cred = await signInWithGoogle();
        if (cred.user && activePlan && activePlan.id.startsWith('local_')) {
          const { id: _localId, ...rest } = activePlan;
          const firestoreId = await saveRecoveryPlan({ ...rest, language });
          userClearedPlanRef.current = false;
          setActivePlan({ ...rest, id: firestoreId, ownerId: cred.user.uid, language });
          setSyncNotice('Your current recovery plan has been saved to Firestore.');
        }
      }
    } catch (err) {
      setSyncNotice(err instanceof Error ? err.message : 'Authentication action failed.');
    }
  };

  const handleAnalyze = async (payload: {
    imageBase64?: string;
    mimeType?: string;
    rawText?: string;
    intakeNotes?: string;
    language: LanguageCode;
  }) => {
    setIsAnalyzing(true);
    setAnalyzeError(null);
    setSyncNotice(null);

    try {
      const res = await fetch('/api/discharge/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, language }),
      });
      const data = await res.json();
      if (!res.ok || !data.plan) {
        throw new Error(data.error || 'Failed to analyze discharge summary.');
      }

      const generatedPlan: Omit<RecoveryPlan, 'id'> = {
        ...data.plan,
        language,
        status: 'active',
      };

      setToolCalls(Array.isArray(data.toolCallsExecuted) ? data.toolCallsExecuted : []);
      setTakenSlots({});
      setCheckIns([]);
      setFollowUps([]);

      userClearedPlanRef.current = false;
      if (user) {
        const planId = await saveRecoveryPlan(generatedPlan);
        setActivePlan({ ...generatedPlan, id: planId, ownerId: user.uid });
      } else {
        setActivePlan({ ...generatedPlan, id: `local_${Date.now()}` });
      }

      setUploadMode('followup');
      setActiveTab('plan');
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Could not process discharge summary.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyFollowUp = async (payload: {
    imageBase64?: string;
    mimeType?: string;
    rawText?: string;
    intakeNotes?: string;
    language: LanguageCode;
  }) => {
    if (!activePlan) return;
    setIsAnalyzing(true);
    setAnalyzeError(null);
    setSyncNotice(null);

    try {
      const res = await fetch('/api/discharge/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existingPlan: activePlan,
          checkIns: checkIns.slice(0, 10),
          previousFollowUps: followUps.slice(0, 8),
          ...payload,
          language,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.updatedPlan || !data.followUpReport) {
        throw new Error(data.error || 'Failed to apply follow-up report.');
      }

      if (Array.isArray(data.toolCallsExecuted)) {
        setToolCalls(data.toolCallsExecuted);
      }

      const mergedPlan: RecoveryPlan = {
        ...activePlan,
        ...data.updatedPlan,
        id: activePlan.id,
        ownerId: activePlan.ownerId,
        language,
        status: activePlan.status ?? 'active',
      };

      const newReportData: Omit<FollowUpReport, 'id' | 'planId' | 'ownerId'> = {
        reportDate: data.followUpReport.reportDate || todayKey,
        doctorOrClinic: data.followUpReport.doctorOrClinic || activePlan.hospitalName || 'Follow-Up Clinic',
        reportType: data.followUpReport.reportType || 'opd_note',
        language,
        summary: data.followUpReport.summary || 'Follow-up report applied.',
        changes: Array.isArray(data.followUpReport.changes)
          ? data.followUpReport.changes.map(String)
          : [],
        clinicianSummary: data.followUpReport.clinicianSummary || data.followUpReport.summary || '',
        createdAtLabel: data.followUpReport.reportDate || todayKey,
      };

      setActivePlan(mergedPlan);

      if (user && !activePlan.id.startsWith('local_')) {
        await updateRecoveryPlanTranslation(activePlan.id, mergedPlan);
        await saveFollowUpReport(activePlan.id, newReportData);
      } else {
        const localFollowUp: FollowUpReport = {
          ...newReportData,
          id: `local_fup_${Date.now()}`,
          planId: activePlan.id,
        };
        setFollowUps((prev) => [localFollowUp, ...prev]);
      }

      setSyncNotice(`Follow-up report added and "${mergedPlan.title}" has been updated.`);
      setActiveTab('plan');
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : 'Could not process follow-up report.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleToggleDose = async (slotKey: string, nextTaken: boolean) => {
    if (!activePlan) return;
    setTakenSlots((prev) => ({ ...prev, [slotKey]: nextTaken }));

    if (user && !activePlan.id.startsWith('local_')) {
      try {
        await toggleDoseLog(activePlan.id, todayKey, slotKey, nextTaken);
      } catch (err) {
        setSyncNotice(err instanceof Error ? err.message : 'Could not update dose log.');
      }
    }
  };

  const handleSubmitCheckIn = async (payload: {
    symptomsText: string;
    audioBase64?: string;
    audioMimeType?: string;
    inputMode: 'text' | 'voice';
    medicinesTaken: string[];
  }): Promise<DailyCheckIn | null> => {
    if (!activePlan) return null;
    setIsEvaluating(true);
    setCheckInError(null);

    try {
      const res = await fetch('/api/checkin/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptomsText: payload.symptomsText,
          audioBase64: payload.audioBase64,
          audioMimeType: payload.audioMimeType,
          language,
          medicinesTaken: payload.medicinesTaken,
          planContext: {
            patientContext: activePlan.patientContext,
            medicines: activePlan.medicines,
            redFlags: activePlan.redFlags,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.evaluation) {
        throw new Error(data.error || 'Failed to evaluate symptoms.');
      }

      if (Array.isArray(data.toolCallsExecuted)) {
        setToolCalls((prev) => [...prev, ...data.toolCallsExecuted]);
      }

      const newEntry: Omit<DailyCheckIn, 'id'> = {
        planId: activePlan.id,
        ownerId: user?.uid,
        checkInDate: todayKey,
        inputMode: payload.inputMode,
        language,
        symptomNote: data.transcript || payload.symptomsText,
        medicinesTaken: payload.medicinesTaken,
        severity: data.evaluation.severity,
        guidance: data.evaluation.guidance,
        matchedRedFlags: Array.isArray(data.evaluation.matchedRedFlags)
          ? data.evaluation.matchedRedFlags
          : [],
        clinicianAlertSummary: data.evaluation.clinicianAlertSummary,
        createdAtLabel: todayKey,
      };

      if (user && !activePlan.id.startsWith('local_')) {
        const checkInId = await saveDailyCheckIn(activePlan.id, newEntry);
        return { ...newEntry, id: checkInId };
      }

      const localCheckIn: DailyCheckIn = { ...newEntry, id: `local_chk_${Date.now()}` };
      setCheckIns((prev) => [localCheckIn, ...prev]);
      return localCheckIn;
    } catch (err) {
      setCheckInError(err instanceof Error ? err.message : 'Check-in failed.');
      return null;
    } finally {
      setIsEvaluating(false);
    }
  };

  const copy = UI_COPY[language];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 bg-[radial-gradient(ellipse_at_top,_rgba(15,118,110,0.06),_transparent_55%)] text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        hasPlan={Boolean(activePlan)}
        language={language}
        onChangeLanguage={handleLanguageChange}
        isTranslating={isTranslating}
        user={user}
        onAuthAction={handleAuthAction}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Saved Plans Dropdown Selector (First / Upload page only) */}
        {activeTab === 'upload' && user && savedPlans.length > 0 && (
          <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs">
            <div className="flex flex-wrap items-center gap-2.5 min-w-0">
              <label
                htmlFor="saved-recovery-plan-select"
                className="font-semibold text-slate-700 whitespace-nowrap"
              >
                {copy.savedPlansLabel}
              </label>
              <select
                id="saved-recovery-plan-select"
                value={activePlan?.id ?? ''}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  if (!selectedId) {
                    handleChangeUploadMode('new');
                    return;
                  }
                  const chosen = savedPlans.find((p) => p.id === selectedId);
                  if (!chosen) return;
                  userClearedPlanRef.current = false;
                  autoTranslatedKeyRef.current = null;
                  setActivePlan(chosen);
                  setUploadMode('followup');
                }}
                className="min-h-[36px] max-w-full sm:max-w-sm rounded-lg border border-slate-300 bg-slate-50 hover:border-teal-500 focus:border-teal-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/15 px-3 py-1.5 text-xs font-medium text-slate-900 cursor-pointer"
              >
                <option value="">-- Select a saved plan --</option>
                {savedPlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                    {p.dischargeDate ? ` (${p.dischargeDate})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <span className="text-slate-500 truncate max-w-xs">{user.email}</span>
          </div>
        )}

        {!user && activePlan && (
          <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-slate-200 rounded-lg px-4 py-3 text-xs">
            <span className="text-slate-600">{copy.guestPreviewNotice}</span>
            <button
              type="button"
              onClick={handleAuthAction}
              className="px-3 py-1.5 font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
            >
              {copy.saveToFirestore}
            </button>
          </div>
        )}

        {syncNotice && (
          <div className="no-print rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700">
            {syncNotice}
          </div>
        )}

        {activeTab === 'upload' && (
          <UploadWorkspace
            language={language}
            activePlan={activePlan}
            hasSavedPlans={savedPlans.length > 0}
            checkIns={checkIns}
            followUps={followUps}
            uploadMode={uploadMode}
            onChangeUploadMode={handleChangeUploadMode}
            isAnalyzing={isAnalyzing}
            errorMessage={analyzeError}
            onAnalyze={handleAnalyze}
            onApplyFollowUp={handleApplyFollowUp}
          />
        )}

        {activeTab === 'plan' && activePlan && (
          <DailyPlanView
            plan={activePlan}
            language={language}
            takenSlots={takenSlots}
            followUps={followUps}
            onToggleDose={handleToggleDose}
            isTranslating={isTranslating}
            toolCalls={toolCalls}
            onGoToCheckIn={() => setActiveTab('checkin')}
            onAddFollowUpReport={() => {
              setUploadMode('followup');
              setActiveTab('upload');
            }}
          />
        )}

        {activeTab === 'checkin' && activePlan && (
          <DailyCheckInView
            plan={activePlan}
            language={language}
            takenSlots={takenSlots}
            checkIns={checkIns}
            onSubmitCheckIn={handleSubmitCheckIn}
            isEvaluating={isEvaluating}
            errorMessage={checkInError}
            onViewClinicianBrief={() => setActiveTab('clinician')}
          />
        )}

        {activeTab === 'clinician' && activePlan && (
          <ClinicianBriefView
            plan={activePlan}
            language={language}
            takenSlots={takenSlots}
            checkIns={checkIns}
            followUps={followUps}
          />
        )}
      </main>

      <footer className="no-print border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500">
          <span>DischargeDost</span>
          <span>{copy.disclaimer}</span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <DischargeDostApp />
    </ErrorBoundary>
  );
}
