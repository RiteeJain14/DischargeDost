import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, type Auth } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { DailyCheckIn, FollowUpReport, LanguageCode, RecoveryPlan } from '../types';

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey?.trim() &&
    firebaseConfig.projectId?.trim() &&
    firebaseConfig.appId?.trim(),
);

const app: FirebaseApp | null = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const db: Firestore | null =
  app && firebaseConfig.firestoreDatabaseId?.trim()
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : app
    ? getFirestore(app)
    : null;
export const auth: Auth | null = app ? getAuth(app) : null;
const googleProvider = new GoogleAuthProvider();

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
} as const;

export type OperationTypeValue = (typeof OperationType)[keyof typeof OperationType];

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationTypeValue;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: Array<{
      providerId?: string | null;
      email?: string | null;
    }>;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationTypeValue,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<void> {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export async function signInWithGoogle() {
  if (!auth) {
    throw new Error('Firebase is not configured yet. Add your Firebase config to enable Google Sign-In.');
  }
  return signInWithPopup(auth, googleProvider);
}

export async function signOutUser() {
  if (!auth) return;
  return signOut(auth);
}

function clampStr(val: unknown, max: number, fallback = ''): string {
  const s = typeof val === 'string' && val.trim().length > 0 ? val.trim() : fallback;
  return s.slice(0, max);
}

function clampStrArray(arr: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => clampStr(item, maxLen))
    .filter((s) => s.length > 0)
    .slice(0, maxItems);
}

function generateValidId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

export async function upsertUserProfile(preferredLanguage: LanguageCode): Promise<void> {
  if (!auth || !db) return;
  const user = auth.currentUser;
  if (!user) return;
  const path = `users/${user.uid}`;
  const displayName = clampStr(user.displayName || user.email || 'Caregiver', 120, 'Caregiver');
  const email = clampStr(user.email || '', 200);
  if (!email) return;

  try {
    const ref = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        displayName,
        email,
        preferredLanguage,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName,
        preferredLanguage,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getUserPreferredLanguage(uid: string): Promise<LanguageCode | null> {
  if (!db) return null;
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const lang = snap.data()?.preferredLanguage;
    if (lang === 'en' || lang === 'hi' || lang === 'ta' || lang === 'bn') {
      return lang;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveRecoveryPlan(plan: Omit<RecoveryPlan, 'id'>): Promise<string> {
  if (!auth || !db) throw new Error('Firebase is not configured.');
  const user = auth.currentUser;
  if (!user) throw new Error('User must be signed in to save to Firestore.');
  const planId = generateValidId('plan');
  const path = `recoveryPlans/${planId}`;

  const payload = {
    ownerId: user.uid,
    title: clampStr(plan.title, 160, 'Recovery Plan'),
    hospitalName: clampStr(plan.hospitalName, 160, 'Hospital Discharge Summary'),
    dischargeDate: clampStr(plan.dischargeDate, 40, new Date().toISOString().slice(0, 10)),
    patientContext: clampStr(plan.patientContext, 300, 'Post-discharge home recovery'),
    language: plan.language,
    plainSummary: clampStr(plan.plainSummary, 4000, 'Follow your discharge instructions carefully.'),
    dietPlan: {
      allowed: clampStrArray(plan.dietPlan?.allowed, 15, 220),
      avoid: clampStrArray(plan.dietPlan?.avoid, 15, 220),
      hydrationGoal: clampStr(plan.dietPlan?.hydrationGoal, 300, 'Stay adequately hydrated as advised.'),
    },
    activityRules: clampStrArray(plan.activityRules, 12, 240),
    redFlags: clampStrArray(plan.redFlags, 12, 240),
    followUpAppointments: clampStrArray(plan.followUpAppointments, 10, 200),
    medicines: (Array.isArray(plan.medicines) ? plan.medicines : []).slice(0, 20).map((m) => ({
      name: clampStr(m.name, 120, 'Medicine'),
      dose: clampStr(m.dose, 80, ''),
      slot: m.slot,
      timeLabel: clampStr(m.timeLabel, 100, ''),
      duration: clampStr(m.duration, 80, ''),
      purpose: clampStr(m.purpose, 240, ''),
      foodRule: clampStr(m.foodRule, 160, ''),
    })),
    conflicts: (Array.isArray(plan.conflicts) ? plan.conflicts : []).slice(0, 15).map((c) => ({
      pair: clampStr(c.pair, 160, ''),
      severity: c.severity,
      explanation: clampStr(c.explanation, 500, ''),
      recommendation: clampStr(c.recommendation, 500, ''),
    })),
    clinicianNote: clampStr(plan.clinicianNote, 3000, ''),
    status: 'active' as const,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'recoveryPlans', planId), payload);
    return planId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateRecoveryPlanTranslation(
  planId: string,
  translated: RecoveryPlan,
): Promise<void> {
  if (!db) return;
  const path = `recoveryPlans/${planId}`;
  try {
    await updateDoc(doc(db, 'recoveryPlans', planId), {
      title: clampStr(translated.title, 160, 'Recovery Plan'),
      language: translated.language,
      plainSummary: clampStr(translated.plainSummary, 4000, 'Follow discharge guidance.'),
      dietPlan: {
        allowed: clampStrArray(translated.dietPlan?.allowed, 15, 220),
        avoid: clampStrArray(translated.dietPlan?.avoid, 15, 220),
        hydrationGoal: clampStr(translated.dietPlan?.hydrationGoal, 300, ''),
      },
      activityRules: clampStrArray(translated.activityRules, 12, 240),
      redFlags: clampStrArray(translated.redFlags, 12, 240),
      followUpAppointments: clampStrArray(translated.followUpAppointments, 10, 200),
      medicines: (Array.isArray(translated.medicines) ? translated.medicines : []).slice(0, 20).map((m) => ({
        name: clampStr(m.name, 120, 'Medicine'),
        dose: clampStr(m.dose, 80, ''),
        slot: m.slot,
        timeLabel: clampStr(m.timeLabel, 100, ''),
        duration: clampStr(m.duration, 80, ''),
        purpose: clampStr(m.purpose, 240, ''),
        foodRule: clampStr(m.foodRule, 160, ''),
      })),
      conflicts: (Array.isArray(translated.conflicts) ? translated.conflicts : []).slice(0, 15).map((c) => ({
        pair: clampStr(c.pair, 160, ''),
        severity: c.severity,
        explanation: clampStr(c.explanation, 500, ''),
        recommendation: clampStr(c.recommendation, 500, ''),
      })),
      clinicianNote: clampStr(translated.clinicianNote, 3000, ''),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveFollowUpReport(
  planId: string,
  report: Omit<FollowUpReport, 'id' | 'planId' | 'ownerId'>,
): Promise<string> {
  if (!auth || !db) throw new Error('Firebase is not configured.');
  const user = auth.currentUser;
  if (!user) throw new Error('User must be signed in to save follow-up reports.');
  const followUpId = generateValidId('fup');
  const path = `recoveryPlans/${planId}/followUps/${followUpId}`;

  const safeType =
    report.reportType === 'opd_note' ||
    report.reportType === 'lab_report' ||
    report.reportType === 'prescription_update' ||
    report.reportType === 'other'
      ? report.reportType
      : 'opd_note';

  try {
    await setDoc(doc(db, 'recoveryPlans', planId, 'followUps', followUpId), {
      planId,
      ownerId: user.uid,
      reportDate: clampStr(report.reportDate, 40, new Date().toISOString().slice(0, 10)),
      doctorOrClinic: clampStr(report.doctorOrClinic, 160, 'Follow-Up Clinic'),
      reportType: safeType,
      language: report.language,
      summary: clampStr(report.summary, 2500, 'Follow-up report added.'),
      changes: clampStrArray(report.changes, 15, 300),
      clinicianSummary: clampStr(report.clinicianSummary, 2500, ''),
      createdAt: serverTimestamp(),
    });
    return followUpId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveDailyCheckIn(
  planId: string,
  checkIn: Omit<DailyCheckIn, 'id' | 'planId' | 'ownerId'>,
): Promise<string> {
  if (!auth || !db) throw new Error('Firebase is not configured.');
  const user = auth.currentUser;
  if (!user) throw new Error('User must be signed in to save check-ins.');
  const checkInId = generateValidId('chk');
  const path = `recoveryPlans/${planId}/checkIns/${checkInId}`;

  try {
    await setDoc(doc(db, 'recoveryPlans', planId, 'checkIns', checkInId), {
      planId,
      ownerId: user.uid,
      checkInDate: clampStr(checkIn.checkInDate, 32, new Date().toISOString().slice(0, 10)),
      inputMode: checkIn.inputMode,
      language: checkIn.language,
      symptomNote: clampStr(checkIn.symptomNote, 2000, 'Check-in logged'),
      medicinesTaken: clampStrArray(checkIn.medicinesTaken, 20, 120),
      severity: checkIn.severity,
      guidance: clampStr(checkIn.guidance, 3000, 'Continue monitoring.'),
      matchedRedFlags: clampStrArray(checkIn.matchedRedFlags, 10, 240),
      clinicianAlertSummary: clampStr(checkIn.clinicianAlertSummary, 3000, ''),
      createdAt: serverTimestamp(),
    });
    return checkInId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleDoseLog(
  planId: string,
  dateKey: string,
  slotKey: string,
  taken: boolean,
): Promise<void> {
  if (!auth || !db) return;
  const user = auth.currentUser;
  if (!user) return;
  const cleanSlot = slotKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  const logId = `${dateKey}_${cleanSlot}`.slice(0, 128);
  const path = `recoveryPlans/${planId}/doseLogs/${logId}`;

  try {
    await setDoc(doc(db, 'recoveryPlans', planId, 'doseLogs', logId), {
      planId,
      ownerId: user.uid,
      dateKey: clampStr(dateKey, 20),
      slotKey: clampStr(slotKey, 160),
      taken,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserPlans(
  uid: string,
  onData: (plans: RecoveryPlan[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, 'recoveryPlans'),
    where('ownerId', '==', uid),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const plans: RecoveryPlan[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<RecoveryPlan, 'id'>),
      }));
      onData(plans);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'recoveryPlans');
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

export function subscribePlanCheckIns(
  planId: string,
  uid: string,
  onData: (items: DailyCheckIn[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  if (!db) return () => {};
  const path = `recoveryPlans/${planId}/checkIns`;
  const q = query(
    collection(db, 'recoveryPlans', planId, 'checkIns'),
    where('ownerId', '==', uid),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: DailyCheckIn[] = snap.docs.map((d) => {
        const data = d.data() as Omit<DailyCheckIn, 'id'>;
        return {
          id: d.id,
          ...data,
          createdAtLabel: data.checkInDate,
        };
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

export function subscribeDoseLogs(
  planId: string,
  uid: string,
  dateKey: string,
  onData: (takenMap: Record<string, boolean>) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  if (!db) return () => {};
  const path = `recoveryPlans/${planId}/doseLogs`;
  const q = query(
    collection(db, 'recoveryPlans', planId, 'doseLogs'),
    where('ownerId', '==', uid),
    where('dateKey', '==', dateKey),
  );
  return onSnapshot(
    q,
    (snap) => {
      const map: Record<string, boolean> = {};
      snap.docs.forEach((d) => {
        const data = d.data() as { slotKey?: string; taken?: boolean };
        if (data.slotKey) map[data.slotKey] = Boolean(data.taken);
      });
      onData(map);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

export function subscribePlanFollowUps(
  planId: string,
  uid: string,
  onData: (items: FollowUpReport[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  if (!db) return () => {};
  const path = `recoveryPlans/${planId}/followUps`;
  const q = query(
    collection(db, 'recoveryPlans', planId, 'followUps'),
    where('ownerId', '==', uid),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: FollowUpReport[] = snap.docs.map((d) => {
        const data = d.data() as Omit<FollowUpReport, 'id'>;
        return {
          id: d.id,
          ...data,
          createdAtLabel: data.reportDate,
        };
      });
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}
