import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import {
  signUpWithEmail,
  signInWithEmail,
  signOut as firebaseSignOut,
  sendPasswordReset,
  resendVerificationEmail,
  refreshUser,
  getCurrentUser,
  isEmailVerified,
  onAuthStateChanged,
  type AuthUser,
} from './firebase-auth';
import { upsertUserDocument, getUserDocument, storeUserName } from './firebase-firestore';
import { getFirebaseIdToken, refreshFirebaseIdToken } from './firebase';
import { metrics } from './metrics';
import type {
  User,
  Member,
  Halau,
  HalauMembership,
  Event,
  Attendance,
  RSVP,
  Payment,
  Show,
  ShowParticipation,
  Video,
  Waiver,
  WaiverSignature,
  ChatChannel,
  ChatMessage,
  MessagePoll,
  MessageReaction,
  Notification,
  UserRole,
  MemberStatus,
  PaymentStatus,
  RSVPStatus,
  OrganizationDues,
  MemberDue,
  OverdueExpense,
  FinancialTransaction,
  PendingPaymentSubmission,
  DuesCategory,
  FinancialStatus,
  PaymentMethod,
  CustomClassLevel,
  RecurringFrequency,
  HalauTitleSettings,
} from './types';

// Generate unique IDs
const generateId = () => Crypto.randomUUID();

// ─── Shared timeout constant ──────────────────────────────────────────────────
// Single source of truth for all AbortController timeouts across the store.
// 20 seconds matches the backend's upstream LLM timeout budget.
const GLOBAL_TIMEOUT_MS = 20_000;

// ─── Type guards & schema enforcement ────────────────────────────────────────

/**
 * Strict member schema validator used when loading docs from Firestore.
 * ALL fields including userId must be non-empty strings. No exceptions.
 *
 * userId conventions:
 *   Firebase UID          → registered users (createHalau / joinHalauByCode)
 *   "invite:<email>"      → teacher-added pre-registration stubs (no Firebase account yet)
 *   "keiki:<uuid>"        → child/keiki members who will never have a Firebase account
 *
 * A document with an empty userId is corrupt and is always rejected.
 */
function isMemberDoc(obj: unknown): obj is import('./types').Member {
  if (!obj || typeof obj !== 'object') return false;
  const m = obj as Record<string, unknown>;
  return (
    typeof m.id        === 'string' && m.id.length > 0 &&
    typeof m.userId    === 'string' && m.userId.length > 0 &&
    typeof m.role      === 'string' && m.role.length > 0 &&
    typeof m.halauId   === 'string' && m.halauId.length > 0 &&
    typeof m.status    === 'string' && m.status.length > 0 &&
    typeof m.firstName === 'string' && m.firstName.length > 0 &&
    typeof m.lastName  === 'string' && m.lastName.length > 0
  );
}

/**
 * Validate a member object before any write.
 * Returns null when valid; returns a human-readable error string otherwise.
 * userId must always be non-empty — pre-registration stubs use "invite:<email>",
 * keiki members use "keiki:<id>".
 */
function validateMemberSchema(m: Partial<import('./types').Member>): string | null {
  if (!m.id?.trim())        return 'id is required';
  if (!m.halauId?.trim())   return 'halauId is required';
  if (!m.firstName?.trim()) return 'firstName is required and must be non-empty';
  if (!m.lastName?.trim())  return 'lastName is required and must be non-empty';
  if (!m.role?.trim())      return 'role is required';
  if (!m.status?.trim())    return 'status is required';
  if (!m.userId?.trim())    return 'userId is required — use "invite:<email>" for pre-registration, "keiki:<id>" for children';
  return null;
}

/**
 * Asserts that a member object satisfies the strict schema.
 * Logs the violation with full member data and throws so callers are forced
 * to handle it — prevents silent writes of corrupt data.
 */
function assertMemberSchema(
  m: Partial<import('./types').Member>,
  context: string,
): asserts m is import('./types').Member {
  const err = validateMemberSchema(m);
  if (err) {
    console.error(`[integrity] ${context} SCHEMA VIOLATION: ${err}`, {
      id: m.id, userId: m.userId, halauId: m.halauId,
      firstName: m.firstName, lastName: m.lastName,
      role: m.role, status: m.status, isManual: m.isManual,
    });
    throw new Error(`[integrity] ${context}: ${err}`);
  }
}

/**
 * Find an existing member by (userId, halauId) to prevent duplicates.
 * Used before every member creation. userId is always non-empty now,
 * so this check is unconditional.
 */
function findExistingMember(
  members: import('./types').Member[],
  userId: string,
  halauId: string,
  excludeId?: string,
): import('./types').Member | undefined {
  if (!userId) return undefined;
  return members.find(
    (m) => m.userId === userId && m.halauId === halauId && m.id !== excludeId,
  );
}

// ─── safeField ────────────────────────────────────────────────────────────────
/**
 * Returns `incoming` only if it is a non-empty, non-whitespace-only string.
 * Prevents blank strings, whitespace-only padding, and null/undefined from
 * overwriting a valid existing value.
 */
function safeField(incoming: unknown, fallback: string): string {
  const s = typeof incoming === 'string' ? incoming.trim() : '';
  return s.length > 0 ? s : fallback;
}

// ─── safeMergeMember ─────────────────────────────────────────────────────────
/**
 * THE single source of truth for all member merge operations.
 *
 * Uses a monotonically increasing version counter for deterministic ordering.
 * Timestamps are NOT used for ordering — they are ambiguous under concurrency
 * and unreliable across devices.
 *
 * Decision table (first match wins):
 *   existing === null              → insert path: new record with safe defaults.
 *   incomingVersion > existing + 1000 → CORRUPTED: reject. Prevents a backend
 *                                    bug or attack from permanently freezing merges.
 *   incoming.version < existing.v  → STALE: reject entirely. Return existing.
 *   incoming.version === existing.v → DUPLICATE / no-op: return existing.
 *   incoming.version > existing.v  → ACCEPT: spread incoming over existing.
 *
 * Version semantics:
 *   - 0 = unversioned (legacy or never written by versioned backend code).
 *   - N > 0 = written by a versioned backend endpoint.
 *   - Client code MUST NEVER write the version field.
 *
 * Financial field behaviour (event-sourced system):
 *   The backend event-sourced projection guarantees that paid, billingStatus,
 *   and paymentResponsibility are always correct when version advances. No
 *   special null guards are needed — the backend reducer is the sole authority.
 *   Identity field guards (firstName, lastName, email, role, status) are kept
 *   to defend against accidentally clearing a field with an empty string from
 *   a partial API response.
 *
 * @param incoming  Raw backend doc or already-typed Member.
 * @param existing  Current in-memory Member (null/undefined → insert path).
 */
function safeMergeMember(
  incoming: Record<string, unknown>,
  existing: Member | null | undefined,
): Member {
  // ── 1. Insert path ──────────────────────────────────────────────────────────
  if (!existing) {
    return {
      ...incoming,
      role:      safeField(incoming.role,      'student') as UserRole,
      status:    safeField(incoming.status,    'pending') as MemberStatus,
      firstName: safeField(incoming.firstName, ''),
      lastName:  safeField(incoming.lastName,  ''),
      email:     safeField(incoming.email,     ''),
      version:   typeof incoming.version === 'number' ? incoming.version : 0,
    } as Member;
  }

  // ── 2. Version comparison ────────────────────────────────────────────────────
  const incomingVersion = typeof incoming.version === 'number' ? incoming.version : 0;
  const existingVersion = typeof existing.version === 'number' ? existing.version : 0;

  // Corruption guard: a jump of more than 1000 versions in one payload is a red
  // flag (legitimate backend writes increment by 1). Accepting it would permanently
  // freeze all future merges because subsequent writes (version N+1) would appear stale.
  const MAX_VERSION_JUMP = 1000;
  if (incomingVersion > existingVersion + MAX_VERSION_JUMP) {
    console.error('[store] MERGE VERSION CHECK', {
      id: existing.id,
      incomingVersion,
      existingVersion,
      jump: incomingVersion - existingVersion,
      decision: 'reject-corrupted',
      reason: 'version jump exceeds MAX_VERSION_JUMP',
    });
    return existing;
  }

  if (incomingVersion < existingVersion) {
    console.warn('[store] MERGE VERSION CHECK', {
      id: existing.id,
      incomingVersion,
      existingVersion,
      decision: 'reject-stale',
      incomingRole: incoming.role,
      existingRole: existing.role,
    });
    return existing;
  }

  if (incomingVersion === existingVersion) {
    console.warn('[store] MERGE VERSION CHECK', {
      id: existing.id,
      incomingVersion,
      existingVersion,
      decision: 'reject-duplicate',
    });
    return existing;
  }

  // ── 3. Full merge (incomingVersion > existingVersion) ───────────────────────
  // Backend event-sourced projection is the authority — spread directly.
  // Financial fields (paid, billingStatus, paymentResponsibility) require no
  // special guards: the reducer guarantees they are always correct when version
  // advances. Identity field guards prevent empty strings from clearing names.
  console.warn('[store] MERGE VERSION CHECK', {
    id: existing.id,
    incomingVersion,
    existingVersion,
    decision: 'accept',
    incomingRole: incoming.role,
    existingRole: existing.role,
  });

  return {
    ...existing,
    ...incoming,
    firstName: safeField(incoming.firstName, existing.firstName),
    lastName:  safeField(incoming.lastName,  existing.lastName),
    email:     safeField(incoming.email,     existing.email),
    role:      safeField(incoming.role,      existing.role) as UserRole,
    status:    safeField(incoming.status,    existing.status) as MemberStatus,
    // classLevel guard: don't clobber an assigned level with an empty value
    ...(existing.classLevel && !safeField(incoming.classLevel as unknown, '')
      ? { classLevel: existing.classLevel }
      : {}),
  } as Member;
}

// ─── Atomic session lock ──────────────────────────────────────────────────────
// Prevents two concurrent sign-in flows from racing against each other.
// This can happen if the user taps "Sign In" multiple times rapidly or if the
// auto-refresh token flow and a manual sign-in coincide.
let _sessionLockActive = false;
function acquireSessionLock(): boolean {
  if (_sessionLockActive) return false;
  _sessionLockActive = true;
  return true;
}
function releaseSessionLock(): void {
  _sessionLockActive = false;
}

// ─── Offline write queue ──────────────────────────────────────────────────────
// added to a persistent queue in AsyncStorage. The queue is flushed whenever
// the app comes back online or signIn completes successfully.

const WRITE_QUEUE_KEY = 'halau_write_queue';

interface QueuedWrite {
  id: string;
  userId: string;
  method: 'PUT' | 'DELETE' | 'POST' | 'PATCH';
  path: string;
  body?: Record<string, unknown>;
  enqueuedAt: number;
  retries: number;
}

async function enqueueWrite(method: 'PUT' | 'DELETE' | 'POST' | 'PATCH', path: string, body?: Record<string, unknown>): Promise<void> {
  try {
    const { auth } = await import('./firebase');
    const uid = auth.currentUser?.uid ?? '';
    const raw = await AsyncStorage.getItem(WRITE_QUEUE_KEY);
    const queue: QueuedWrite[] = raw ? (JSON.parse(raw) as QueuedWrite[]) : [];
    queue.push({ id: `${Date.now()}_${Math.random()}`, userId: uid, method, path, body, enqueuedAt: Date.now(), retries: 0 });
    // Cap queue at 100 items to prevent unbounded growth
    const capped = queue.slice(-100);
    await AsyncStorage.setItem(WRITE_QUEUE_KEY, JSON.stringify(capped));
  } catch {
    console.error('[queue] Failed to enqueue write:', path);
  }
}

async function flushWriteQueue(): Promise<void> {
  const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL;
  if (!backendUrl) return;
  try {
    const { auth } = await import('./firebase');
    const currentUid = auth.currentUser?.uid ?? '';

    const raw = await AsyncStorage.getItem(WRITE_QUEUE_KEY);
    if (!raw) return;
    const queue: QueuedWrite[] = JSON.parse(raw) as QueuedWrite[];
    if (queue.length === 0) return;

    // Only flush writes that belong to the currently signed-in user.
    // Writes from a previous session are left in the queue untouched
    // so they can never corrupt another user's data.
    const mine = queue.filter((item) => !item.userId || item.userId === currentUid);
    const others = queue.filter((item) => item.userId && item.userId !== currentUid);

    const QUEUE_MAX_RETRIES = 5;
    if (mine.length === 0) return;
    if (__DEV__) console.log(`[queue] Flushing ${mine.length} queued write(s)`);
    const failed: QueuedWrite[] = [];
    for (const item of mine) {
      // Drop items that have exhausted their retry budget
      if ((item.retries ?? 0) >= QUEUE_MAX_RETRIES) {
        console.error(`[queue] Dropping ${item.method} ${item.path} after ${item.retries} retries`);
        continue;
      }
      try {
        const token = await getFirebaseIdToken();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), GLOBAL_TIMEOUT_MS);
        let res: Response;
        try {
          res = await fetch(`${backendUrl}${item.path}`, {
            method: item.method,
            headers,
            body: item.body ? JSON.stringify(item.body) : undefined,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(tid);
        }
        if (!res.ok) failed.push({ ...item, retries: (item.retries ?? 0) + 1 });
      } catch {
        failed.push({ ...item, retries: (item.retries ?? 0) + 1 });
      }
    }
    if (failed.length > 0 || others.length > 0) {
      await AsyncStorage.setItem(WRITE_QUEUE_KEY, JSON.stringify([...failed, ...others]));
      if (failed.length > 0) console.error(`[queue] ${failed.length} write(s) still pending after flush`);
    } else {
      await AsyncStorage.removeItem(WRITE_QUEUE_KEY);
    }
  } catch {
    console.error('[queue] Flush failed unexpectedly');
  }
}

// ─── Firestore sync helper ────────────────────────────────────────────────────
// Fire-and-forget backend call with automatic retry (exponential backoff).
// Local state always updates first; this runs in the background.
// Failures are logged but never block the UI.
// Retries: up to 3 attempts with 1s, 2s, 4s delays.
// On permanent failure the write is added to the offline queue.
async function syncToBackendWithRetry(
  method: 'PUT' | 'DELETE' | 'POST' | 'PATCH',
  path: string,
  body?: Record<string, unknown>,
  attempt = 0,
): Promise<void> {
  const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL;
  if (!backendUrl) return;
  try {
    const token = await getFirebaseIdToken();
    const headers: Record<string, string> = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GLOBAL_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${backendUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!res.ok && attempt < 3) {
      // On 401, refresh the token and retry once immediately before falling back
      // to exponential backoff — avoids queuing a write with a stale token.
      if (res.status === 401 && attempt === 0) {
        const fresh = await refreshFirebaseIdToken();
        if (fresh) {
          void syncToBackendWithRetry(method, path, body, attempt + 1);
          return;
        }
      }
      // Server-side error (5xx) or other non-ok — schedule a retry with exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      setTimeout(() => { void syncToBackendWithRetry(method, path, body, attempt + 1); }, delay);
    }
  } catch {
    // Network failure or timeout — retry up to 3 times
    if (attempt < 3) {
      const delay = Math.pow(2, attempt) * 1000;
      if (__DEV__) console.warn(`[sync] ${method} ${path} failed (attempt ${attempt + 1}), retrying in ${delay}ms`);
      setTimeout(() => { void syncToBackendWithRetry(method, path, body, attempt + 1); }, delay);
    } else {
      console.error(`[sync] ${method} ${path} permanently failed after 3 retries — queuing for offline flush`);
      void enqueueWrite(method, path, body);
    }
  }
}

function syncToBackend(method: 'PUT' | 'DELETE' | 'POST' | 'PATCH', path: string, body?: Record<string, unknown>): void {
  void syncToBackendWithRetry(method, path, body);
}

/**
 * Like syncToBackend but returns a Promise<boolean> indicating whether the
 * backend acknowledged success on the first attempt.
 * Used for optimistic writes that need rollback on failure.
 */
async function syncToBackendResult(
  method: 'PUT' | 'DELETE' | 'POST' | 'PATCH',
  path: string,
  body?: Record<string, unknown>,
): Promise<boolean> {
  const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL;
  if (!backendUrl) {
    console.warn('[sync] No backend URL configured — write not sent');
    return false;
  }
  try {
    const token = await getFirebaseIdToken();
    const headers: Record<string, string> = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GLOBAL_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${backendUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    if (!res.ok) {
      // On 401, refresh token and retry once before declaring failure.
      if (res.status === 401) {
        const fresh = await refreshFirebaseIdToken();
        if (fresh) {
          headers['Authorization'] = `Bearer ${fresh}`;
          const controller2 = new AbortController();
          const tid2 = setTimeout(() => controller2.abort(), GLOBAL_TIMEOUT_MS);
          let res2: Response;
          try {
            res2 = await fetch(`${backendUrl}${path}`, {
              method,
              headers,
              body: body ? JSON.stringify(body) : undefined,
              signal: controller2.signal,
            });
          } finally {
            clearTimeout(tid2);
          }
          if (res2.ok) return true;
        }
      }
      console.error(`[sync] ${method} ${path} → ${res.status}`);
      // Still enqueue for retry so it eventually persists
      void syncToBackendWithRetry(method, path, body, 1);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[sync] ${method} ${path} failed:`, err);
    void enqueueWrite(method, path, body);
    return false;
  }
}

/**
 * Authenticated GET helper for backend reads.
 * Attaches the Firebase ID token as a Bearer token.
 * Retries up to 3 times on network failures or 5xx responses with
 * exponential backoff (300ms → 800ms → 1500ms).
 * On a 401, silently refreshes the token and retries once before failing.
 */
async function authedGet(url: string, attempt = 0): Promise<Response> {
  const token = await getFirebaseIdToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  let res: Response;
  try {
    res = await fetch(url, { headers, signal: controller.signal });
  } catch (err) {
    clearTimeout(timeoutId);
    // Network failure — retry with backoff (max 3 attempts)
    if (attempt < 3) {
      const delay = ([300, 800, 1500][attempt] ?? 1500) + Math.random() * 300;
      await new Promise((r) => setTimeout(r, delay));
      return authedGet(url, attempt + 1);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
  // 401 — refresh token and retry once
  if (res.status === 401 && attempt === 0) {
    const fresh = await refreshFirebaseIdToken();
    if (fresh) {
      headers['Authorization'] = `Bearer ${fresh}`;
      const controller2 = new AbortController();
      const tid2 = setTimeout(() => controller2.abort(), 10000);
      try {
        return await fetch(url, { headers, signal: controller2.signal });
      } finally {
        clearTimeout(tid2);
      }
    }
  }
  // 5xx — retry with backoff
  if (res.status >= 500 && attempt < 3) {
    const delay = ([300, 800, 1500][attempt] ?? 1500) + Math.random() * 300;
    await new Promise((r) => setTimeout(r, delay));
    return authedGet(url, attempt + 1);
  }
  return res;
}

interface AppState {
  // Auth
  currentUser: User | null;
  firebaseUser: AuthUser | null;
  currentMember: Member | null;
  currentHalauId: string | null;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  // True while a background Firestore re-fetch or account-recovery is in progress.
  // Layout blocks routing to onboarding while this is true to prevent false redirects.
  isHydrating: boolean;
  // True while a post-timeout background Firestore re-fetch is running.
  // Unlike isHydrating, this does NOT block routing — user is already inside the app.
  isBackgroundRefreshing: boolean;
  // Number of recovery attempts made during the current sign-in session.
  // Reset to 0 on successful sign-in or sign-out.
  recoveryAttempts: number;

  // Data collections
  users: User[];
  members: Member[];
  halaus: Halau[];
  halauMemberships: HalauMembership[];
  events: Event[];
  attendances: Attendance[];
  rsvps: RSVP[];
  payments: Payment[];
  shows: Show[];
  showParticipations: ShowParticipation[];
  videos: Video[];
  waivers: Waiver[];
  waiverSignatures: WaiverSignature[];
  chatChannels: ChatChannel[];
  chatMessages: ChatMessage[];
  notifications: Notification[];

  // Financial Management
  organizationDues: OrganizationDues[];
  memberDues: MemberDue[];
  overdueExpenses: OverdueExpense[];
  financialTransactions: FinancialTransaction[];
  pendingPaymentSubmissions: PendingPaymentSubmission[];

  // Theme
  isDarkMode: boolean;
  toggleDarkMode: () => void;

  // Trial
  trialStartDate: string | null;
  hasSeenTrialReminder: boolean;
  hasAcknowledgedTrial: boolean;
  startTrial: () => void;
  getTrialDaysRemaining: () => number;
  isTrialActive: () => boolean;
  isTrialExpired: () => boolean;
  shouldShowTrialReminder: () => boolean;
  markTrialReminderSeen: () => void;
  acknowledgeTrialStart: () => void;

  // Intro/Onboarding
  hasSeenIntro: boolean;
  markIntroSeen: () => void;
  resetIntro: () => void;

  // Welcome popup (shown once after first login, persisted across sessions)
  hasSeenWelcomePopup: boolean;
  markWelcomePopupSeen: () => void;

  // Guide seen flags
  seenGuides: string[];
  markGuideSeen: (guideId: string) => void;
  hasSeenGuide: (guideId: string) => boolean;

  // Auth actions
  signUp: (email: string, password: string, firstName: string, lastName: string, phone: string) => Promise<{ success: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => void;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  verifyEmail: (userId: string) => void;
  // Called from the /recovering screen to retry school recovery after both signIn attempts failed.
  retryAccountRecovery: () => Promise<{ schoolId: string | null; confirmed: boolean }>;

  // Halau actions
  createHalau: (name: string, description?: string) => Halau;
  joinHalauByCode: (code: string, role?: 'student' | 'guardian') => Promise<{ success: boolean; error?: string }>;
  requestToJoinHalau: (halauId: string) => Promise<{ success: boolean; error?: string }>;
  approveHalauMember: (membershipId: string) => void;
  denyHalauMember: (membershipId: string) => void;
  updateHalauBranding: (halauId: string, updates: Partial<Pick<Halau, 'logo' | 'primaryColor' | 'secondaryColor' | 'backgroundPattern' | 'themeId'>>) => void;
  updateHalauName: (halauId: string, name: string) => Promise<{ success: boolean; error?: string }>;
  setCurrentHalau: (halauId: string) => void;
  getHalau: (halauId: string) => Halau | undefined;
  // Custom class levels
  addCustomClassLevel: (halauId: string, label: string, description?: string) => CustomClassLevel;
  updateCustomClassLevel: (halauId: string, levelId: string, updates: Partial<Pick<CustomClassLevel, 'label' | 'description' | 'order'>>) => void;
  deleteCustomClassLevel: (halauId: string, levelId: string) => void;
  getClassLevelsForHalau: (halauId: string) => CustomClassLevel[];
  // Title settings
  updateTitleSettings: (halauId: string, settings: Partial<HalauTitleSettings>) => void;
  getTitleSettings: (halauId: string) => HalauTitleSettings;

  // Member actions
  addMember: (member: Omit<Member, 'id' | 'joinedAt'>) => Member;
  updateMember: (id: string, updates: Partial<Member>) => void;
  approveMember: (id: string) => void;
  denyMember: (id: string) => void;
  removeMember: (id: string) => void;
  getMembersByHalau: (halauId: string) => Member[];
  getPendingMembers: (halauId: string) => Member[];
  getMember: (id: string) => Member | undefined;
  getMemberByUserId: (userId: string, halauId: string) => Member | undefined;
  // Keiki-related functions
  addKeikiMember: (keiki: { firstName: string; lastName: string; halauId: string }) => Member;
  getKeikiByGuardian: (memberId: string) => Member[];
  canRemoveKeiki: (keikiId: string) => boolean;

  // Event actions
  createEvent: (event: Omit<Event, 'id' | 'createdAt' | 'createdBy'>) => Event;
  createRecurringEvents: (event: Omit<Event, 'id' | 'createdAt' | 'createdBy'>, pattern: 'daily' | 'weekly' | 'biweekly' | 'monthly', endDate: string) => Event[];
  updateEvent: (id: string, updates: Partial<Event>) => void;
  deleteEvent: (id: string) => void;
  deleteRecurringSeries: (recurringGroupId: string, fromDate?: string) => void;
  updateRecurringSeries: (recurringGroupId: string, updates: Partial<Event>, fromDate?: string) => void;
  cancelEvent: (id: string) => void;
  getEventsByHalau: (halauId: string) => Event[];
  getUpcomingEvents: (halauId: string) => Event[];
  getEvent: (id: string) => Event | undefined;

  // Attendance actions
  markAttendance: (eventId: string, memberId: string, status: Attendance['status']) => void;
  getAttendanceByEvent: (eventId: string) => Attendance[];
  getAttendanceByMember: (memberId: string) => Attendance[];

  // RSVP actions
  updateRSVP: (eventId: string, status: RSVPStatus) => void;
  getRSVPsByEvent: (eventId: string) => RSVP[];
  getMemberRSVP: (eventId: string, memberId: string) => RSVP | undefined;

  // Payment actions
  recordPayment: (payment: Omit<Payment, 'id' | 'recordedAt' | 'recordedBy'>) => Payment;
  updatePayment: (id: string, updates: Partial<Payment>) => void;
  getPaymentsByHalau: (halauId: string) => Payment[];
  getPaymentsByMember: (memberId: string) => Payment[];
  getPendingPayments: (halauId: string) => Payment[];
  getPaymentStats: (halauId: string) => { totalPaid: number; totalPending: number; totalOverdue: number };

  // Show actions
  createShow: (show: Omit<Show, 'id' | 'createdAt' | 'createdBy'>) => Show;
  updateShow: (id: string, updates: Partial<Show>) => void;
  deleteShow: (id: string) => void;
  getShowsByHalau: (halauId: string) => Show[];
  addShowParticipant: (showId: string, memberId: string, role?: string) => void;
  removeShowParticipant: (showId: string, memberId: string) => void;
  getShowParticipants: (showId: string) => ShowParticipation[];

  // Video actions
  addVideo: (video: Omit<Video, 'id' | 'uploadedAt' | 'uploadedBy'>) => Promise<Video>;
  updateVideo: (id: string, updates: Partial<Video>) => void;
  deleteVideo: (id: string) => Promise<void>;
  getVideosByHalau: (halauId: string) => Video[];
  getVideosByCategory: (halauId: string, category: Video['category']) => Video[];

  // Waiver actions
  createWaiver: (waiver: Omit<Waiver, 'id' | 'createdAt' | 'createdBy'>) => Waiver;
  signWaiver: (waiverId: string, signatureData: string) => void;
  getWaiversByHalau: (halauId: string) => Waiver[];
  getMemberWaiverStatus: (memberId: string) => WaiverSignature[];
  getWaiverSignatures: (waiverId: string) => WaiverSignature[];

  // Chat actions
  createChannel: (channel: Omit<ChatChannel, 'id' | 'createdAt' | 'createdBy'>) => ChatChannel;
  updateChannel: (channelId: string, updates: Partial<Pick<ChatChannel, 'name' | 'memberIds' | 'pinnedMessageIds'>>) => void;
  deleteChannel: (channelId: string) => void;
  sendMessage: (channelId: string, text: string, attachment?: { type: 'image' | 'file'; uri: string; name?: string }, mentions?: string[], poll?: MessagePoll, isPrivate?: boolean, privateRecipients?: string[], replyToMessageId?: string) => ChatMessage;
  deleteMessage: (messageId: string) => void;
  updateMessage: (messageId: string, updates: Partial<Pick<ChatMessage, 'text' | 'poll'>>) => void;
  // Merge messages from Firestore snapshot without duplication
  mergeChatMessages: (incoming: ChatMessage[]) => void;
  markMessageRead: (messageId: string) => void;
  addReaction: (messageId: string, emoji: string) => void;
  removeReaction: (messageId: string, emoji: string) => void;
  votePoll: (messageId: string, optionId: string) => void;
  pinMessage: (channelId: string, messageId: string) => void;
  unpinMessage: (channelId: string, messageId: string) => void;
  getChannelsByHalau: (halauId: string) => ChatChannel[];
  getChannelMessages: (channelId: string) => ChatMessage[];
  getUnreadCount: (channelId: string) => number;

  // Notification actions
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  getUnreadNotifications: () => Notification[];
  clearNotifications: () => void;

  // Financial Management actions
  // Organization Dues (teacher/admin only)
  createOrganizationDues: (dues: Omit<OrganizationDues, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => OrganizationDues;
  updateOrganizationDues: (id: string, updates: Partial<OrganizationDues>) => void;
  deleteOrganizationDues: (id: string) => void;
  getOrganizationDuesByHalau: (halauId: string) => OrganizationDues[];

  // Member Dues
  createMemberDue: (due: Omit<MemberDue, 'id' | 'createdAt' | 'createdBy'>) => MemberDue;
  updateMemberDue: (id: string, updates: Partial<MemberDue>) => void;
  deleteMemberDue: (id: string) => void;
  recordDuesPayment: (memberDueId: string, amount: number, method: PaymentMethod, notes?: string, invoiceNumber?: string) => void;
  getMemberDuesByHalau: (halauId: string) => MemberDue[];
  getMemberDuesByMember: (memberId: string) => MemberDue[];
  getOverdueMemberDues: (halauId: string) => MemberDue[];
  assignDuesToMembers: (duesId: string, memberIds: string[], dueDate: string, recurringOptions?: { isRecurring: boolean; frequency: RecurringFrequency; endDate?: string }) => void;

  // Overdue Expenses (money owed to members)
  createOverdueExpense: (expense: Omit<OverdueExpense, 'id' | 'requestedAt' | 'requestedBy'>) => OverdueExpense;
  approveOverdueExpense: (id: string) => void;
  denyOverdueExpense: (id: string, notes?: string) => void;
  releaseOverdueExpense: (id: string, method: PaymentMethod) => void;
  getOverdueExpensesByHalau: (halauId: string) => OverdueExpense[];
  getOverdueExpensesByMember: (memberId: string) => OverdueExpense[];
  getPendingApprovalExpenses: (halauId: string) => OverdueExpense[];

  // Financial Transactions
  getTransactionsByHalau: (halauId: string) => FinancialTransaction[];
  getTransactionsByMember: (memberId: string) => FinancialTransaction[];

  // Pending Payment Submissions (student submits, admin confirms)
  submitPaymentForConfirmation: (memberDueId: string, amount: number, method: PaymentMethod, notes?: string, invoiceNumber?: string) => PendingPaymentSubmission;
  confirmPaymentSubmission: (submissionId: string, overrides?: { amount?: number; method?: PaymentMethod; notes?: string; invoiceNumber?: string }) => void;
  rejectPaymentSubmission: (submissionId: string, reason?: string) => void;
  getPendingPaymentSubmissions: (halauId: string) => PendingPaymentSubmission[];
  getPendingPaymentSubmissionsByMember: (memberId: string) => PendingPaymentSubmission[];

  // Financial Summary
  getFinancialSummary: (halauId: string) => {
    totalCollected: number;
    totalPending: number;
    totalOverdue: number;
    totalOwedToMembers: number;
  };

  // Role check helpers
  isKumu: () => boolean;
  getCurrentRole: () => UserRole | null;
  isHalauOwner: (memberId?: string) => boolean;
  getHalauOwnerMember: (halauId: string) => Member | undefined;
  // Firebase auth helpers
  setFirebaseUser: (user: AuthUser | null) => void;
  refreshEmailVerification: () => Promise<boolean>;
  resendVerification: () => Promise<{ success: boolean; error?: string }>;
  // Refresh all school data from backend (members, events, payments, etc.)
  refreshSchoolData: () => Promise<void>;
  // Subscription sync — called after a successful RevenueCat purchase
  setCurrentMemberSubscription: (subscription: { active: boolean; plan: 'owner_monthly' | 'admin_monthly' | null; price: number; renewalDate: string | null }) => void;
  // Dev/Testing helpers
  clearAllData: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentUser: null,
      firebaseUser: null,
      currentMember: null,
      currentHalauId: null,
      isAuthenticated: false,
      isEmailVerified: false,
      isHydrating: false,
      isBackgroundRefreshing: false,
      recoveryAttempts: 0,
      users: [],
      members: [],
      halaus: [],
      halauMemberships: [],
      events: [],
      attendances: [],
      rsvps: [],
      payments: [],
      shows: [],
      showParticipations: [],
      videos: [],
      waivers: [],
      waiverSignatures: [],
      chatChannels: [],
      chatMessages: [],
      notifications: [],
      isDarkMode: false,

      // Financial Management - initial state
      organizationDues: [],
      memberDues: [],
      overdueExpenses: [],
      financialTransactions: [],
      pendingPaymentSubmissions: [],

      // Trial state
      trialStartDate: null,
      hasSeenTrialReminder: false,
      hasAcknowledgedTrial: false,
      hasSeenIntro: false,
      hasSeenWelcomePopup: false,
      seenGuides: [],

      toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),

      // Intro actions
      markIntroSeen: () => set({ hasSeenIntro: true }),
      resetIntro: () => set({ hasSeenIntro: false }),
      markWelcomePopupSeen: () => set({ hasSeenWelcomePopup: true }),

      // Guide seen actions
      markGuideSeen: (guideId: string) =>
        set((state) => ({
          seenGuides: state.seenGuides.includes(guideId)
            ? state.seenGuides
            : [...state.seenGuides, guideId],
        })),
      hasSeenGuide: (guideId: string) => get().seenGuides.includes(guideId),

      // Trial actions — 14-day trial for teachers/owners
      // trialStartDate is set by the backend (on school creation) and read on sign-in.
      // The client NEVER mutates trialStartDate directly.
      startTrial: () => {
        // No-op: the backend sets trialStartDate when the school is initialised via /init.
        // Keeping this method so call sites don't break during the transition.
      },

      getTrialDaysRemaining: () => {
        const { trialStartDate } = get();
        if (!trialStartDate) return 14; // Full trial if not started
        const start = new Date(trialStartDate);
        const now = new Date();
        const diffTime = now.getTime() - start.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return Math.max(0, 14 - diffDays);
      },

      isTrialActive: () => {
        const { trialStartDate } = get();
        if (!trialStartDate) return false;
        const daysRemaining = get().getTrialDaysRemaining();
        return daysRemaining > 0;
      },

      isTrialExpired: () => {
        const { trialStartDate } = get();
        if (!trialStartDate) return false;
        return get().getTrialDaysRemaining() <= 0;
      },

      shouldShowTrialReminder: () => {
        const { trialStartDate, hasSeenTrialReminder } = get();
        if (!trialStartDate || hasSeenTrialReminder) return false;
        const daysRemaining = get().getTrialDaysRemaining();
        // Show reminder on day 6 (1 day remaining)
        return daysRemaining === 1;
      },

      markTrialReminderSeen: () => {
        set({ hasSeenTrialReminder: true });
      },

      acknowledgeTrialStart: () => {
        set({ hasAcknowledgedTrial: true });
      },

      // Auth actions - now using Firebase
      signUp: async (email, password, firstName, lastName, phone) => {
        // Sign up with Firebase
        const result = await signUpWithEmail(email, password);

        if (!result.success || !result.user) {
          return { success: false, error: result.error };
        }

        // Create local user profile linked to Firebase UID
        const user: User = {
          id: result.user.uid,
          email: email.toLowerCase(),
          firstName,
          lastName,
          phone: phone || undefined,
          passwordHash: '', // Not used with Firebase
          createdAt: new Date().toISOString(),
          emailVerified: false, // Will be verified via email
        };

        set((state) => ({
          users: [...state.users, user],
          currentUser: user,
          firebaseUser: result.user ?? null,
          isAuthenticated: true,
          isEmailVerified: false,
        }));

        // Immediately store the user's name in Firestore so it can be recovered
        // on other devices (e.g., fresh install before onboarding is completed).
        if (firstName.trim() || lastName.trim()) {
          storeUserName(firstName.trim(), lastName.trim()).catch(
            (err: unknown) => { console.warn('[store] signUp storeUserName failed:', err); }
          );
        }

        return { success: true };
      },

      signIn: async (email, password) => {
        // Prevent concurrent sign-in flows from corrupting shared state
        if (!acquireSessionLock()) {
          console.warn('[store] signIn blocked — another session is in progress');
          // Return a specific code (not a user-visible string) so UI can silently no-op.
          return { success: false, error: 'ALREADY_IN_PROGRESS' };
        }
        metrics.start('signIn');
        try {
        // Sign in with Firebase
        const result = await signInWithEmail(email, password);

        if (!result.success || !result.user) {
          return { success: false, error: result.error };
        }

        const { users, members, halauMemberships } = get();

        // Find or create local user profile
        let user = users.find((u) => u.id === result.user!.uid);

        if (!user) {
          // User exists in Firebase but not locally — fetch name from Firestore first
          // so firstName/lastName are populated and the dashboard doesn't show "Guest"
          let firstName = '';
          let lastName  = '';
          try {
            const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL;
            if (backendUrl) {
              const r = await authedGet(`${backendUrl}/api/user/me?uid=${encodeURIComponent(result.user.uid)}`);
              if (r.ok) {
                const j = await r.json() as { data: { name?: string; firstName?: string; lastName?: string } | null };
                // Prefer separately stored firstName/lastName fields (set during signUp or storeUserName)
                // Fall back to splitting the combined name field for legacy data
                firstName = j.data?.firstName ?? '';
                lastName  = j.data?.lastName ?? '';
                if (!firstName && !lastName) {
                  const fullName = j.data?.name ?? '';
                  const parts = fullName.trim().split(' ');
                  firstName = parts[0] ?? '';
                  lastName  = parts.slice(1).join(' ');
                }
              }
            }
          } catch (err) { console.error("[store] Failed to fetch user name from backend:", err); }

          user = {
            id: result.user.uid,
            email: email.toLowerCase(),
            firstName,
            lastName,
            passwordHash: '',
            createdAt: new Date().toISOString(),
            emailVerified: result.user.emailVerified,
          };
          set((state) => ({
            users: [...state.users, user!],
          }));
        }

        // Find the user's halau membership and member record.
        // Sort by joinedAt descending first so `.find()` always picks the most recent
        // membership — consistent with the backend pickBestMember sort (BUG-M02).
        const sortedMemberships = [...halauMemberships].sort((a, b) => {
          const aDate = (a as { joinedAt?: string; createdAt?: string }).joinedAt ?? (a as { joinedAt?: string; createdAt?: string }).createdAt ?? '';
          const bDate = (b as { joinedAt?: string; createdAt?: string }).joinedAt ?? (b as { joinedAt?: string; createdAt?: string }).createdAt ?? '';
          return bDate.localeCompare(aDate);
        });
        const membership = sortedMemberships.find((m) => m.userId === user!.id && m.status === 'approved');
        const member = membership ? members.find((m) => m.userId === user!.id && m.halauId === membership.halauId) : null;

        // Always fetch Firestore user doc on sign-in to get latest subscription/role state
        let resolvedHalauId: string | null = membership?.halauId || null;
        let firestoreUserDoc: Awaited<ReturnType<typeof getUserDocument>> = null;

        let fetchTimedOut = false;
        let recoveryConfirmedNoMembership = false;
        try {
          const timeout = new Promise<null>((resolve) => setTimeout(() => { fetchTimedOut = true; resolve(null); }, 5000));
          firestoreUserDoc = await Promise.race([getUserDocument(), timeout]);
          if (fetchTimedOut && firestoreUserDoc === null) {
            // Genuine timeout (doc may exist but Firestore was slow) — schedule a background re-fetch
            console.error('[store] Firestore user doc timed out after 5s — using stale local state');
            const backendUrl2 = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL;
            if (backendUrl2) {
              // Background re-fetch: runs after the sign-in flow completes so the UI isn't blocked.
              // Uses isBackgroundRefreshing (not isHydrating) so it never disrupts routing for a
              // user already inside the app (BUG-06).
              setTimeout(async () => {
                try {
                  // Abort if the user signed out while we were waiting
                  if (!get().isAuthenticated) return;
                  set({ isBackgroundRefreshing: true });
                  const freshDoc = await getUserDocument();
                  if (!freshDoc) { set({ isBackgroundRefreshing: false }); return; }
                  // BUG-03 fix: use !== instead of !currentHalauId so a wrong provisional schoolId
                  // (e.g. uid assigned by P6) is correctly overwritten with the real one.
                  if (freshDoc.schoolId && freshDoc.schoolId !== get().currentHalauId) {
                    set({ currentHalauId: freshDoc.schoolId });
                  }
                  const { currentMember, currentHalauId: halauIdNow } = get();
                  if (!currentMember || !halauIdNow) { set({ isBackgroundRefreshing: false }); return; }
                  // Patch subscription and role from the fresh doc
                  const freshRole2 = freshDoc.role as string | undefined;
                  const patchedRole = freshRole2
                    ? ((freshRole2 === 'owner' ? 'teacher' : freshRole2) as import('./types').UserRole)
                    : currentMember.role;
                  set((state) => ({
                    currentMember: state.currentMember
                      ? {
                          ...state.currentMember,
                          role: patchedRole,
                          subscription: freshDoc.subscription
                            ? { active: freshDoc.subscription.active ?? false, plan: freshDoc.subscription.plan ?? null, price: freshDoc.subscription.price ?? 0, renewalDate: null }
                            : state.currentMember.subscription,
                          trialActive: freshDoc.trialActive ?? state.currentMember.trialActive,
                        }
                      : null,
                    members: state.members.map((m) =>
                      m.userId === state.currentMember?.userId && m.halauId === halauIdNow
                        ? { ...m, role: patchedRole }
                        : m
                    ),
                    trialStartDate: freshDoc.trialStartDate
                      ? (state.trialStartDate && state.trialStartDate < freshDoc.trialStartDate
                          ? state.trialStartDate
                          : freshDoc.trialStartDate)
                      : state.trialStartDate,
                  }));
                  if (__DEV__) console.log('[store] Background user doc re-fetch succeeded');
                  set({ isBackgroundRefreshing: false });
                } catch (bgErr) {
                  console.error('[store] Background user doc re-fetch failed:', bgErr);
                  set({ isBackgroundRefreshing: false });
                }
              }, 3000);
            }
          }
          if (!resolvedHalauId && firestoreUserDoc?.schoolId) {
            resolvedHalauId = firestoreUserDoc.schoolId;
          }

          // RECOVERY MODE: schoolId is unresolved.
          // Fires when:
          //   (a) user doc EXISTS but schoolId is missing (client-side write failed silently), OR
          //   (b) Firestore TIMED OUT and we have no cached schoolId (BUG-07: timeout ≠ success)
          // Rules:
          //   - Set isHydrating:true BEFORE the first attempt (blocks routing to onboarding)
          //   - Each attempt gets its own AbortController with a 5s timeout (BUG-04: no orphans)
          //   - Retry ONCE on failure
          //   - Only clear isHydrating when CONFIRMED (schoolId found OR backend says no membership)
          //   - Leave isHydrating:true if BOTH attempts fail → /recovering screen handles UI
          if (!resolvedHalauId && (firestoreUserDoc !== null || fetchTimedOut)) {
            const backendUrlFallback = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL;
            if (backendUrlFallback) {
              set((s) => ({ isHydrating: true, recoveryAttempts: s.recoveryAttempts + 1 }));

              // Each call creates its own AbortController so previous requests are never orphaned.
              const attemptRecovery = async (): Promise<{ schoolId: string | null; confirmed: boolean }> => {
                const ctrl = new AbortController();
                const timer = setTimeout(() => ctrl.abort(), 5000);
                try {
                  const tok = await getFirebaseIdToken();
                  const hdrs: Record<string, string> = {};
                  if (tok) hdrs['Authorization'] = `Bearer ${tok}`;
                  const res = await fetch(`${backendUrlFallback}/api/user/my-school`, { headers: hdrs, signal: ctrl.signal });
                  clearTimeout(timer);
                  if (!res.ok) throw new Error(`/my-school ${res.status}`);
                  const json = await res.json() as { data: { schoolId?: string; role?: string } | null };
                  return { schoolId: json.data?.schoolId ?? null, confirmed: true };
                } catch {
                  clearTimeout(timer);
                  return { schoolId: null, confirmed: false };
                }
              };

              let recoveryResult = await attemptRecovery();
              if (!recoveryResult.confirmed) {
                recoveryResult = await attemptRecovery(); // retry once
              }

              if (recoveryResult.confirmed) {
                set({ isHydrating: false });
                if (recoveryResult.schoolId) {
                  resolvedHalauId = recoveryResult.schoolId;
                  if (firestoreUserDoc !== null) {
                    firestoreUserDoc = { ...firestoreUserDoc, schoolId: recoveryResult.schoolId };
                  }
                } else {
                  recoveryConfirmedNoMembership = true;
                }
              }
              // If !confirmed after retry: isHydrating stays true → _layout.tsx → /recovering
            }
          }
        } catch (err) {
          console.error('[store] Failed to fetch Firestore user doc:', err);
        }

        // P6: Owner pending screen fix.
        // ONLY apply when Firestore TIMED OUT and recovery did NOT confirm "no membership".
        // If recovery confirmed no membership, this is truly a new user → onboarding.
        // If recovery found a schoolId, resolvedHalauId is already set and this is skipped.
        if (
          fetchTimedOut &&
          firestoreUserDoc === null &&
          !recoveryConfirmedNoMembership &&
          !member &&
          !get().currentMember &&
          !resolvedHalauId
        ) {
          const provisionalHalauId = user!.id; // owners' schoolId === uid
          resolvedHalauId = provisionalHalauId;
          const provisionalMember: import('./types').Member = {
            id: user!.id,
            userId: user!.id,
            halauId: provisionalHalauId,
            firstName: user!.firstName || '',
            lastName: user!.lastName || '',
            email: user!.email,
            phone: '',
            role: 'student',  // Safe default — background re-fetch will correct this to 'teacher' for real owners
            memberType: 'returning',
            membershipPlan: 'monthly',
            status: 'approved',
            joinedAt: new Date().toISOString(),
            trialActive: false,
          };
          set((state) => ({
            members: state.members.some((m) => m.id === provisionalMember.id)
              ? state.members
              : [...state.members, provisionalMember],
            currentMember: state.currentMember ?? provisionalMember,
            halauMemberships: state.halauMemberships.some(
              (m) => m.userId === user!.id && m.halauId === provisionalHalauId
            )
              ? state.halauMemberships
              : [
                  ...state.halauMemberships,
                  {
                    id: `${user!.id}_${provisionalHalauId}`,
                    userId: user!.id,
                    halauId: provisionalHalauId,
                    role: 'student' as import('./types').UserRole,
                    status: 'approved' as import('./types').MemberStatus,
                    joinedAt: new Date().toISOString(),
                  },
                ],
          }));
          if (__DEV__) console.log('[store] P6: created provisional teacher member for owner pending screen fix');
        }
        if (resolvedHalauId) {
          const { halaus } = get();
          const halauExists = halaus.some((h) => h.id === resolvedHalauId);
          if (!halauExists) {
            try {
              const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL;
              if (backendUrl) {
                const res = await authedGet(`${backendUrl}/api/user/school/${encodeURIComponent(resolvedHalauId!)}`);
                if (res.ok) {
                  const json = await res.json() as { data: Record<string, unknown> | null };
                  const schoolData = json.data;
                  if (schoolData) {
                    const newHalau: import('./types').Halau = {
                      id: resolvedHalauId!,
                      name: (schoolData.name as string) ?? 'My School',
                      description: (schoolData.description as string) ?? '',
                      logo: (schoolData.logo as string) ?? undefined,
                      primaryColor: (schoolData.primaryColor as string) ?? '#8B2FC9',
                      secondaryColor: (schoolData.secondaryColor as string) ?? '#F3E8FF',
                      backgroundPattern: (schoolData.backgroundPattern as string) ?? undefined,
                      themeId: (schoolData.themeId as string) ?? undefined,
                      createdAt: new Date().toISOString(),
                      createdBy: user!.id,
                      inviteCode: (schoolData.inviteCode as string | undefined) ?? resolvedHalauId!,
                    };
                    set((state) => ({ halaus: [...state.halaus, newHalau] }));
                  }
                }
              }
            } catch (err) {
              console.error('[store] Failed to fetch school/members from backend:', err);
            }
          }

          // Seed a membership if missing; if one exists for a leader role, ensure it is approved
          const { halauMemberships: currentMemberships } = get();
          const membershipExists = currentMemberships.some(
            (m) => m.userId === user!.id && m.halauId === resolvedHalauId
          );
          if (!membershipExists) {
            const firestoreRole0 = firestoreUserDoc?.role ?? 'student';
            const role = (firestoreRole0 === 'owner' ? 'teacher' : firestoreRole0) as import('./types').UserRole;
            const newMembership: import('./types').HalauMembership = {
              id: user!.id + '_' + resolvedHalauId,
              userId: user!.id,
              halauId: resolvedHalauId!,
              role,
              status: 'approved',
              joinedAt: new Date().toISOString(),
            };
            set((state) => ({ halauMemberships: [...state.halauMemberships, newMembership] }));
          } else {
            // If a membership exists for this user but has a wrong status for a leader role, fix it
            const firestoreRole0 = firestoreUserDoc?.role ?? 'student';
            const role = (firestoreRole0 === 'owner' ? 'teacher' : firestoreRole0) as import('./types').UserRole;
            const isLeaderRole = role === 'teacher' || role === 'instructor' || role === 'admin';
            if (isLeaderRole) {
              set((state) => ({
                halauMemberships: state.halauMemberships.map((m) =>
                  m.userId === user!.id && m.halauId === resolvedHalauId
                    ? { ...m, role, status: 'approved' }
                    : m
                ),
              }));
            }
          }

          // ── Account linking: merge pre-registration invite member → real UID ──────
          // A teacher may have pre-added this user before they had a Firebase account.
          // That creates a member doc with userId = "invite:<email>".
          // Now that the real user is signing in, we replace it with their UID-based doc.
          // This runs once per email — after migration the invite record no longer exists.
          const normalizedSignInEmail = email.trim().toLowerCase();
          const inviteUserId = `invite:${normalizedSignInEmail}`;
          const inviteMemberToLink = get().members.find(
            (m) => m.userId === inviteUserId && m.halauId === resolvedHalauId,
          );
          if (inviteMemberToLink) {
            const linkedMember: import('./types').Member = {
              ...inviteMemberToLink,
              id: user!.id,        // UID-based doc ID
              userId: user!.id,    // Real Firebase UID
              email: normalizedSignInEmail,
              isManual: false,
            };
            console.log(`[merge] signIn: found invite member "${inviteUserId}" in school "${resolvedHalauId}" — migrating to UID "${user!.id}"`);
            set((state) => ({
              members: [
                // Remove the old invite record, add the UID-based record
                ...state.members.filter((m) => !(m.userId === inviteUserId && m.halauId === resolvedHalauId)),
                linkedMember,
              ],
            }));
            // Write the new UID-based doc to Firestore
            syncToBackend('PUT', `/api/user/school/${encodeURIComponent(resolvedHalauId!)}/members/${encodeURIComponent(linkedMember.id)}`, { ...linkedMember });
            // Delete the old invite:<email> doc from Firestore
            syncToBackend('DELETE', `/api/user/school/${encodeURIComponent(resolvedHalauId!)}/members/${encodeURIComponent(inviteMemberToLink.id)}`);
            console.log(`[merge] signIn: migrated "${inviteUserId}" → UID "${user!.id}" — old invite record scheduled for deletion`);
          }

          // Seed a Member record if missing — this drives currentMember, isKumu, role checks
          // Re-read members after the potential invite merge above so memberRecordExists is fresh
          const { members: currentMembers } = get();
          const memberRecordExists = currentMembers.some(
            (m) => m.userId === user!.id && m.halauId === resolvedHalauId
          );

          // Resolve firstName/lastName: prefer locally stored, fall back to Firestore user doc
          // The user doc may have separate firstName/lastName fields (stored during signUp)
          // or a combined name field (legacy). Prefer separate fields when available.
          const firestoreFirstName = (firestoreUserDoc as Record<string, unknown> | null)?.firstName as string ?? '';
          const firestoreLastName = (firestoreUserDoc as Record<string, unknown> | null)?.lastName as string ?? '';
          const firestoreFullName = (firestoreUserDoc?.name as string ?? '').trim();
          const firebaseNameParts = firestoreFullName.split(' ');
          const resolvedFirstName = user!.firstName ||
            firestoreFirstName ||
            firebaseNameParts[0] || '';
          const resolvedLastName = user!.lastName ||
            firestoreLastName ||
            firebaseNameParts.slice(1).join(' ') || '';

          if (!memberRecordExists) {
            // Map Firestore 'owner' role to 'teacher' — the app's internal UserRole type
            // uses 'teacher' as the top-level owner/kumu role
            const firestoreRole = firestoreUserDoc?.role ?? 'student';
            const role = (firestoreRole === 'owner' ? 'teacher' : firestoreRole) as import('./types').UserRole;
            const isLeader = role === 'teacher' || role === 'instructor' || role === 'admin';
            const memberType: import('./types').MemberType = isLeader ? 'returning' : 'new';
            const newMember: import('./types').Member = {
              id: user!.id,
              userId: user!.id,
              halauId: resolvedHalauId!,
              firstName: resolvedFirstName,
              lastName: resolvedLastName,
              email: user!.email,
              phone: '',
              role,
              memberType,
              membershipPlan: isLeader ? 'monthly' : 'monthly',
              status: 'approved',
              joinedAt: new Date().toISOString(),
              trialActive: firestoreUserDoc?.trialActive ?? false,
              subscription: firestoreUserDoc?.subscription ? {
                active: firestoreUserDoc.subscription.active ?? false,
                plan: firestoreUserDoc.subscription.plan ?? null,
                price: firestoreUserDoc.subscription.price ?? 0,
                renewalDate: null,
              } : undefined,
            };
            set((state) => ({
              members: [...state.members, newMember],
              currentMember: newMember,
            }));
          } else {
            // Member exists — update subscription from Firestore and set as currentMember
            const existingMember = currentMembers.find(
              (m) => m.userId === user!.id && m.halauId === resolvedHalauId
            ) ?? null;
            if (existingMember) {
              const firestoreRole2 = firestoreUserDoc?.role as string | undefined;
              const updatedRole = firestoreRole2
                ? ((firestoreRole2 === 'owner' ? 'teacher' : firestoreRole2) as import('./types').UserRole)
                : existingMember.role;
              // Teachers/owners/admins must always be approved — never allow their status to be 'pending'
              const isLeaderRole = updatedRole === 'teacher' || updatedRole === 'instructor' || updatedRole === 'admin';
              const patchedMember: import('./types').Member = {
                ...existingMember,
                // Restore names from Firestore/local if somehow empty
                firstName: existingMember.firstName || resolvedFirstName,
                lastName: existingMember.lastName || resolvedLastName,
                role: updatedRole,
                status: isLeaderRole ? 'approved' : existingMember.status,
                subscription: firestoreUserDoc?.subscription ? {
                  active: firestoreUserDoc.subscription.active ?? false,
                  plan: firestoreUserDoc.subscription.plan ?? null,
                  price: firestoreUserDoc.subscription.price ?? 0,
                  renewalDate: null,
                } : existingMember.subscription,
              };
              set((state) => ({
                members: state.members.map((m) =>
                  m.userId === user!.id && m.halauId === resolvedHalauId ? patchedMember : m
                ),
                currentMember: patchedMember,
              }));
            }
          }

          // ── Owner/member integrity guarantee ──────────────────────────────────────
          // On every sign-in, re-sync this user's own member doc to Firestore.
          // This serves two purposes:
          //   1. Repairs docs missing fields from the old PROTECTED_FIELDS bug.
          //   2. Guarantees the owner always has a member doc even if it was deleted.
          // We use a short delay so the sign-in state is fully committed before writing.
          setTimeout(() => {
            const { currentMember: cm } = get();
            if (!cm || !cm.halauId) return;

            // Integrity check before sync: validate the schema one more time
            const schemaErr = validateMemberSchema(cm);
            if (schemaErr) {
              console.error(`[integrity] signIn post-sync: currentMember FAILED schema check — ${schemaErr}`, {
                id: cm.id, userId: cm.userId, halauId: cm.halauId,
                firstName: cm.firstName, lastName: cm.lastName, role: cm.role, status: cm.status,
              });
              return; // Do NOT write a corrupt doc to Firestore
            }

            syncToBackend('PUT', `/api/user/school/${encodeURIComponent(cm.halauId)}/members/${encodeURIComponent(cm.id)}`, {
              ...cm,
            });
            console.log('[store] signIn: owner/member integrity sync', {
              id: cm.id, role: cm.role, status: cm.status, halauId: cm.halauId,
              firstName: cm.firstName, lastName: cm.lastName,
            });
          }, 2000); // Small delay so state is fully settled
        }

        set((state) => {
          // Guard: if signOut() ran while signIn() was in-flight, all three auth
          // fields will have been wiped. Restoring them would create a ghost session
          // where Zustand says "signed in" but Firebase Auth says "signed out".
          if (!state.isAuthenticated && state.firebaseUser === null && state.currentMember === null) {
            return state; // No-op — honour the signOut that ran during this flow
          }
          return {
            currentUser: user,
            firebaseUser: result.user,
            // currentMember was already set by the seeding logic above.
            // Only set it here if it wasn't seeded (e.g. user has no school yet).
            currentMember: state.currentMember ?? null,
            currentHalauId: resolvedHalauId,
            isAuthenticated: true,
            isEmailVerified: result.user?.emailVerified ?? false,
            // Restore trialStartDate from server — never allow client to overwrite with a newer date
            trialStartDate: firestoreUserDoc?.trialStartDate
              ? (state.trialStartDate && state.trialStartDate < firestoreUserDoc.trialStartDate
                  ? state.trialStartDate  // keep older (earlier) local value if it exists
                  : firestoreUserDoc.trialStartDate)
              : state.trialStartDate,
          };
        });

        // Non-blocking: fetch all school members from Firestore and seed them into the store
        if (resolvedHalauId) {
          const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL;
          if (backendUrl) {
            authedGet(`${backendUrl}/api/user/school/${encodeURIComponent(resolvedHalauId)}/members`)
              .then((r) => r.ok ? r.json() : null)
              .then((json: { data: Record<string, unknown>[] | null } | null) => {
                const firestoreMembers = json?.data;
                if (!Array.isArray(firestoreMembers) || firestoreMembers.length === 0) return;

                console.log(`[store] signIn: received ${firestoreMembers.length} member docs from Firestore for school ${resolvedHalauId}`);
                set((state) => {
                  const newMembers = [...state.members];
                  // Track userIds seen in this batch to detect duplicates from Firestore
                  const seenUserIds = new Map<string, string>(); // userId → memberId
                  let loadedCount = 0;
                  let skippedCount = 0;

                  for (const doc of firestoreMembers) {
                    // Support both new subcollection docs (.id) and legacy user-doc fallback (.uid)
                    const memberId = (doc.id as string) || (doc.uid as string) || '';
                    if (!memberId) { skippedCount++; continue; }

                    // Skip current user — already seeded above.
                    // Check both the doc ID and the userId field to handle legacy random-UUID member IDs.
                    const docUserId = (doc.userId as string) || '';
                    if (memberId === result.user?.uid || docUserId === result.user?.uid) continue;

                    // Skip docs with no role and no userId — completely corrupt/empty
                    if (!docUserId && !doc.role) {
                      console.warn(`[integrity] signIn: skipping blank doc ${memberId} — no role or userId`);
                      skippedCount++;
                      continue;
                    }

                    // New subcollection format has all fields directly on the doc
                    const hasFullRecord = !!(doc.role && doc.firstName !== undefined);

                    if (hasFullRecord) {
                      // Full member record from subcollection — run strict validator
                      if (!isMemberDoc(doc)) {
                        const err = validateMemberSchema(doc as Partial<import('./types').Member>);
                        console.warn(`[integrity] signIn: skipping doc ${memberId} — ${err ?? 'isMemberDoc failed'}`, {
                          id: doc.id, role: doc.role, userId: doc.userId, halauId: doc.halauId,
                          status: doc.status, firstName: doc.firstName, lastName: doc.lastName,
                          isManual: doc.isManual,
                        });
                        skippedCount++;
                        continue;
                      }

                      // Duplicate userId detection — warn if same userId appears twice in Firestore
                      if (docUserId) {
                        const prevId = seenUserIds.get(docUserId);
                        if (prevId && prevId !== memberId) {
                          console.warn(`[integrity] signIn: duplicate userId "${docUserId}" — saw as "${prevId}" and now "${memberId}". Keeping the one with matching id.`);
                        }
                        seenUserIds.set(docUserId, memberId);
                      }

                      // De-duplicate: match by id first, then by (userId + halauId)
                      const existingIdxById = newMembers.findIndex((m) => m.id === memberId);
                      const existingIdxByUserId = docUserId
                        ? newMembers.findIndex((m) => m.userId === docUserId && m.halauId === resolvedHalauId!)
                        : -1;
                      const existingIdx = existingIdxById >= 0 ? existingIdxById : existingIdxByUserId;

                      if (existingIdx >= 0) {
                        // Prefer Firestore values for mutable fields, keep local non-null values
                        newMembers[existingIdx] = { ...newMembers[existingIdx], ...(doc as import('./types').Member), id: memberId };
                      } else {
                        newMembers.push({ ...(doc as import('./types').Member), id: memberId });
                      }
                      loadedCount++;
                    } else {
                      // Legacy user-doc format — reconstruct member from profile fields
                      const rawRole = (doc.role as string) ?? 'student';
                      const isMinor = rawRole === 'minor';
                      const role = (isMinor ? 'student' : rawRole === 'owner' ? 'teacher' : rawRole) as import('./types').UserRole;

                      // Try separate firstName/lastName fields first; fall back to splitting `name`
                      const legacyFirstName = ((doc.firstName as string) ?? '').trim();
                      const legacyLastName  = ((doc.lastName  as string) ?? '').trim();
                      const fullName = ((doc.name as string) ?? '').trim();
                      const parts = fullName.split(' ');
                      const firstName = legacyFirstName || (parts[0] ?? '');
                      const lastName  = legacyLastName  || (parts.slice(1).join(' '));

                      // Skip legacy docs with no name — can't render them meaningfully
                      if (!firstName || !lastName) {
                        console.warn(`[integrity] signIn: skipping legacy doc ${memberId} — empty firstName/lastName after resolution`, {
                          name: doc.name, firstName: doc.firstName, lastName: doc.lastName,
                        });
                        skippedCount++;
                        continue;
                      }

                      const existingIdx = newMembers.findIndex((m) => m.userId === memberId && m.halauId === resolvedHalauId!);

                      const newMember: import('./types').Member = {
                        id: memberId,
                        userId: memberId,
                        halauId: resolvedHalauId!,
                        firstName,
                        lastName,
                        email: (doc.email as string) ?? '',
                        phone: '',
                        role,
                        memberType: 'returning',
                        membershipPlan: 'monthly',
                        status: 'approved',
                        joinedAt: new Date().toISOString(),
                        ...(isMinor && {
                          isKeiki: true,
                          linkedToMemberId: (doc.linkedTo as string) ?? undefined,
                        }),
                      };

                      if (existingIdx >= 0) {
                        newMembers[existingIdx] = {
                          ...newMembers[existingIdx],
                          firstName,
                          lastName,
                          email: (doc.email as string) ?? newMembers[existingIdx].email,
                          role,
                          ...(isMinor && {
                            isKeiki: true,
                            linkedToMemberId: (doc.linkedTo as string) ?? newMembers[existingIdx].linkedToMemberId,
                          }),
                        };
                      } else {
                        newMembers.push(newMember);
                      }
                      loadedCount++;
                    }
                  }

                  console.log(`[store] signIn: member hydration complete — loaded=${loadedCount} skipped=${skippedCount} total_in_store=${newMembers.length}`);
                  return { members: newMembers };
                });
                // After seeding, sync currentMember's status/role with what Firestore returned.
                // This ensures a student who was approved by their teacher sees the updated status
                // on their next sign-in without needing a full sign-out/sign-in cycle.
                set((state) => {
                  if (!state.currentMember || !result.user?.uid) return state;
                  const freshMember = state.members.find(
                    (m) => m.userId === result.user!.uid && m.halauId === resolvedHalauId!
                  );
                  if (!freshMember) return state;
                  const mergedMember = safeMergeMember(freshMember as unknown as Record<string, unknown>, state.currentMember);
                  if (mergedMember === state.currentMember) return state;
                  return {
                    currentMember: mergedMember,
                    members: state.members.map((m) =>
                      m.id === mergedMember.id ? mergedMember : m
                    ),
                  };
                });
              })
              .catch((err: unknown) => { console.error('[store] member hydration failed:', err); });

          // Non-blocking: fetch events and seed into store
          authedGet(`${backendUrl}/api/user/school/${encodeURIComponent(resolvedHalauId)}/events`)
            .then((r) => r.ok ? r.json() : null)
            .then((json: { data: Record<string, unknown>[] | null } | null) => {
              const firestoreEvents = json?.data;
              if (!Array.isArray(firestoreEvents) || firestoreEvents.length === 0) return;

              set((state) => {
                const newEvents = [...state.events];
                for (const doc of firestoreEvents) {
                  const id = (doc.id as string) ?? '';
                  if (!id) continue;
                  const existingIdx = newEvents.findIndex((e) => e.id === id);
                  // Only update if Firestore version is newer
                  if (existingIdx >= 0) {
                    const existingUpdatedAt = newEvents[existingIdx].createdAt ?? '';
                    const firestoreUpdatedAt = (doc.updatedAt as string) ?? '';
                    if (firestoreUpdatedAt > existingUpdatedAt) {
                      newEvents[existingIdx] = { ...newEvents[existingIdx], ...doc } as Event;
                    }
                  } else {
                    newEvents.push(doc as unknown as Event);
                  }
                }
                return { events: newEvents };
              });
            })
            .catch((err: unknown) => { console.error('[store] event hydration failed:', err); });

          // Non-blocking: fetch attendance records and seed into store
          authedGet(`${backendUrl}/api/user/school/${encodeURIComponent(resolvedHalauId)}/attendance`)
            .then((r) => r.ok ? r.json() : null)
            .then((json: { data: Record<string, unknown>[] | null } | null) => {
              const docs = json?.data;
              if (!Array.isArray(docs) || docs.length === 0) return;
              set((state) => {
                const newAttendances = [...state.attendances];
                for (const doc of docs) {
                  const id = (doc.id as string) ?? '';
                  if (!id) continue;
                  const existingIdx = newAttendances.findIndex((a) => a.id === id);
                  if (existingIdx >= 0) {
                    const firestoreMarkedAt = (doc.markedAt as string) ?? '';
                    const existingMarkedAt = newAttendances[existingIdx].markedAt ?? '';
                    if (firestoreMarkedAt > existingMarkedAt) {
                      newAttendances[existingIdx] = { ...newAttendances[existingIdx], ...doc } as import('./types').Attendance;
                    }
                  } else {
                    newAttendances.push(doc as unknown as import('./types').Attendance);
                  }
                }
                return { attendances: newAttendances };
              });
            })
            .catch((err: unknown) => { console.error('[store] attendance hydration failed:', err); });

          // Non-blocking: fetch payments and seed into store
          authedGet(`${backendUrl}/api/user/school/${encodeURIComponent(resolvedHalauId)}/payments`)
            .then((r) => r.ok ? r.json() : null)
            .then((json: { data: Record<string, unknown>[] | null } | null) => {
              const firestorePayments = json?.data;
              if (!Array.isArray(firestorePayments) || firestorePayments.length === 0) return;

              set((state) => {
                const newPayments = [...state.payments];
                for (const doc of firestorePayments) {
                  const id = (doc.id as string) ?? '';
                  if (!id) continue;
                  const existingIdx = newPayments.findIndex((p) => p.id === id);
                  if (existingIdx >= 0) {
                    const firestoreUpdatedAt = (doc.updatedAt as string) ?? '';
                    const existingUpdatedAt = newPayments[existingIdx].recordedAt ?? '';
                    if (firestoreUpdatedAt > existingUpdatedAt) {
                      newPayments[existingIdx] = { ...newPayments[existingIdx], ...doc } as Payment;
                    }
                  } else {
                    newPayments.push(doc as unknown as Payment);
                  }
                }
                return { payments: newPayments };
              });
            })
              .catch((err: unknown) => { console.error('[store] payment hydration failed:', err); });

          // Non-blocking: fetch videos and seed into store
          const videoFetchSchoolId = resolvedHalauId;
          authedGet(`${backendUrl}/api/user/school/${encodeURIComponent(resolvedHalauId)}/videos`)
            .then((r) => r.ok ? r.json() : null)
            .then((json: { data: Record<string, unknown>[] | null } | null) => {
              // Discard if user has switched schools since this fetch started
              if (get().currentHalauId !== videoFetchSchoolId) return;
              const firestoreVideos = json?.data;
              if (!Array.isArray(firestoreVideos) || firestoreVideos.length === 0) return;

              set((state) => {
                const newVideos = [...state.videos];
                for (const doc of firestoreVideos) {
                  const id = (doc.id as string) ?? '';
                  if (!id) continue;
                  const existingIdx = newVideos.findIndex((v) => v.id === id);
                  if (existingIdx >= 0) {
                    const firestoreUpdatedAt = (doc.updatedAt as string) ?? '';
                    const existingUploadedAt = newVideos[existingIdx].uploadedAt ?? '';
                    if (firestoreUpdatedAt > existingUploadedAt) {
                      newVideos[existingIdx] = { ...newVideos[existingIdx], ...doc } as Video;
                    }
                  } else {
                    newVideos.push(doc as unknown as Video);
                  }
                }
                return { videos: newVideos };
              });
            })
            .catch((err: unknown) => { console.error('[store] video hydration failed:', err); });

          // Non-blocking: fetch financial data and seed into store
          const halauPath = encodeURIComponent(resolvedHalauId);
          const syncFin = (col: string, key: 'memberDues' | 'organizationDues' | 'overdueExpenses' | 'financialTransactions' | 'pendingPaymentSubmissions') => {
            authedGet(`${backendUrl}/api/user/school/${halauPath}/${col}`)
              .then((r) => (r.ok ? r.json() : null))
              .then((json: { data: Record<string, unknown>[] | null } | null) => {
                const docs = json?.data;
                if (!Array.isArray(docs) || docs.length === 0) return;
                // Per-item merge: preserve any optimistic local records not yet on the server
                set((state) => {
                  const existing = (state[key] as unknown) as Record<string, unknown>[];
                  const merged = [...existing];
                  for (const doc of docs) {
                    const id = (doc.id as string) ?? '';
                    if (!id) continue;
                    const idx = merged.findIndex((e) => (e as Record<string, unknown>).id === id);
                    if (idx >= 0) {
                      const existingTs = ((merged[idx] as Record<string, unknown>).updatedAt as string) ?? '';
                      const incomingTs = (doc.updatedAt as string) ?? '';
                      const hasBoth = incomingTs && existingTs;
                      const isStale = !!(hasBoth && incomingTs < existingTs);
                      if (!incomingTs && existingTs) {
                        console.warn('[store] Financial record update skipped: no incoming timestamp over timestamped state', { id, col, existingTs });
                      } else {
                        if (isStale) {
                          console.warn('[store] Stale financial data: applying with caution', { id, col, incomingTs, existingTs });
                        }
                        merged[idx] = { ...merged[idx], ...doc };
                      }
                    } else {
                      merged.push(doc);
                    }
                  }
                  return { [key]: merged } as unknown as Partial<AppState>;
                });
              })
              .catch((e: unknown) => { console.error(`[store] ${col} hydration failed:`, e); });
          };
          syncFin('member-dues', 'memberDues');
          syncFin('organization-dues', 'organizationDues');
          syncFin('overdue-expenses', 'overdueExpenses');
          syncFin('financial-transactions', 'financialTransactions');
          syncFin('pending-payments', 'pendingPaymentSubmissions');
          }
        }

        // Flush any writes that were queued while the user was offline
        void flushWriteQueue();
        metrics.event('hydration_complete');

        // Identify user in RevenueCat so purchase history is tied to the correct Firebase UID.
        // AWAITED — must complete before signIn returns so no race with a fast subsequent signOut.
        try {
          const { setUserId } = await import('./revenuecatClient');
          await setUserId(result.user!.uid);
        } catch { /* RevenueCat not available — non-fatal */ }

        return { success: true };
        } finally {
          metrics.end('signIn');
          releaseSessionLock();
        }
      },

      signOut: async () => {
        // AWAIT RevenueCat logout BEFORE Firebase sign-out to guarantee identity sequencing.
        // If fire-and-forget, a fast subsequent logIn(newUid) can race with this logOut and
        // get silently logged out of RevenueCat mid-session (BUG-02).
        try {
          const { logoutUser } = await import('./revenuecatClient');
          await logoutUser();
        } catch { /* RevenueCat not available — non-fatal */ }

        try {
          await firebaseSignOut();
        } catch (err) {
          console.error('[store] firebaseSignOut failed — proceeding with local wipe:', err);
          // Intentional fall-through: local state wipe must always execute
          // even when Firebase is unreachable to prevent ghost sessions.
        }
        // Clear ALL session-bound and school-specific state so AsyncStorage never
        // rehydrates stale memberships, member records, or school data for the
        // next session. UI preferences (isDarkMode, hasSeenIntro, seenGuides) are
        // intentionally preserved.
        set({
          currentUser: null,
          firebaseUser: null,
          currentMember: null,
          currentHalauId: null,
          isAuthenticated: false,
          isEmailVerified: false,
          // Wipe all school/membership/operational data
          halaus: [],
          halauMemberships: [],
          users: [],
          members: [],
          events: [],
          attendances: [],
          rsvps: [],
          payments: [],
          shows: [],
          showParticipations: [],
          videos: [],
          waivers: [],
          waiverSignatures: [],
          chatChannels: [],
          chatMessages: [],
          notifications: [],
          organizationDues: [],
          memberDues: [],
          overdueExpenses: [],
          financialTransactions: [],
          pendingPaymentSubmissions: [],
          trialStartDate: null,
          hasSeenWelcomePopup: false,
          isHydrating: false,
          isBackgroundRefreshing: false,
          recoveryAttempts: 0,
        });
      },

      resetPassword: async (email) => {
        const result = await sendPasswordReset(email);
        return result;
      },

      changePassword: async () => {
        // With Firebase, password change is handled differently
        // Users should use the "Forgot Password" flow
        return { success: false, error: 'Please use the forgot password option to change your password' };
      },

      verifyEmail: (userId) => {
        set((state) => ({
          users: state.users.map((u) =>
            u.id === userId ? { ...u, emailVerified: true } : u
          ),
        }));
      },

      retryAccountRecovery: async () => {
        const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL;
        if (!backendUrl) return { schoolId: null, confirmed: false };

        set((s) => ({ isHydrating: true, recoveryAttempts: s.recoveryAttempts + 1 }));

        // Single attempt with 5s AbortController timeout. Retries once on failure.
        // Total max wall time: ~10s (2 × 5s). Does NOT use authedGet (up to 32s).
        const attemptRecovery = async (): Promise<{ schoolId: string | null; confirmed: boolean }> => {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 5000);
          try {
            const tok = await getFirebaseIdToken();
            const hdrs: Record<string, string> = { 'Content-Type': 'application/json' };
            if (tok) hdrs['Authorization'] = `Bearer ${tok}`;
            const res = await fetch(`${backendUrl}/api/user/my-school`, { headers: hdrs, signal: ctrl.signal });
            clearTimeout(timer);
            if (!res.ok) throw new Error(`/my-school returned ${res.status}`);
            const json = await res.json() as { data: { schoolId?: string; role?: string } | null };
            if (json.data?.schoolId) {
              return { schoolId: json.data.schoolId, confirmed: true };
            }
            // Backend confirmed no membership
            return { schoolId: null, confirmed: true };
          } catch {
            clearTimeout(timer);
            return { schoolId: null, confirmed: false };
          }
        };

        let result = await attemptRecovery();
        if (!result.confirmed) {
          set((s) => ({ recoveryAttempts: s.recoveryAttempts + 1 }));
          result = await attemptRecovery();
        }

        if (result.confirmed) {
          if (result.schoolId) {
            set({ currentHalauId: result.schoolId, isHydrating: false, recoveryAttempts: 0 });
            // Kick off a full school data refresh so that when _layout.tsx routes to /(tabs),
            // the store has currentMember, halaus[], and members[] populated. Without this,
            // recovery is a stripped path that sets schoolId but leaves all derived state empty.
            // Fire-and-forget: don't block on this — isHydrating was already cleared above.
            void get().refreshSchoolData();
          } else {
            set({ isHydrating: false });
          }
        }
        // If !confirmed after retry: isHydrating stays true → /recovering screen shows error UI
        return result;
      },


      createHalau: (name, description) => {
        const { currentUser } = get();
        if (!currentUser) throw new Error('Not authenticated');

        // Guard: owner must have a name before their member doc is created
        const ownerFirstName = currentUser.firstName?.trim() || '';
        const ownerLastName  = currentUser.lastName?.trim()  || '';
        if (!ownerFirstName || !ownerLastName) {
          console.error('[store] createHalau: owner has empty firstName/lastName', {
            userId: currentUser.id, firstName: currentUser.firstName, lastName: currentUser.lastName,
          });
          throw new Error('Your profile is missing a name. Please sign out and sign back in before creating a school.');
        }

        const halau: Halau = {
          id: generateId(),
          name,
          description,
          primaryColor: '#0D9488',
          secondaryColor: '#F59E0B',
          createdAt: new Date().toISOString(),
          createdBy: currentUser.id,
          inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
        };

        const membership: HalauMembership = {
          id: `${currentUser.id}_${halau.id}`,
          userId: currentUser.id,
          halauId: halau.id,
          role: 'teacher',
          status: 'approved',
          joinedAt: new Date().toISOString(),
        };

        // Create a member record for the creator — use UID as ID to prevent duplicates
        const member: Member = {
          id: currentUser.id,
          userId: currentUser.id,
          halauId: halau.id,
          firstName: ownerFirstName,
          lastName: ownerLastName,
          email: currentUser.email,
          phone: currentUser.phone || '',
          role: 'teacher',
          memberType: 'new',
          membershipPlan: 'annual',
          status: 'approved',
          joinedAt: new Date().toISOString(),
          approvedAt: new Date().toISOString(),
        };

        // Strict schema assertion — throws if any required field is missing
        assertMemberSchema(member, 'createHalau');

        console.log('[store] createHalau: creating owner member doc', {
          id: member.id,
          userId: member.userId,
          halauId: member.halauId,
          firstName: member.firstName,
          lastName: member.lastName,
          role: member.role,
          status: member.status,
        });

        // Create default chat channel
        const generalChannel: ChatChannel = {
          id: generateId(),
          halauId: halau.id,
          name: 'General',
          type: 'halau',
          description: 'Main halau chat',
          createdBy: currentUser.id,
          createdAt: new Date().toISOString(),
          memberIds: [member.id],
        };

        set((state) => ({
          halaus: [...state.halaus, halau],
          halauMemberships: [...state.halauMemberships, membership],
          members: [...state.members, member],
          chatChannels: [...state.chatChannels, generalChannel],
          currentHalauId: halau.id,
          currentMember: member,
          // Seed trialStartDate from current time only if the server hasn't already set one.
          // The /init backend endpoint is the authoritative source; this is a local fallback
          // so the paywall screen shows the correct trial status immediately after school creation.
          trialStartDate: state.trialStartDate ?? new Date().toISOString(),
        }));

        // Mirror to Firestore — trialActive: true starts the 14-day window
        upsertUserDocument({
          name: `${currentUser.firstName} ${currentUser.lastName}`,
          role: 'teacher',
          schoolId: halau.id,
          trialActive: true,
          paymentResponsibility: null,
          inviteStatus: 'none',
        }).catch((err: unknown) => { console.warn('[store] createHalau Firestore mirror failed:', err); });

        // Immediately create the school doc in Firestore so it exists for all users.
        // The backend /init endpoint also stamps trialStartDate on the user doc (server-authoritative).
        // After the init succeeds, read the server trialStartDate back so we use the canonical value.
        const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL;
        if (backendUrl) {
          syncToBackendWithRetry('POST', `/api/user/school/${encodeURIComponent(halau.id)}/init`, {
            name: halau.name,
            ownerId: currentUser.id,
            inviteCode: halau.inviteCode,
            primaryColor: halau.primaryColor,
            secondaryColor: halau.secondaryColor,
          }).then(() =>
            // After init, fetch the user doc to get the authoritative trialStartDate from the server
            authedGet(`${backendUrl}/api/user/me?uid=${encodeURIComponent(currentUser.id)}`)
              .then((r) => r.ok ? r.json() : null)
              .then((json: { data: { trialStartDate?: string } | null } | null) => {
                const serverDate = json?.data?.trialStartDate;
                if (serverDate) {
                  set((state) => ({
                    // Always prefer the earlier date — the server timestamp is authoritative
                    trialStartDate: state.trialStartDate && state.trialStartDate < serverDate
                      ? state.trialStartDate
                      : serverDate,
                  }));
                }
              })
              .catch((e: unknown) => { console.error('[store] trialStartDate refresh failed:', e); })
          ).catch((err: unknown) => { console.error('[store] school init failed:', err); });
        } else {
          syncToBackend('POST', `/api/user/school/${encodeURIComponent(halau.id)}/init`, {
            name: halau.name,
            ownerId: currentUser.id,
            inviteCode: halau.inviteCode,
            primaryColor: halau.primaryColor,
            secondaryColor: halau.secondaryColor,
          });
        }

        // Sync the owner's member record to Firestore
        syncToBackend('PUT', `/api/user/school/${encodeURIComponent(halau.id)}/members/${encodeURIComponent(member.id)}`, {
          ...member,
        });

        return halau;
      },

      joinHalauByCode: async (code, role = 'student') => {
        const { halauMemberships, currentUser, members: currentMembers } = get();
        if (!currentUser) return { success: false, error: 'Not authenticated' };

        // Look up the school by invite code via the backend (cloud lookup — works on any device)
        const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL;
        if (!backendUrl) return { success: false, error: 'Backend not configured' };

        let halau: { id: string; name: string; primaryColor: string; secondaryColor: string; inviteCode: string };
        try {
          const token = await getFirebaseIdToken();
          const headers: Record<string, string> = {};
          if (token) headers['Authorization'] = `Bearer ${token}`;
          const res = await fetch(`${backendUrl}/api/user/school/lookup?code=${encodeURIComponent(code.trim().toUpperCase())}`, { headers });
          if (!res.ok) return { success: false, error: 'Invalid invite code' };
          const data = await res.json() as { schoolId: string; name: string; primaryColor: string; secondaryColor: string; inviteCode: string };
          halau = { id: data.schoolId, name: data.name, primaryColor: data.primaryColor, secondaryColor: data.secondaryColor, inviteCode: data.inviteCode };
        } catch {
          return { success: false, error: 'Could not verify invite code. Check your connection and try again.' };
        }

        const existingMembership = halauMemberships.find(
          (m) => m.userId === currentUser.id && m.halauId === halau.id
        );
        if (existingMembership) {
          return { success: false, error: 'Already a member of this halau' };
        }

        // Duplicate prevention: check member subcollection too (membership may be stale)
        const existingMemberDoc = findExistingMember(currentMembers, currentUser.id, halau.id);
        if (existingMemberDoc) {
          console.warn(`[integrity] joinHalauByCode: duplicate prevented — userId "${currentUser.id}" already has member "${existingMemberDoc.id}" in school "${halau.id}"`);
          set({ currentMember: existingMemberDoc, currentHalauId: halau.id });
          return { success: true };
        }

        // ── Account linking: merge pre-registration invite member → real UID ──────
        // If the teacher pre-added this user (invite:<email>), merge that record into the
        // real UID-based doc instead of creating a duplicate.
        const normalizedJoinEmail = currentUser.email.trim().toLowerCase();
        const joinInviteUserId = `invite:${normalizedJoinEmail}`;
        const inviteMemberInSchool = currentMembers.find(
          (m) => m.userId === joinInviteUserId && m.halauId === halau.id,
        );
        if (inviteMemberInSchool) {
          // Preserve the teacher's data (role, status, class level, etc.) and upgrade to real UID
          const linkedMember: Member = {
            ...inviteMemberInSchool,
            id: currentUser.id,
            userId: currentUser.id,
            email: normalizedJoinEmail,
            // Use firstName/lastName from invite if current user's profile is incomplete
            firstName: currentUser.firstName?.trim() || inviteMemberInSchool.firstName,
            lastName: currentUser.lastName?.trim() || inviteMemberInSchool.lastName,
            isManual: false,
          };

          const membership: HalauMembership = {
            id: `${currentUser.id}_${halau.id}`,
            userId: currentUser.id,
            halauId: halau.id,
            role: linkedMember.role,
            status: linkedMember.status,
            joinedAt: linkedMember.joinedAt,
          };

          console.log(`[merge] joinHalauByCode: found invite member "${joinInviteUserId}" in school "${halau.id}" — migrating to UID "${currentUser.id}"`);

          set((state) => ({
            halauMemberships: [...state.halauMemberships, membership],
            members: [
              ...state.members.filter((m) => !(m.userId === joinInviteUserId && m.halauId === halau.id)),
              linkedMember,
            ],
            currentHalauId: halau.id,
            currentMember: linkedMember,
            halaus: state.halaus.some((h) => h.id === halau.id)
              ? state.halaus
              : [...state.halaus, {
                  id: halau.id, name: halau.name,
                  primaryColor: halau.primaryColor, secondaryColor: halau.secondaryColor,
                  inviteCode: halau.inviteCode, createdAt: new Date().toISOString(), createdBy: '',
                }],
          }));

          // Write UID-based doc to backend — awaited with 15s timeout so schoolId is stamped before returning
          try {
            const mergeToken = await getFirebaseIdToken();
            const mergeHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
            if (mergeToken) mergeHeaders['Authorization'] = `Bearer ${mergeToken}`;
            const mergeCtrl = new AbortController();
            const mergeTimer = setTimeout(() => mergeCtrl.abort(), 15000);
            try {
              await fetch(
                `${backendUrl}/api/user/school/${encodeURIComponent(halau.id)}/members/${encodeURIComponent(linkedMember.id)}`,
                { method: 'PUT', headers: mergeHeaders, body: JSON.stringify(linkedMember), signal: mergeCtrl.signal },
              );
            } finally {
              clearTimeout(mergeTimer);
            }
          } catch (mergeErr) {
            console.error('[store] joinHalauByCode merge: backend PUT error', mergeErr);
            syncToBackend('PUT', `/api/user/school/${encodeURIComponent(halau.id)}/members/${encodeURIComponent(linkedMember.id)}`, { ...linkedMember });
          }
          // Delete old invite doc from Firestore (fire-and-forget — housekeeping only)
          syncToBackend('DELETE', `/api/user/school/${encodeURIComponent(halau.id)}/members/${encodeURIComponent(inviteMemberInSchool.id)}`);
          // schoolId + role are stamped on users/{uid} by the backend PUT members handler — no client-side write needed.

          console.log(`[merge] joinHalauByCode: migrated "${joinInviteUserId}" → UID "${currentUser.id}" — old invite record deleted`);
          return { success: true };
        }

        // Validate that the user has a firstName and lastName before creating member doc
        const resolvedFirstName = currentUser.firstName?.trim() || '';
        const resolvedLastName = currentUser.lastName?.trim() || '';
        if (!resolvedFirstName || !resolvedLastName) {
          console.error('[store] joinHalauByCode: currentUser has empty firstName/lastName', {
            userId: currentUser.id,
            email: currentUser.email,
            firstName: currentUser.firstName,
            lastName: currentUser.lastName,
          });
          return { success: false, error: 'Your profile is missing a name. Please sign out and sign in again.' };
        }

        const membership: HalauMembership = {
          id: `${currentUser.id}_${halau.id}`,
          userId: currentUser.id,
          halauId: halau.id,
          role: role,
          status: 'pending',
          joinedAt: new Date().toISOString(),
        };

        const member: Member = {
          id: currentUser.id,
          userId: currentUser.id,
          halauId: halau.id,
          firstName: resolvedFirstName,
          lastName: resolvedLastName,
          email: currentUser.email,
          phone: currentUser.phone || '',
          role: role,
          memberType: 'new',
          membershipPlan: 'monthly',
          status: 'pending',
          joinedAt: new Date().toISOString(),
        };

        // Strict schema assertion — throws if required fields are missing
        assertMemberSchema(member, 'joinHalauByCode');

        console.log('[store] joinHalauByCode: creating member doc', {
          id: member.id,
          userId: member.userId,
          halauId: member.halauId,
          firstName: member.firstName,
          lastName: member.lastName,
          role: member.role,
          status: member.status,
        });

        set((state) => ({
          halauMemberships: [...state.halauMemberships, membership],
          members: [...state.members, member],
          currentHalauId: halau.id,
          currentMember: member,
          // Add the school to local state if it wasn't already loaded (new user on a fresh device)
          halaus: state.halaus.some((h) => h.id === halau.id)
            ? state.halaus
            : [...state.halaus, {
                id: halau.id,
                name: halau.name,
                primaryColor: halau.primaryColor,
                secondaryColor: halau.secondaryColor,
                inviteCode: halau.inviteCode,
                createdAt: new Date().toISOString(),
                createdBy: '',
              }],
        }));

        // Await the backend PUT so users/{uid} is stamped with schoolId before returning.
        // 15-second AbortController timeout prevents the join UI from freezing indefinitely (BUG-08).
        // If PUT succeeds but returns no schoolId, run /my-school recovery immediately.
        // If PUT times out or fails, fall back to the offline retry queue.
        try {
          const joinToken = await getFirebaseIdToken();
          const putHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
          if (joinToken) putHeaders['Authorization'] = `Bearer ${joinToken}`;
          const joinCtrl = new AbortController();
          const joinTimer = setTimeout(() => joinCtrl.abort(), 15000);
          let putRes: Response;
          try {
            putRes = await fetch(
              `${backendUrl}/api/user/school/${encodeURIComponent(halau.id)}/members/${encodeURIComponent(member.id)}`,
              { method: 'PUT', headers: putHeaders, body: JSON.stringify(member), signal: joinCtrl.signal },
            );
          } finally {
            clearTimeout(joinTimer);
          }
          if (putRes.ok) {
            const putJson = await putRes.json() as { success?: boolean; schoolId?: string };
            if (!putJson.schoolId) {
              // Backend omitted schoolId — confirm via /my-school
              console.error('[store] joinHalauByCode: PUT ok but no schoolId — running recovery');
              const recoveryRes = await authedGet(`${backendUrl}/api/user/my-school`);
              if (recoveryRes.ok) {
                const rj = await recoveryRes.json() as { data: { schoolId?: string } | null };
                if (rj.data?.schoolId) set({ currentHalauId: rj.data.schoolId });
              }
            }
          } else {
            console.error('[store] joinHalauByCode: backend PUT failed', putRes.status);
            // Fall back to async retry so the write eventually lands
            syncToBackend('PUT', `/api/user/school/${encodeURIComponent(halau.id)}/members/${encodeURIComponent(member.id)}`, { ...member });
          }
        } catch (putErr) {
          console.error('[store] joinHalauByCode: backend PUT error', putErr);
          // Timeout or network failure — queue for retry
          syncToBackend('PUT', `/api/user/school/${encodeURIComponent(halau.id)}/members/${encodeURIComponent(member.id)}`, { ...member });
        }

        return { success: true };
      },

      requestToJoinHalau: async (halauId) => {
        const { currentUser, halauMemberships, members: currentMembers } = get();
        if (!currentUser) return { success: false, error: 'Not authenticated' };

        const existingMembership = halauMemberships.find(
          (m) => m.userId === currentUser.id && m.halauId === halauId
        );
        if (existingMembership) {
          return { success: false, error: 'Already requested or a member' };
        }

        // Validate required name fields before writing
        const resolvedFirstName = currentUser.firstName?.trim() || '';
        const resolvedLastName = currentUser.lastName?.trim() || '';
        if (!resolvedFirstName || !resolvedLastName) {
          console.error('[store] requestToJoinHalau: empty firstName/lastName — blocking write', {
            userId: currentUser.id, firstName: currentUser.firstName, lastName: currentUser.lastName,
          });
          return { success: false, error: 'Your profile is missing a name. Please sign out and sign in again.' };
        }

        // Duplicate prevention: check if this user already has a member doc in this school
        const existingMember = findExistingMember(currentMembers, currentUser.id, halauId);
        if (existingMember) {
          console.warn(`[integrity] requestToJoinHalau: duplicate prevented — userId "${currentUser.id}" already has member "${existingMember.id}" in school "${halauId}"`);
          // Already exists — just set as current and return success
          set({ currentMember: existingMember, currentHalauId: halauId });
          return { success: true };
        }

        const membership: HalauMembership = {
          id: `${currentUser.id}_${halauId}`,
          userId: currentUser.id,
          halauId: halauId,
          role: 'student',
          status: 'pending',
          joinedAt: new Date().toISOString(),
        };

        const member: Member = {
          id: currentUser.id,
          userId: currentUser.id,
          halauId: halauId,
          firstName: resolvedFirstName,
          lastName: resolvedLastName,
          email: currentUser.email,
          phone: '',
          role: 'student',
          memberType: 'new',
          membershipPlan: 'monthly',
          status: 'pending',
          joinedAt: new Date().toISOString(),
        };

        // Schema assertion — will throw if corrupted
        assertMemberSchema(member, 'requestToJoinHalau');

        set((state) => ({
          halauMemberships: [...state.halauMemberships, membership],
          members: [...state.members, member],
        }));

        return { success: true };
      },

      approveHalauMember: (membershipId) => {
        set((state) => ({
          halauMemberships: state.halauMemberships.map((m) =>
            m.id === membershipId ? { ...m, status: 'approved' as MemberStatus } : m
          ),
        }));
      },

      denyHalauMember: (membershipId) => {
        set((state) => ({
          halauMemberships: state.halauMemberships.map((m) =>
            m.id === membershipId ? { ...m, status: 'denied' as MemberStatus } : m
          ),
        }));
      },

      updateHalauBranding: (halauId, updates) => {
        set((state) => ({
          halaus: state.halaus.map((h) =>
            h.id === halauId ? { ...h, ...updates } : h
          ),
        }));
      },

      updateHalauName: async (halauId, name) => {
        const { currentMember } = get();
        const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? '';
        try {
          const token = await getFirebaseIdToken();
          const res = await fetch(`${backendUrl}/api/user/school/${halauId}/name`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ name, requestingUid: currentMember?.userId }),
          });
          const json = await res.json() as { success?: boolean; error?: string };
          if (!res.ok || !json.success) {
            return { success: false, error: json.error ?? 'Failed to update name' };
          }
          set((state) => ({
            halaus: state.halaus.map((h) =>
              h.id === halauId ? { ...h, name: name.trim() } : h
            ),
          }));
          return { success: true };
        } catch (e) {
          return { success: false, error: e instanceof Error ? e.message : 'Network error' };
        }
      },

      setCurrentHalau: (halauId) => {
        const { currentUser, members } = get();
        if (!currentUser) return;

        const member = members.find((m) => m.userId === currentUser.id && m.halauId === halauId);
        set({
          currentHalauId: halauId,
          currentMember: member || null,
        });
      },

      getHalau: (halauId) => {
        return get().halaus.find((h) => h.id === halauId);
      },

      // Custom class levels
      addCustomClassLevel: (halauId, label, description) => {
        const newLevel: CustomClassLevel = {
          id: generateId(),
          value: label.toLowerCase().replace(/\s+/g, '_'),
          label,
          description,
          order: (get().halaus.find((h) => h.id === halauId)?.customClassLevels?.length || 0) + 1,
        };

        set((state) => ({
          halaus: state.halaus.map((h) =>
            h.id === halauId
              ? { ...h, customClassLevels: [...(h.customClassLevels || []), newLevel] }
              : h
          ),
        }));

        // Persist to Firestore so all users see the change immediately
        const halau = get().halaus.find((h) => h.id === halauId);
        const uid = get().firebaseUser?.uid;
        if (uid && halau) {
          syncToBackend('PATCH', `/api/user/school/${encodeURIComponent(halauId)}/class-levels`, {
            requestingUid: uid,
            customClassLevels: halau.customClassLevels,
          });
        }

        return newLevel;
      },

      updateCustomClassLevel: (halauId, levelId, updates) => {
        const defaultLevelIds = ['minor', 'beginner', 'intermediate', 'advanced'];

        // Check if this is a default level
        if (defaultLevelIds.includes(levelId)) {
          // Update the default level override
          set((state) => ({
            halaus: state.halaus.map((h) =>
              h.id === halauId
                ? {
                    ...h,
                    defaultClassLevelOverrides: {
                      ...(h.defaultClassLevelOverrides || {}),
                      [levelId]: {
                        ...(h.defaultClassLevelOverrides?.[levelId] || {}),
                        ...(updates.label !== undefined && { label: updates.label }),
                        ...(updates.description !== undefined && { description: updates.description }),
                      },
                    },
                  }
                : h
            ),
          }));
        } else {
          // Update custom class level
          set((state) => ({
            halaus: state.halaus.map((h) =>
              h.id === halauId
                ? {
                    ...h,
                    customClassLevels: h.customClassLevels?.map((level) =>
                      level.id === levelId ? { ...level, ...updates } : level
                    ),
                  }
                : h
            ),
          }));
        }

        // Persist to Firestore so all users see the change immediately
        const halauAfter = get().halaus.find((h) => h.id === halauId);
        const uid = get().firebaseUser?.uid;
        if (uid && halauAfter) {
          syncToBackend('PATCH', `/api/user/school/${encodeURIComponent(halauId)}/class-levels`, {
            requestingUid: uid,
            customClassLevels: halauAfter.customClassLevels,
            defaultClassLevelOverrides: halauAfter.defaultClassLevelOverrides,
          });
        }
      },

      deleteCustomClassLevel: (halauId, levelId) => {
        set((state) => ({
          halaus: state.halaus.map((h) =>
            h.id === halauId
              ? {
                  ...h,
                  customClassLevels: h.customClassLevels?.filter((level) => level.id !== levelId),
                }
              : h
          ),
        }));

        // Persist to Firestore so all users see the change immediately
        const halauAfter = get().halaus.find((h) => h.id === halauId);
        const uid = get().firebaseUser?.uid;
        if (uid && halauAfter) {
          syncToBackend('PATCH', `/api/user/school/${encodeURIComponent(halauId)}/class-levels`, {
            requestingUid: uid,
            customClassLevels: halauAfter.customClassLevels,
          });
        }
      },

      getClassLevelsForHalau: (halauId) => {
        const halau = get().halaus.find((h) => h.id === halauId);
        const overrides = halau?.defaultClassLevelOverrides || {};

        const defaultLevels: CustomClassLevel[] = [
          {
            id: 'minor',
            value: 'minor',
            label: overrides.minor?.label || 'Minors',
            description: overrides.minor?.description || "Children's class",
            order: 0,
          },
          {
            id: 'beginner',
            value: 'beginner',
            label: overrides.beginner?.label || 'Beginner',
            description: overrides.beginner?.description || 'New to hula',
            order: 1,
          },
          {
            id: 'intermediate',
            value: 'intermediate',
            label: overrides.intermediate?.label || 'Intermediate',
            description: overrides.intermediate?.description || 'Some experience',
            order: 2,
          },
          {
            id: 'advanced',
            value: 'advanced',
            label: overrides.advanced?.label || 'Advanced',
            description: overrides.advanced?.description || 'Experienced dancers',
            order: 3,
          },
        ];
        const customLevels = halau?.customClassLevels || [];
        return [...defaultLevels, ...customLevels].sort((a, b) => a.order - b.order);
      },

      // Title settings
      updateTitleSettings: (halauId, settings) => {
        set((state) => ({
          halaus: state.halaus.map((h) =>
            h.id === halauId
              ? {
                  ...h,
                  titleSettings: {
                    ...(h.titleSettings || { teacherTitle: 'Teacher', studentTitle: 'Student', adminTitle: 'Admin', guardianTitle: 'Parent/Guardian' }),
                    ...settings,
                  },
                }
              : h
          ),
        }));
      },

      getTitleSettings: (halauId) => {
        const halau = get().halaus.find((h) => h.id === halauId);
        return halau?.titleSettings || { teacherTitle: 'Teacher', studentTitle: 'Student', adminTitle: 'Admin', guardianTitle: 'Parent/Guardian' };
      },

      // Member actions
      addMember: (memberData) => {
        const { members: currentMembers } = get();

        // ── userId derivation ─────────────────────────────────────────────────
        // If the caller provides a real Firebase UID, use it directly.
        // If not (teacher adding a pre-registration member), derive a deterministic
        // sentinel userId from the email: "invite:<normalised-email>".
        // This satisfies the "userId always non-empty" requirement while still
        // making the record uniquely identifiable and linkable when the person
        // later creates a Firebase account and joins via invite code.
        const rawUserId = memberData.userId?.trim() ?? '';
        const resolvedEmail = memberData.email?.trim().toLowerCase() ?? '';
        const isPreRegistration = rawUserId === '';

        if (isPreRegistration && !resolvedEmail) {
          const err = 'addMember: cannot create a pre-registration member without an email (email is needed to derive a stable userId)';
          console.error(`[integrity] ${err}`, memberData);
          throw new Error(err);
        }

        // Registered member: id = userId = Firebase UID (deterministic, UID-based)
        // Pre-registration: id = userId = "invite:<email>" (deterministic, email-based)
        const resolvedUserId = isPreRegistration
          ? `invite:${resolvedEmail}`
          : rawUserId;
        const resolvedId = resolvedUserId; // Doc ID always equals userId

        const candidate = {
          ...memberData,
          id: resolvedId,
          userId: resolvedUserId,
          email: resolvedEmail || memberData.email?.trim() || '',
          isManual: isPreRegistration ? true : (memberData.isManual ?? false),
          joinedAt: new Date().toISOString(),
        };

        // Strict schema check — throws if any required field is missing
        assertMemberSchema(candidate, 'addMember');

        // Duplicate prevention: if this userId already exists in the school, update instead
        const existing = findExistingMember(currentMembers, resolvedUserId, candidate.halauId);
        if (existing) {
          console.warn(`[integrity] addMember: userId "${resolvedUserId}" already exists in school "${candidate.halauId}" as "${existing.id}" — updating instead of creating duplicate`);
          const updated = { ...existing, ...candidate, id: existing.id };
          set((state) => ({
            members: state.members.map((m) => m.id === existing.id ? updated : m),
          }));
          syncToBackend('PUT', `/api/user/school/${encodeURIComponent(existing.halauId)}/members/${encodeURIComponent(existing.id)}`, { ...updated });
          return updated;
        }

        const member: import('./types').Member = candidate;

        console.log('[store] addMember: writing member', {
          id: member.id,
          userId: member.userId,
          halauId: member.halauId,
          firstName: member.firstName,
          lastName: member.lastName,
          role: member.role,
          status: member.status,
          isManual: member.isManual,
        });

        set((state) => ({ members: [...state.members, member] }));

        syncToBackend('PUT', `/api/user/school/${encodeURIComponent(member.halauId)}/members/${encodeURIComponent(member.id)}`, {
          ...member,
        });

        return member;
      },

      updateMember: (id, updates) => {
        set((state) => ({
          members: state.members.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
          currentMember: state.currentMember?.id === id
            ? { ...state.currentMember, ...updates }
            : state.currentMember,
        }));

        // Sync to Firestore after local update
        const updatedMember = get().members.find((m) => m.id === id);
        if (updatedMember) {
          syncToBackend('PUT', `/api/user/school/${encodeURIComponent(updatedMember.halauId)}/members/${encodeURIComponent(id)}`, {
            ...updatedMember,
          });
        }
      },

      approveMember: (id) => {
        const { currentUser } = get();
        // Capture member identity BEFORE entering set() — state.members inside set() is the
        // pre-update snapshot, but calling find() there on every halauMemberships iteration
        // is O(n*m) and fragile if the member is missing. Look it up once here instead.
        const memberToApprove = get().members.find((m) => m.id === id);
        if (!memberToApprove) {
          console.error('[store] approveMember: member not found in state', { id });
          return;
        }
        const { userId: approveUserId, halauId: approveHalauId } = memberToApprove;
        set((state) => ({
          members: state.members.map((m) =>
            m.id === id
              ? { ...m, status: 'approved' as MemberStatus, approvedAt: new Date().toISOString(), approvedBy: currentUser?.id }
              : m
          ),
          halauMemberships: state.halauMemberships.map((hm) =>
            hm.userId === approveUserId && hm.halauId === approveHalauId
              ? { ...hm, status: 'approved' as MemberStatus }
              : hm
          ),
          currentMember: state.currentMember?.id === id
            ? { ...state.currentMember, status: 'approved' as MemberStatus, approvedAt: new Date().toISOString(), approvedBy: currentUser?.id }
            : state.currentMember,
        }));

        // Sync approval to Firestore
        const approvedMember = get().members.find((m) => m.id === id);
        if (approvedMember) {
          syncToBackend('PUT', `/api/user/school/${encodeURIComponent(approvedMember.halauId)}/members/${encodeURIComponent(id)}`, {
            ...approvedMember,
          });
        }
      },

      denyMember: (id) => {
        const memberToDeny = get().members.find((m) => m.id === id);
        if (!memberToDeny) {
          console.error('[store] denyMember: member not found in state', { id });
          return;
        }
        const { userId: denyUserId, halauId: denyHalauId } = memberToDeny;
        set((state) => ({
          members: state.members.map((m) =>
            m.id === id ? { ...m, status: 'denied' as MemberStatus } : m
          ),
          halauMemberships: state.halauMemberships.map((hm) =>
            hm.userId === denyUserId && hm.halauId === denyHalauId
              ? { ...hm, status: 'denied' as MemberStatus }
              : hm
          ),
        }));

        // Sync denial to Firestore
        const deniedMember = get().members.find((m) => m.id === id);
        if (deniedMember) {
          syncToBackend('PUT', `/api/user/school/${encodeURIComponent(deniedMember.halauId)}/members/${encodeURIComponent(id)}`, {
            ...deniedMember,
          });
        }
      },

      getMembersByHalau: (halauId) => {
        return get().members.filter((m) => m.halauId === halauId && m.status === 'approved');
      },

      getPendingMembers: (halauId) => {
        return get().members.filter((m) => m.halauId === halauId && m.status === 'pending');
      },

      getMember: (id) => {
        return get().members.find((m) => m.id === id);
      },

      getMemberByUserId: (userId, halauId) => {
        return get().members.find((m) => m.userId === userId && m.halauId === halauId);
      },

      removeMember: (id) => {
        const { members } = get();
        const member = members.find((m) => m.id === id);
        if (!member) return;

        // Remove the member and all associated data
        set((state) => ({
          // Remove the member
          members: state.members.filter((m) => m.id !== id && m.linkedToMemberId !== id),
          // Remove halau membership
          halauMemberships: state.halauMemberships.filter(
            (hm) => !(hm.userId === member.userId && hm.halauId === member.halauId)
          ),
          // Remove attendance records
          attendances: state.attendances.filter((a) => a.memberId !== id),
          // Remove RSVPs
          rsvps: state.rsvps.filter((r) => r.memberId !== id),
          // Remove payments
          payments: state.payments.filter((p) => p.memberId !== id),
          // Remove show participations
          showParticipations: state.showParticipations.filter((sp) => sp.memberId !== id),
          // Remove waiver signatures
          waiverSignatures: state.waiverSignatures.filter((ws) => ws.memberId !== id),
          // Remove chat messages sent by this member
          chatMessages: state.chatMessages.filter((cm) => cm.senderId !== id),
          // Remove member from chat channel member lists
          chatChannels: state.chatChannels.map((ch) => ({
            ...ch,
            memberIds: ch.memberIds.filter((mid) => mid !== id),
          })),
          // Remove notifications for this user
          notifications: state.notifications.filter((n) => n.userId !== member.userId),
          // Remove member dues
          memberDues: state.memberDues.filter((md) => md.memberId !== id),
          // Remove overdue expenses
          overdueExpenses: state.overdueExpenses.filter((oe) => oe.memberId !== id),
          // Remove financial transactions
          financialTransactions: state.financialTransactions.filter((ft) => ft.memberId !== id),
        }));

        // Sync deletion to Firestore
        syncToBackend('DELETE', `/api/user/school/${encodeURIComponent(member.halauId)}/members/${encodeURIComponent(id)}`);
      },

      addKeikiMember: (keiki) => {
        const { currentMember } = get();
        if (!currentMember) throw new Error('Not authenticated');

        if (!keiki.firstName?.trim() || !keiki.lastName?.trim()) {
          throw new Error('[integrity] addKeikiMember: firstName and lastName are required');
        }

        // Keiki (child members) never have Firebase accounts.
        // Use a deterministic "keiki:<uuid>" as both userId and doc ID so the
        // record is always non-empty, unique, and clearly typed.
        const keikiUuid = generateId();
        const keikiUserId = `keiki:${keikiUuid}`;

        const newKeiki: Member = {
          id: keikiUserId,         // Doc ID = userId (no separate random UUID)
          userId: keikiUserId,     // Always non-empty
          halauId: keiki.halauId,
          firstName: keiki.firstName.trim(),
          lastName: keiki.lastName.trim(),
          email: '',
          phone: '',
          role: 'student',
          memberType: 'new',
          membershipPlan: 'monthly',
          status: 'approved',
          classLevel: undefined,
          joinedAt: new Date().toISOString(),
          approvedAt: new Date().toISOString(),
          isKeiki: true,
          linkedToMemberId: currentMember.id,
          createdByMemberId: currentMember.id,
        };

        // Schema assertion — will throw if any required field is missing
        assertMemberSchema(newKeiki, 'addKeikiMember');

        console.log('[store] addKeikiMember: writing keiki member', {
          id: newKeiki.id,
          userId: newKeiki.userId,
          halauId: newKeiki.halauId,
          firstName: newKeiki.firstName,
          lastName: newKeiki.lastName,
          linkedToMemberId: newKeiki.linkedToMemberId,
        });

        set((state) => ({
          members: [...state.members, newKeiki],
        }));

        // Sync keiki to Firestore so teachers see them
        syncToBackend('PUT', `/api/user/school/${encodeURIComponent(keiki.halauId)}/members/${encodeURIComponent(newKeiki.id)}`, {
          ...newKeiki,
        });

        return newKeiki;
      },

      getKeikiByGuardian: (memberId) => {
        return get().members.filter((m) => m.isKeiki && m.linkedToMemberId === memberId);
      },

      canRemoveKeiki: (keikiId) => {
        const { currentMember, isKumu } = get();
        const keiki = get().members.find((m) => m.id === keikiId);

        if (!keiki || !keiki.isKeiki || !currentMember) return false;

        // Kumu/admin can always remove
        if (isKumu()) return true;

        // Creator can remove
        if (keiki.createdByMemberId === currentMember.id) return true;

        // Linked guardian can remove
        if (keiki.linkedToMemberId === currentMember.id) return true;

        return false;
      },

      // Event actions
      createEvent: (eventData) => {
        const { currentUser } = get();
        if (!currentUser) throw new Error('Not authenticated');

        const event: Event = {
          ...eventData,
          id: generateId(),
          createdBy: currentUser.id,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          events: [...state.events, event],
        }));

        syncToBackend('PUT', `/api/user/school/${encodeURIComponent(event.halauId)}/events/${encodeURIComponent(event.id)}`, {
          ...event,
        });

        return event;
      },

      createRecurringEvents: (eventData, pattern, endDate) => {
        const { currentUser } = get();
        if (!currentUser) throw new Error('Not authenticated');

        const recurringGroupId = generateId();
        const events: Event[] = [];

        // Parse the start date from the eventData.date string (YYYY-MM-DD format)
        const [startYear, startMonth, startDay] = eventData.date.split('-').map(Number);
        const startDate = new Date(startYear, startMonth - 1, startDay);

        // Parse end date
        const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
        const end = new Date(endYear, endMonth - 1, endDay);

        // Store the original day of week (0 = Sunday, 1 = Monday, etc.)
        const originalDayOfWeek = startDate.getDay();
        // Calculate which occurrence of this day in the month (1st, 2nd, 3rd, 4th, or 5th)
        const weekOfMonth = Math.ceil(startDate.getDate() / 7);

        let currentDate = new Date(startDate);

        // Helper function to format date as YYYY-MM-DD without timezone issues
        const formatDateString = (d: Date): string => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        while (currentDate <= end) {
          const event: Event = {
            ...eventData,
            id: generateId(),
            date: formatDateString(currentDate),
            createdBy: currentUser.id,
            createdAt: new Date().toISOString(),
            isRecurring: true,
            recurringPattern: pattern,
            recurringEndDate: endDate,
            recurringGroupId,
          };
          events.push(event);

          // Calculate next date based on pattern
          switch (pattern) {
            case 'daily':
              currentDate.setDate(currentDate.getDate() + 1);
              break;
            case 'weekly':
              currentDate.setDate(currentDate.getDate() + 7);
              break;
            case 'biweekly':
              currentDate.setDate(currentDate.getDate() + 14);
              break;
            case 'monthly':
              // For monthly, find the same occurrence of the same day of week in the next month
              // e.g., if event is on the 2nd Friday of January, find 2nd Friday of February
              const nextMonth = currentDate.getMonth() + 1;
              const nextYear = nextMonth > 11 ? currentDate.getFullYear() + 1 : currentDate.getFullYear();
              const adjustedMonth = nextMonth % 12;

              // Start at the first day of next month
              const nextMonthDate = new Date(nextYear, adjustedMonth, 1);

              // Find the first occurrence of the target day of week
              const firstDayOfNextMonth = nextMonthDate.getDay();
              let daysUntilTargetDay = originalDayOfWeek - firstDayOfNextMonth;
              if (daysUntilTargetDay < 0) daysUntilTargetDay += 7;

              // Set to the nth occurrence of that day
              const targetDay = 1 + daysUntilTargetDay + (weekOfMonth - 1) * 7;

              // Check if this day exists in the month (handle cases like 5th Friday)
              const tentativeDate = new Date(nextYear, adjustedMonth, targetDay);

              if (tentativeDate.getMonth() === adjustedMonth) {
                // The date is valid
                currentDate = tentativeDate;
              } else {
                // The nth occurrence doesn't exist (e.g., no 5th Friday this month)
                // Fall back to the last occurrence of that day in the month
                const lastDayOfMonth = new Date(nextYear, adjustedMonth + 1, 0).getDate();
                const lastOfMonth = new Date(nextYear, adjustedMonth, lastDayOfMonth);
                const lastDay = lastOfMonth.getDay();
                let daysBack = lastDay - originalDayOfWeek;
                if (daysBack < 0) daysBack += 7;
                currentDate = new Date(nextYear, adjustedMonth, lastDayOfMonth - daysBack);
              }
              break;
          }
        }

        set((state) => ({
          events: [...state.events, ...events],
        }));

        // Sync all recurring events to Firestore
        for (const ev of events) {
          syncToBackend('PUT', `/api/user/school/${encodeURIComponent(ev.halauId)}/events/${encodeURIComponent(ev.id)}`, {
            ...ev,
          });
        }

        return events;
      },

      updateEvent: (id, updates) => {
        set((state) => ({
          events: state.events.map((e) =>
            e.id === id ? { ...e, ...updates } : e
          ),
        }));

        const updatedEvent = get().events.find((e) => e.id === id);
        if (updatedEvent) {
          syncToBackend('PUT', `/api/user/school/${encodeURIComponent(updatedEvent.halauId)}/events/${encodeURIComponent(id)}`, {
            ...updatedEvent,
          });
        }
      },

      deleteEvent: (id) => {
        const eventToDelete = get().events.find((e) => e.id === id);
        set((state) => ({
          events: state.events.filter((e) => e.id !== id),
          attendances: state.attendances.filter((a) => a.eventId !== id),
          rsvps: state.rsvps.filter((r) => r.eventId !== id),
        }));

        if (eventToDelete) {
          syncToBackend('DELETE', `/api/user/school/${encodeURIComponent(eventToDelete.halauId)}/events/${encodeURIComponent(id)}`);
        }
      },

      deleteRecurringSeries: (recurringGroupId, fromDate) => {
        // Collect events to delete before removing them
        const eventsToDelete = get().events.filter((e) => {
          if (e.recurringGroupId !== recurringGroupId) return false;
          if (fromDate) return e.date >= fromDate;
          return true;
        });

        set((state) => ({
          events: state.events.filter((e) => {
            if (e.recurringGroupId !== recurringGroupId) return true;
            if (fromDate) return e.date < fromDate;
            return false;
          }),
          attendances: state.attendances.filter((a) => {
            const event = state.events.find((e) => e.id === a.eventId);
            if (!event || event.recurringGroupId !== recurringGroupId) return true;
            if (fromDate) return event.date < fromDate;
            return false;
          }),
          rsvps: state.rsvps.filter((r) => {
            const event = state.events.find((e) => e.id === r.eventId);
            if (!event || event.recurringGroupId !== recurringGroupId) return true;
            if (fromDate) return event.date < fromDate;
            return false;
          }),
        }));

        for (const ev of eventsToDelete) {
          syncToBackend('DELETE', `/api/user/school/${encodeURIComponent(ev.halauId)}/events/${encodeURIComponent(ev.id)}`);
        }
      },

      updateRecurringSeries: (recurringGroupId, updates, fromDate) => {
        set((state) => ({
          events: state.events.map((e) => {
            if (e.recurringGroupId !== recurringGroupId) return e;
            if (fromDate && e.date < fromDate) return e;
            const { date, ...safeUpdates } = updates;
            return { ...e, ...safeUpdates };
          }),
        }));

        // Sync all updated events
        const updatedEvents = get().events.filter((e) => {
          if (e.recurringGroupId !== recurringGroupId) return false;
          if (fromDate) return e.date >= fromDate;
          return true;
        });
        for (const ev of updatedEvents) {
          syncToBackend('PUT', `/api/user/school/${encodeURIComponent(ev.halauId)}/events/${encodeURIComponent(ev.id)}`, {
            ...ev,
          });
        }
      },

      cancelEvent: (id) => {
        set((state) => ({
          events: state.events.map((e) =>
            e.id === id ? { ...e, isCancelled: true } : e
          ),
        }));

        const cancelledEvent = get().events.find((e) => e.id === id);
        if (cancelledEvent) {
          syncToBackend('PUT', `/api/user/school/${encodeURIComponent(cancelledEvent.halauId)}/events/${encodeURIComponent(id)}`, {
            ...cancelledEvent,
          });
        }
      },

      getEventsByHalau: (halauId) => {
        return get().events.filter((e) => e.halauId === halauId && !e.isCancelled);
      },

      getUpcomingEvents: (halauId) => {
        const now = new Date().toISOString();
        return get()
          .events.filter((e) => e.halauId === halauId && e.date >= now.split('T')[0] && !e.isCancelled)
          .sort((a, b) => a.date.localeCompare(b.date));
      },

      getEvent: (id) => {
        return get().events.find((e) => e.id === id);
      },

      // Attendance actions
      markAttendance: (eventId, memberId, status) => {
        const { currentUser, attendances } = get();
        if (!currentUser) return;

        const existing = attendances.find((a) => a.eventId === eventId && a.memberId === memberId);

        if (existing) {
          set((state) => ({
            attendances: state.attendances.map((a) =>
              a.id === existing.id ? { ...a, status, markedAt: new Date().toISOString() } : a
            ),
          }));

          // Find the halauId from the event
          const event = get().events.find((e) => e.id === eventId);
          if (event) {
            syncToBackend('PUT', `/api/user/school/${encodeURIComponent(event.halauId)}/attendance/${encodeURIComponent(existing.id)}`, {
              ...existing, status, markedAt: new Date().toISOString(),
            });
          }
        } else {
          const attendance: Attendance = {
            id: generateId(),
            eventId,
            memberId,
            status,
            markedAt: new Date().toISOString(),
            markedBy: currentUser.id,
          };

          set((state) => ({
            attendances: [...state.attendances, attendance],
          }));

          const event = get().events.find((e) => e.id === eventId);
          if (event) {
            syncToBackend('PUT', `/api/user/school/${encodeURIComponent(event.halauId)}/attendance/${encodeURIComponent(attendance.id)}`, {
              ...attendance,
            });
          }
        }
      },

      getAttendanceByEvent: (eventId) => {
        return get().attendances.filter((a) => a.eventId === eventId);
      },

      getAttendanceByMember: (memberId) => {
        return get().attendances.filter((a) => a.memberId === memberId);
      },

      // RSVP actions
      updateRSVP: (eventId, status) => {
        const { currentMember, rsvps } = get();
        if (!currentMember) return;

        const existing = rsvps.find((r) => r.eventId === eventId && r.memberId === currentMember.id);

        if (existing) {
          set((state) => ({
            rsvps: state.rsvps.map((r) =>
              r.id === existing.id ? { ...r, status, updatedAt: new Date().toISOString() } : r
            ),
          }));
        } else {
          const rsvp: RSVP = {
            id: generateId(),
            eventId,
            memberId: currentMember.id,
            status,
            updatedAt: new Date().toISOString(),
          };

          set((state) => ({
            rsvps: [...state.rsvps, rsvp],
          }));
        }
      },

      getRSVPsByEvent: (eventId) => {
        return get().rsvps.filter((r) => r.eventId === eventId);
      },

      getMemberRSVP: (eventId, memberId) => {
        return get().rsvps.find((r) => r.eventId === eventId && r.memberId === memberId);
      },

      // Payment actions
      recordPayment: (paymentData) => {
        const { currentUser } = get();
        if (!currentUser) throw new Error('Not authenticated');

        // Guard: reject obviously invalid amounts before they reach the backend.
        if (!Number.isFinite(paymentData.amount) || paymentData.amount < 0) {
          throw new Error(`Invalid payment amount: ${paymentData.amount}`);
        }

        const payment: Payment = {
          ...paymentData,
          id: generateId(),
          recordedBy: currentUser.id,
          recordedAt: new Date().toISOString(),
        };

        set((state) => ({
          payments: [...state.payments, payment],
        }));

        syncToBackend('PUT', `/api/user/school/${encodeURIComponent(payment.halauId)}/payments/${encodeURIComponent(payment.id)}`, {
          ...payment,
        });

        return payment;
      },

      updatePayment: (id, updates) => {
        set((state) => ({
          payments: state.payments.map((p) =>
            p.id === id ? { ...p, ...updates } : p
          ),
        }));

        const updatedPayment = get().payments.find((p) => p.id === id);
        if (updatedPayment) {
          syncToBackend('PUT', `/api/user/school/${encodeURIComponent(updatedPayment.halauId)}/payments/${encodeURIComponent(id)}`, {
            ...updatedPayment,
          });
        }
      },

      getPaymentsByHalau: (halauId) => {
        return get().payments.filter((p) => p.halauId === halauId);
      },

      getPaymentsByMember: (memberId) => {
        return get().payments.filter((p) => p.memberId === memberId);
      },

      getPendingPayments: (halauId) => {
        return get().payments.filter(
          (p) => p.halauId === halauId && (p.status === 'pending' || p.status === 'overdue')
        );
      },

      getPaymentStats: (halauId) => {
        const payments = get().payments.filter((p) => p.halauId === halauId);
        return {
          totalPaid: payments.filter((p) => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0),
          totalPending: payments.filter((p) => p.status === 'pending' || p.status === 'partial').reduce((sum, p) => sum + p.amount, 0),
          totalOverdue: payments.filter((p) => p.status === 'overdue').reduce((sum, p) => sum + p.amount, 0),
        };
      },

      // Show actions
      createShow: (showData) => {
        const { currentUser } = get();
        if (!currentUser) throw new Error('Not authenticated');

        const show: Show = {
          ...showData,
          id: generateId(),
          createdBy: currentUser.id,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          shows: [...state.shows, show],
        }));

        return show;
      },

      updateShow: (id, updates) => {
        set((state) => ({
          shows: state.shows.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        }));
      },

      deleteShow: (id) => {
        set((state) => ({
          shows: state.shows.filter((s) => s.id !== id),
          showParticipations: state.showParticipations.filter((sp) => sp.showId !== id),
        }));
      },

      getShowsByHalau: (halauId) => {
        return get().shows.filter((s) => s.halauId === halauId);
      },

      addShowParticipant: (showId, memberId, role) => {
        const existing = get().showParticipations.find(
          (sp) => sp.showId === showId && sp.memberId === memberId
        );
        if (existing) return;

        const participation: ShowParticipation = {
          id: generateId(),
          showId,
          memberId,
          role,
          addedAt: new Date().toISOString(),
        };

        set((state) => ({
          showParticipations: [...state.showParticipations, participation],
        }));
      },

      removeShowParticipant: (showId, memberId) => {
        set((state) => ({
          showParticipations: state.showParticipations.filter(
            (sp) => !(sp.showId === showId && sp.memberId === memberId)
          ),
        }));
      },

      getShowParticipants: (showId) => {
        return get().showParticipations.filter((sp) => sp.showId === showId);
      },

      // Video actions
      addVideo: async (videoData) => {
        const { currentUser } = get();
        if (!currentUser) throw new Error('Not authenticated');

        // Duplicate guard — if this id was already added optimistically, return it
        const existing = get().videos.find(
          (v) => v.halauId === videoData.halauId && v.url === videoData.url && v.title === videoData.title
        );
        if (existing) return existing;

        const video: Video = {
          ...videoData,
          id: generateId(),
          uploadedBy: currentUser.id,
          uploadedAt: new Date().toISOString(),
        };

        // Optimistic add
        set((state) => ({ videos: [...state.videos, video] }));

        // Persist to Firestore — rollback if backend permanently rejects
        const ok = await syncToBackendResult(
          'PUT',
          `/api/user/school/${encodeURIComponent(videoData.halauId)}/videos/${encodeURIComponent(video.id)}`,
          { ...video }
        );
        if (!ok) {
          console.error('[store] addVideo: backend write failed — rolling back local add', video.id);
          set((state) => ({ videos: state.videos.filter((v) => v.id !== video.id) }));
          throw new Error('Failed to save video. Please check your connection and try again.');
        }

        return video;
      },

      updateVideo: (id, updates) => {
        set((state) => ({
          videos: state.videos.map((v) =>
            v.id === id ? { ...v, ...updates } : v
          ),
        }));
      },

      deleteVideo: async (id) => {
        const videoToDelete = get().videos.find((v) => v.id === id);
        if (!videoToDelete) return;

        // Optimistic remove
        set((state) => ({ videos: state.videos.filter((v) => v.id !== id) }));

        // Persist deletion — rollback if backend permanently rejects
        if (videoToDelete.halauId) {
          const ok = await syncToBackendResult(
            'DELETE',
            `/api/user/school/${encodeURIComponent(videoToDelete.halauId)}/videos/${encodeURIComponent(id)}`
          );
          if (!ok) {
            console.error('[store] deleteVideo: backend delete failed — restoring video', id);
            set((state) => ({ videos: [...state.videos, videoToDelete] }));
          }
        }
      },

      getVideosByHalau: (halauId) => {
        const { currentMember } = get();
        return get().videos.filter(
          (v) => v.halauId === halauId && (!currentMember || v.accessRoles.includes(currentMember.role))
        );
      },

      getVideosByCategory: (halauId, category) => {
        const { currentMember } = get();
        return get().videos.filter(
          (v) =>
            v.halauId === halauId &&
            v.category === category &&
            (!currentMember || v.accessRoles.includes(currentMember.role))
        );
      },

      // Waiver actions
      createWaiver: (waiverData) => {
        const { currentUser } = get();
        if (!currentUser) throw new Error('Not authenticated');

        const waiver: Waiver = {
          ...waiverData,
          id: generateId(),
          createdBy: currentUser.id,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          waivers: [...state.waivers, waiver],
        }));

        return waiver;
      },

      signWaiver: (waiverId, signatureData) => {
        const { currentMember, waivers } = get();
        if (!currentMember) return;

        const waiver = waivers.find((w) => w.id === waiverId);
        const expiresAt = waiver?.expiresInDays
          ? new Date(Date.now() + waiver.expiresInDays * 86400000).toISOString()
          : undefined;

        const signature: WaiverSignature = {
          id: generateId(),
          waiverId,
          memberId: currentMember.id,
          signedAt: new Date().toISOString(),
          signatureData,
          expiresAt,
          status: 'signed',
        };

        set((state) => ({
          waiverSignatures: [...state.waiverSignatures, signature],
        }));
      },

      getWaiversByHalau: (halauId) => {
        return get().waivers.filter((w) => w.halauId === halauId);
      },

      getMemberWaiverStatus: (memberId) => {
        return get().waiverSignatures.filter((ws) => ws.memberId === memberId);
      },

      getWaiverSignatures: (waiverId) => {
        return get().waiverSignatures.filter((ws) => ws.waiverId === waiverId);
      },

      // Chat actions
      createChannel: (channelData) => {
        const { currentUser } = get();
        if (!currentUser) throw new Error('Not authenticated');

        const channel: ChatChannel = {
          ...channelData,
          id: generateId(),
          createdBy: currentUser.id,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          chatChannels: [...state.chatChannels, channel],
        }));

        return channel;
      },

      updateChannel: (channelId, updates) => {
        set((state) => ({
          chatChannels: state.chatChannels.map((c) =>
            c.id === channelId ? { ...c, ...updates } : c
          ),
        }));
      },

      deleteChannel: (channelId) => {
        set((state) => ({
          chatChannels: state.chatChannels.filter((c) => c.id !== channelId),
          chatMessages: state.chatMessages.filter((m) => m.channelId !== channelId),
        }));
      },

      sendMessage: (channelId, text, attachment, mentions, poll, isPrivate, privateRecipients, replyToMessageId) => {
        const { currentMember } = get();
        if (!currentMember) throw new Error('Not authenticated');

        const message: ChatMessage = {
          id: generateId(),
          channelId,
          senderId: currentMember.id,
          text,
          sentAt: new Date().toISOString(),
          readBy: [currentMember.id],
          ...(attachment && { attachment }),
          ...(mentions && mentions.length > 0 && { mentions }),
          ...(poll && { poll }),
          ...(isPrivate && { isPrivate }),
          ...(privateRecipients && privateRecipients.length > 0 && { privateRecipients }),
          ...(replyToMessageId && { replyToMessageId }),
        };

        set((state) => ({
          chatMessages: [...state.chatMessages, message],
        }));

        return message;
      },

      deleteMessage: (messageId) => {
        set((state) => ({
          chatMessages: state.chatMessages.filter((m) => m.id !== messageId),
        }));
      },

      updateMessage: (messageId, updates) => {
        set((state) => ({
          chatMessages: state.chatMessages.map((m) =>
            m.id === messageId ? { ...m, ...updates } : m
          ),
        }));
      },

      mergeChatMessages: (incoming) => {
        if (!incoming.length) return;
        set((state) => {
          // Upsert: update existing messages AND append new ones.
          // Pure insert-only (old behavior) silently drops server-side edits for messages
          // already in the local cache — the incoming record was filtered out as a "duplicate".
          const merged = [...state.chatMessages];
          const existingMap = new Map(state.chatMessages.map((m, i) => [m.id, i]));
          let changed = false;
          for (const msg of incoming) {
            const idx = existingMap.get(msg.id);
            if (idx !== undefined) {
              // Replace if incoming is the same or newer version (by sentAt)
              const existingTime = merged[idx].sentAt ? new Date(merged[idx].sentAt).getTime() : 0;
              const incomingTime = msg.sentAt ? new Date(msg.sentAt).getTime() : 0;
              if (incomingTime >= existingTime) {
                merged[idx] = msg;
                changed = true;
              }
            } else {
              merged.push(msg);
              changed = true;
            }
          }
          if (!changed) return state;
          // Sort ascending by sentAt, with id as tie-breaker for stability
          merged.sort((a, b) => {
            const ta = a.sentAt ? new Date(a.sentAt).getTime() : 0;
            const tb = b.sentAt ? new Date(b.sentAt).getTime() : 0;
            if (ta !== tb) return ta - tb;
            return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
          });
          return { chatMessages: merged };
        });
      },

      markMessageRead: (messageId) => {
        const { currentMember } = get();
        if (!currentMember) return;

        set((state) => ({
          chatMessages: state.chatMessages.map((m) =>
            m.id === messageId && !m.readBy.includes(currentMember.id)
              ? { ...m, readBy: [...m.readBy, currentMember.id] }
              : m
          ),
        }));
      },

      pinMessage: (channelId, messageId) => {
        set((state) => ({
          chatChannels: state.chatChannels.map((c) => {
            if (c.id !== channelId) return c;
            const pinnedIds = c.pinnedMessageIds || [];
            if (pinnedIds.includes(messageId)) return c;
            return { ...c, pinnedMessageIds: [...pinnedIds, messageId] };
          }),
        }));
      },

      unpinMessage: (channelId, messageId) => {
        set((state) => ({
          chatChannels: state.chatChannels.map((c) => {
            if (c.id !== channelId) return c;
            return {
              ...c,
              pinnedMessageIds: (c.pinnedMessageIds || []).filter((id) => id !== messageId),
            };
          }),
        }));
      },

      getChannelsByHalau: (halauId) => {
        const { currentMember } = get();
        return get().chatChannels.filter(
          (c) =>
            c.halauId === halauId &&
            (c.type === 'halau' || (currentMember && c.memberIds.includes(currentMember.id)))
        );
      },

      getChannelMessages: (channelId) => {
        return get()
          .chatMessages.filter((m) => m.channelId === channelId)
          .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
      },

      getUnreadCount: (channelId) => {
        const { currentMember, chatMessages } = get();
        if (!currentMember) return 0;

        return chatMessages.filter(
          (m) => m.channelId === channelId && !m.readBy.includes(currentMember.id)
        ).length;
      },

      addReaction: (messageId, emoji) => {
        const { currentMember } = get();
        if (!currentMember) return;

        set((state) => ({
          chatMessages: state.chatMessages.map((m) => {
            if (m.id !== messageId) return m;

            const reactions = m.reactions || [];
            const existingReaction = reactions.find((r) => r.emoji === emoji);

            if (existingReaction) {
              // Check if user already reacted with this emoji
              if (existingReaction.memberIds.includes(currentMember.id)) {
                return m; // Already reacted, do nothing
              }
              // Add user to existing reaction
              return {
                ...m,
                reactions: reactions.map((r) =>
                  r.emoji === emoji
                    ? { ...r, memberIds: [...r.memberIds, currentMember.id] }
                    : r
                ),
              };
            } else {
              // Create new reaction
              return {
                ...m,
                reactions: [...reactions, { emoji, memberIds: [currentMember.id] }],
              };
            }
          }),
        }));
      },

      removeReaction: (messageId, emoji) => {
        const { currentMember } = get();
        if (!currentMember) return;

        set((state) => ({
          chatMessages: state.chatMessages.map((m) => {
            if (m.id !== messageId) return m;

            const reactions = m.reactions || [];
            const updatedReactions = reactions
              .map((r) =>
                r.emoji === emoji
                  ? { ...r, memberIds: r.memberIds.filter((id) => id !== currentMember.id) }
                  : r
              )
              .filter((r) => r.memberIds.length > 0);

            return { ...m, reactions: updatedReactions };
          }),
        }));
      },

      votePoll: (messageId, optionId) => {
        const { currentMember } = get();
        if (!currentMember) return;

        set((state) => ({
          chatMessages: state.chatMessages.map((m) => {
            if (m.id !== messageId || !m.poll) return m;

            // Check if poll has expired
            if (m.poll.expiresAt && new Date(m.poll.expiresAt) < new Date()) {
              return m;
            }

            // For single vote polls, allow changing vote by removing from all options first
            if (!m.poll.allowMultiple) {
              return {
                ...m,
                poll: {
                  ...m.poll,
                  options: m.poll.options.map((opt) => {
                    // Remove vote from all options first
                    const votesWithoutUser = opt.votes.filter((v) => v !== currentMember.id);
                    // Add vote to selected option
                    if (opt.id === optionId) {
                      return { ...opt, votes: [...votesWithoutUser, currentMember.id] };
                    }
                    return { ...opt, votes: votesWithoutUser };
                  }),
                },
              };
            }

            // For multiple vote polls, toggle the vote
            return {
              ...m,
              poll: {
                ...m.poll,
                options: m.poll.options.map((opt) =>
                  opt.id === optionId
                    ? opt.votes.includes(currentMember.id)
                      ? { ...opt, votes: opt.votes.filter((v) => v !== currentMember.id) }
                      : { ...opt, votes: [...opt.votes, currentMember.id] }
                    : opt
                ),
              },
            };
          }),
        }));
      },

      // Notification actions
      addNotification: (notificationData) => {
        const notification: Notification = {
          ...notificationData,
          id: generateId(),
          read: false,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          notifications: [...state.notifications, notification],
        }));
      },

      markNotificationRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        }));
      },

      getUnreadNotifications: () => {
        const { currentUser, notifications } = get();
        if (!currentUser) return [];
        return notifications.filter((n) => n.userId === currentUser.id && !n.read);
      },

      clearNotifications: () => {
        const { currentUser } = get();
        if (!currentUser) return;

        set((state) => ({
          notifications: state.notifications.filter((n) => n.userId !== currentUser.id),
        }));
      },

      // Financial Management actions
      createOrganizationDues: (duesData) => {
        const { currentUser, currentMember } = get();
        if (!currentUser || !currentMember) throw new Error('Not authenticated');
        if (currentMember.role !== 'teacher' && currentMember.role !== 'admin') {
          throw new Error('Only teachers and admins can create organization dues');
        }

        const dues: OrganizationDues = {
          ...duesData,
          id: generateId(),
          createdBy: currentUser.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({
          organizationDues: [...state.organizationDues, dues],
        }));

        return dues;
      },

      updateOrganizationDues: (id, updates) => {
        const { currentMember } = get();
        if (!currentMember || (currentMember.role !== 'teacher' && currentMember.role !== 'admin')) {
          throw new Error('Only teachers and admins can update organization dues');
        }

        set((state) => ({
          organizationDues: state.organizationDues.map((d) =>
            d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
          ),
        }));
      },

      deleteOrganizationDues: (id) => {
        const { currentMember } = get();
        if (!currentMember || (currentMember.role !== 'teacher' && currentMember.role !== 'admin')) {
          throw new Error('Only teachers and admins can delete organization dues');
        }

        set((state) => {
          const deletedMemberDueIds = new Set(
            state.memberDues.filter((d) => d.duesId === id).map((d) => d.id)
          );
          return {
            organizationDues: state.organizationDues.filter((d) => d.id !== id),
            memberDues: state.memberDues.filter((d) => d.duesId !== id),
            pendingPaymentSubmissions: state.pendingPaymentSubmissions.filter(
              (s) => !deletedMemberDueIds.has(s.memberDueId)
            ),
            financialTransactions: state.financialTransactions.filter(
              (t) => !deletedMemberDueIds.has(t.reference ?? '')
            ),
          };
        });
      },

      getOrganizationDuesByHalau: (halauId) => {
        return get().organizationDues.filter((d) => d.halauId === halauId);
      },

      createMemberDue: (dueData) => {
        const { currentUser, currentMember } = get();
        if (!currentUser || !currentMember) throw new Error('Not authenticated');
        if (currentMember.role !== 'teacher' && currentMember.role !== 'admin') {
          throw new Error('Only teachers and admins can create member dues');
        }

        const due: MemberDue = {
          ...dueData,
          id: generateId(),
          createdBy: currentUser.id,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          memberDues: [...state.memberDues, due],
        }));

        syncToBackend('PUT', `/api/user/school/${encodeURIComponent(due.halauId)}/member-dues/${encodeURIComponent(due.id)}`, { ...due });
        const member = get().members.find((m) => m.id === dueData.memberId);
        if (member && member.userId) {
          get().addNotification({
            userId: member.userId,
            title: 'New Payment Due',
            body: `You have a new ${dueData.name} payment of $${dueData.amount} due on ${new Date(dueData.dueDate).toLocaleDateString()}`,
            type: 'payment',
            data: { memberDueId: due.id },
          });
        }

        return due;
      },

      updateMemberDue: (id, updates) => {
        const { currentMember } = get();
        if (!currentMember || (currentMember.role !== 'teacher' && currentMember.role !== 'admin')) {
          throw new Error('Only teachers and admins can update member dues');
        }

        set((state) => ({
          memberDues: state.memberDues.map((d) =>
            d.id === id ? { ...d, ...updates } : d
          ),
        }));
      },

      deleteMemberDue: (id) => {
        const { currentMember } = get();
        if (!currentMember || (currentMember.role !== 'teacher' && currentMember.role !== 'admin')) {
          throw new Error('Only teachers and admins can delete member dues');
        }

        set((state) => ({
          memberDues: state.memberDues.filter((d) => d.id !== id),
          // Also remove any pending payment submissions for this due
          pendingPaymentSubmissions: state.pendingPaymentSubmissions.filter((s) => s.memberDueId !== id),
          // Remove any financial transactions that reference this due
          financialTransactions: state.financialTransactions.filter((t) => t.reference !== id),
        }));
      },

      recordDuesPayment: (memberDueId, amount, method, notes, invoiceNumber) => {
        const { currentUser, currentMember, memberDues, members } = get();
        if (!currentUser || !currentMember) throw new Error('Not authenticated');
        if (currentMember.role !== 'teacher' && currentMember.role !== 'admin') {
          throw new Error('Only teachers and admins can record payments');
        }

        const memberDue = memberDues.find((d) => d.id === memberDueId);
        if (!memberDue) throw new Error('Member due not found');

        const newAmountPaid = memberDue.amountPaid + amount;
        const newStatus: FinancialStatus = newAmountPaid >= memberDue.amount ? 'paid' : 'partial';

        // Update member due
        set((state) => ({
          memberDues: state.memberDues.map((d) =>
            d.id === memberDueId
              ? {
                  ...d,
                  amountPaid: newAmountPaid,
                  status: newStatus,
                  paidAt: newStatus === 'paid' ? new Date().toISOString() : d.paidAt,
                  notes: notes ? `${d.notes || ''} ${notes}`.trim() : d.notes,
                }
              : d
          ),
        }));

        // Create transaction record
        const transaction: FinancialTransaction = {
          id: generateId(),
          halauId: memberDue.halauId,
          memberId: memberDue.memberId,
          type: 'payment',
          amount,
          category: memberDue.category,
          method,
          reference: memberDueId,
          invoiceNumber: invoiceNumber?.trim() || undefined,
          notes,
          processedBy: currentUser.id,
          processedAt: new Date().toISOString(),
        };

        set((state) => ({
          financialTransactions: [...state.financialTransactions, transaction],
        }));

        // Notify member of payment received
        const member = members.find((m) => m.id === memberDue.memberId);
        if (member && member.userId) {
          get().addNotification({
            userId: member.userId,
            title: 'Payment Received',
            body: `Your payment of $${amount} for ${memberDue.name} has been recorded. ${newStatus === 'paid' ? 'Fully paid!' : `Remaining: $${memberDue.amount - newAmountPaid}`}`,
            type: 'payment',
            data: { memberDueId },
          });
        }
      },

      getMemberDuesByHalau: (halauId) => {
        return get().memberDues.filter((d) => d.halauId === halauId);
      },

      getMemberDuesByMember: (memberId) => {
        return get().memberDues.filter((d) => d.memberId === memberId);
      },

      getOverdueMemberDues: (halauId) => {
        const today = new Date();
        // A payment is overdue 5 days after the scheduled due date
        const overdueThreshold = new Date(today);
        overdueThreshold.setDate(overdueThreshold.getDate() - 5);
        const overdueThresholdStr = overdueThreshold.toISOString().split('T')[0];

        return get().memberDues.filter(
          (d) => d.halauId === halauId && d.status !== 'paid' && d.dueDate < overdueThresholdStr
        );
      },

      assignDuesToMembers: (duesId, memberIds, dueDate, recurringOptions) => {
        const { currentUser, currentMember, organizationDues, memberDues: existingMemberDues } = get();
        if (!currentUser || !currentMember) throw new Error('Not authenticated');
        if (currentMember.role !== 'teacher' && currentMember.role !== 'admin') {
          throw new Error('Only teachers and admins can assign dues');
        }

        const orgDues = organizationDues.find((d) => d.id === duesId);
        if (!orgDues) throw new Error('Organization dues not found');

        const recurringGroupId = recurringOptions?.isRecurring ? generateId() : undefined;

        // Parse the due date
        const [year, month, day] = dueDate.split('-').map(Number);
        const startDate = new Date(year, month - 1, day);
        const recurringDay = recurringOptions?.isRecurring
          ? (recurringOptions.frequency === 'weekly' || recurringOptions.frequency === 'biweekly'
              ? startDate.getDay()
              : startDate.getDate())
          : undefined;

        // Generate all due dates for recurring payments
        const dueDates: string[] = [dueDate];

        if (recurringOptions?.isRecurring && recurringOptions.endDate) {
          const [endYear, endMonth, endDay] = recurringOptions.endDate.split('-').map(Number);
          const endDate = new Date(endYear, endMonth - 1, endDay);
          let currentDate = new Date(startDate);

          // Calculate next dates based on frequency
          while (true) {
            switch (recurringOptions.frequency) {
              case 'weekly':
                currentDate.setDate(currentDate.getDate() + 7);
                break;
              case 'biweekly':
                currentDate.setDate(currentDate.getDate() + 14);
                break;
              case 'monthly':
                // For monthly, try to land on the same day of the month
                const originalDay = startDate.getDate();
                currentDate.setMonth(currentDate.getMonth() + 1);
                // Handle months with fewer days
                const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
                currentDate.setDate(Math.min(originalDay, daysInMonth));
                break;
            }

            if (currentDate > endDate) break;

            const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
            dueDates.push(dateStr);
          }
        }

        // Create member dues for all members and all dates, but skip duplicates
        const newMemberDues: MemberDue[] = [];

        memberIds.forEach((memberId) => {
          dueDates.forEach((date) => {
            // Check if this member already has this dues assignment for this date
            const existingDue = existingMemberDues.find(
              (md) => md.duesId === duesId && md.memberId === memberId && md.dueDate === date
            );

            // Only create new entry if it doesn't already exist
            if (!existingDue) {
              newMemberDues.push({
                id: generateId(),
                halauId: orgDues.halauId,
                memberId,
                duesId,
                category: orgDues.category,
                name: orgDues.name,
                amount: orgDues.amount,
                amountPaid: 0,
                status: 'pending' as FinancialStatus,
                dueDate: date,
                createdBy: currentUser.id,
                createdAt: new Date().toISOString(),
                // Recurring payment fields
                isRecurring: recurringOptions?.isRecurring,
                recurringFrequency: recurringOptions?.frequency,
                recurringDay,
                recurringEndDate: recurringOptions?.endDate,
                recurringGroupId,
              });
            }
          });
        });

        // Only add new dues if there are any (skip if all were duplicates)
        if (newMemberDues.length > 0) {
          set((state) => ({
            memberDues: [...state.memberDues, ...newMemberDues],
          }));

          // Notify only members who received NEW assignments (not duplicates)
          const { members } = get();
          const newlyAssignedMemberIds = [...new Set(newMemberDues.map((md) => md.memberId))];
          newlyAssignedMemberIds.forEach((memberId) => {
            const member = members.find((m) => m.id === memberId);
            if (member && member.userId) {
              const recurringText = recurringOptions?.isRecurring
                ? ` (recurring ${recurringOptions.frequency})`
                : '';
              get().addNotification({
                userId: member.userId,
                title: 'New Payment Due',
                body: `You have a new ${orgDues.name} payment of $${orgDues.amount} due on ${new Date(dueDate).toLocaleDateString()}${recurringText}`,
                type: 'payment',
              });
            }
          });
        }
      },

      createOverdueExpense: (expenseData) => {
        const { currentUser } = get();
        if (!currentUser) throw new Error('Not authenticated');

        const expense: OverdueExpense = {
          ...expenseData,
          id: generateId(),
          requestedBy: currentUser.id,
          requestedAt: new Date().toISOString(),
        };

        set((state) => ({
          overdueExpenses: [...state.overdueExpenses, expense],
        }));

        // Notify teachers/admins of pending approval
        const { members, halaus } = get();
        const halau = halaus.find((h) => h.id === expenseData.halauId);
        const admins = members.filter(
          (m) => m.halauId === expenseData.halauId && (m.role === 'teacher' || m.role === 'admin')
        );

        admins.forEach((admin) => {
          if (admin.userId) {
            get().addNotification({
              userId: admin.userId,
              title: 'Expense Approval Needed',
              body: `A new expense reimbursement of $${expenseData.amount} needs your approval`,
              type: 'payment',
              data: { expenseId: expense.id },
            });
          }
        });

        return expense;
      },

      approveOverdueExpense: (id) => {
        const { currentUser, currentMember } = get();
        if (!currentUser || !currentMember) throw new Error('Not authenticated');
        if (currentMember.role !== 'teacher' && currentMember.role !== 'admin') {
          throw new Error('Only teachers and admins can approve expenses');
        }

        set((state) => ({
          overdueExpenses: state.overdueExpenses.map((e) =>
            e.id === id
              ? {
                  ...e,
                  status: 'approved' as const,
                  approvedBy: currentUser.id,
                  approvedAt: new Date().toISOString(),
                }
              : e
          ),
        }));

        // Notify member their expense was approved
        const expense = get().overdueExpenses.find((e) => e.id === id);
        const member = get().members.find((m) => m.id === expense?.memberId);
        if (member && member.userId) {
          get().addNotification({
            userId: member.userId,
            title: 'Expense Approved',
            body: `Your expense reimbursement of $${expense?.amount} has been approved and will be released soon`,
            type: 'payment',
            data: { expenseId: id },
          });
        }
      },

      denyOverdueExpense: (id, notes) => {
        const { currentUser, currentMember } = get();
        if (!currentUser || !currentMember) throw new Error('Not authenticated');
        if (currentMember.role !== 'teacher' && currentMember.role !== 'admin') {
          throw new Error('Only teachers and admins can deny expenses');
        }

        set((state) => ({
          overdueExpenses: state.overdueExpenses.map((e) =>
            e.id === id
              ? {
                  ...e,
                  status: 'denied' as const,
                  approvedBy: currentUser.id,
                  approvedAt: new Date().toISOString(),
                  notes: notes || e.notes,
                }
              : e
          ),
        }));

        // Notify member their expense was denied
        const expense = get().overdueExpenses.find((e) => e.id === id);
        const member = get().members.find((m) => m.id === expense?.memberId);
        if (member && member.userId) {
          get().addNotification({
            userId: member.userId,
            title: 'Expense Denied',
            body: `Your expense reimbursement of $${expense?.amount} was not approved${notes ? `: ${notes}` : ''}`,
            type: 'payment',
            data: { expenseId: id },
          });
        }
      },

      releaseOverdueExpense: (id, method) => {
        const { currentUser, currentMember, overdueExpenses, members } = get();
        if (!currentUser || !currentMember) throw new Error('Not authenticated');
        if (currentMember.role !== 'teacher' && currentMember.role !== 'admin') {
          throw new Error('Only teachers and admins can release expenses');
        }

        const expense = overdueExpenses.find((e) => e.id === id);
        if (!expense) throw new Error('Expense not found');
        if (expense.status !== 'approved') throw new Error('Expense must be approved first');

        set((state) => ({
          overdueExpenses: state.overdueExpenses.map((e) =>
            e.id === id
              ? {
                  ...e,
                  status: 'released' as const,
                  releasedAt: new Date().toISOString(),
                }
              : e
          ),
        }));

        // Create transaction record
        const transaction: FinancialTransaction = {
          id: generateId(),
          halauId: expense.halauId,
          memberId: expense.memberId,
          type: 'expense_release',
          amount: expense.amount,
          category: expense.category,
          method,
          reference: id,
          notes: expense.notes,
          processedBy: currentUser.id,
          processedAt: new Date().toISOString(),
        };

        set((state) => ({
          financialTransactions: [...state.financialTransactions, transaction],
        }));

        // Notify member
        const member = members.find((m) => m.id === expense.memberId);
        if (member && member.userId) {
          get().addNotification({
            userId: member.userId,
            title: 'Payment Released',
            body: `Your reimbursement of $${expense.amount} has been released via ${method}`,
            type: 'payment',
            data: { expenseId: id },
          });
        }
      },

      getOverdueExpensesByHalau: (halauId) => {
        return get().overdueExpenses.filter((e) => e.halauId === halauId);
      },

      getOverdueExpensesByMember: (memberId) => {
        return get().overdueExpenses.filter((e) => e.memberId === memberId);
      },

      getPendingApprovalExpenses: (halauId) => {
        return get().overdueExpenses.filter(
          (e) => e.halauId === halauId && e.status === 'pending_approval'
        );
      },

      getTransactionsByHalau: (halauId) => {
        return get().financialTransactions.filter((t) => t.halauId === halauId);
      },

      getTransactionsByMember: (memberId) => {
        return get().financialTransactions.filter((t) => t.memberId === memberId);
      },

      // Pending Payment Submissions
      submitPaymentForConfirmation: (memberDueId, amount, method, notes, invoiceNumber) => {
        const { currentMember, currentHalauId, memberDues } = get();
        if (!currentMember || !currentHalauId) throw new Error('No current member or halau');

        const memberDue = memberDues.find((d) => d.id === memberDueId);
        if (!memberDue) throw new Error('Member due not found');

        const submission: PendingPaymentSubmission = {
          id: Crypto.randomUUID(),
          halauId: currentHalauId,
          memberId: currentMember.id,
          memberDueId,
          amount,
          method,
          invoiceNumber: invoiceNumber?.trim() || undefined,
          notes,
          submittedAt: new Date().toISOString(),
          status: 'pending',
        };

        set((state) => ({
          pendingPaymentSubmissions: [...state.pendingPaymentSubmissions, submission],
        }));

        return submission;
      },

      confirmPaymentSubmission: (submissionId, overrides) => {
        const { currentMember, pendingPaymentSubmissions, memberDues } = get();
        if (!currentMember) throw new Error('No current member');

        const submission = pendingPaymentSubmissions.find((s) => s.id === submissionId);
        if (!submission) throw new Error('Submission not found');

        const memberDue = memberDues.find((d) => d.id === submission.memberDueId);
        if (!memberDue) throw new Error('Member due not found');

        // Apply admin overrides if provided
        const finalAmount = overrides?.amount ?? submission.amount;
        const finalMethod = overrides?.method ?? submission.method;
        const finalNotes = overrides?.notes ?? submission.notes;
        const finalInvoiceNumber = overrides?.invoiceNumber ?? submission.invoiceNumber;

        const newAmountPaid = memberDue.amountPaid + finalAmount;
        const newStatus = newAmountPaid >= memberDue.amount ? 'paid' : 'partial';

        // Create transaction record
        const transaction: FinancialTransaction = {
          id: Crypto.randomUUID(),
          halauId: submission.halauId,
          memberId: submission.memberId,
          type: 'payment',
          amount: finalAmount,
          category: memberDue.category,
          method: finalMethod,
          reference: memberDue.id,
          invoiceNumber: finalInvoiceNumber,
          notes: finalNotes,
          processedBy: currentMember.id,
          processedAt: new Date().toISOString(),
        };

        set((state) => ({
          pendingPaymentSubmissions: state.pendingPaymentSubmissions.map((s) =>
            s.id === submissionId
              ? { ...s, status: 'confirmed' as const, confirmedBy: currentMember.id, confirmedAt: new Date().toISOString() }
              : s
          ),
          memberDues: state.memberDues.map((d) =>
            d.id === submission.memberDueId
              ? {
                  ...d,
                  amountPaid: newAmountPaid,
                  status: newStatus,
                  // Set paidAt when fully paid, or when first partial payment is recorded.
                  // Preserving the old paidAt on subsequent partials would leave it stale.
                  paidAt: newStatus === 'paid'
                    ? new Date().toISOString()
                    : (d.paidAt ?? (newAmountPaid > 0 ? new Date().toISOString() : d.paidAt)),
                }
              : d
          ),
          financialTransactions: [...state.financialTransactions, transaction],
        }));
      },

      rejectPaymentSubmission: (submissionId, reason) => {
        const { currentMember } = get();
        if (!currentMember) throw new Error('No current member');

        set((state) => ({
          pendingPaymentSubmissions: state.pendingPaymentSubmissions.map((s) =>
            s.id === submissionId
              ? { ...s, status: 'rejected' as const, confirmedBy: currentMember.id, confirmedAt: new Date().toISOString(), rejectionReason: reason }
              : s
          ),
        }));
      },

      getPendingPaymentSubmissions: (halauId) => {
        return get().pendingPaymentSubmissions.filter((s) => s.halauId === halauId && s.status === 'pending');
      },

      getPendingPaymentSubmissionsByMember: (memberId) => {
        return get().pendingPaymentSubmissions.filter((s) => s.memberId === memberId);
      },

      getFinancialSummary: (halauId) => {
        const { memberDues, overdueExpenses } = get();
        const halauDues = memberDues.filter((d) => d.halauId === halauId);
        const halauExpenses = overdueExpenses.filter((e) => e.halauId === halauId);

        const today = new Date();

        // Calculate current month boundaries
        const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const monthStartStr = currentMonthStart.toISOString().split('T')[0];
        const monthEndStr = currentMonthEnd.toISOString().split('T')[0];

        // Calculate 5 days ago for overdue threshold
        const overdueThreshold = new Date(today);
        overdueThreshold.setDate(overdueThreshold.getDate() - 5);
        const overdueThresholdStr = overdueThreshold.toISOString().split('T')[0];

        return {
          totalCollected: halauDues.reduce((sum, d) => sum + d.amountPaid, 0),
          // Pending: unpaid dues for the current month only
          totalPending: halauDues
            .filter((d) => d.status !== 'paid' && d.dueDate >= monthStartStr && d.dueDate <= monthEndStr)
            .reduce((sum, d) => sum + (d.amount - d.amountPaid), 0),
          // Overdue: dues where due date is more than 5 days ago
          totalOverdue: halauDues
            .filter((d) => d.status !== 'paid' && d.dueDate < overdueThresholdStr)
            .reduce((sum, d) => sum + (d.amount - d.amountPaid), 0),
          totalOwedToMembers: halauExpenses
            .filter((e) => e.status === 'approved')
            .reduce((sum, e) => sum + e.amount, 0),
        };
      },

      // Role helpers
      isKumu: () => {
        const { currentMember } = get();
        return (
          currentMember?.role === 'teacher' ||
          currentMember?.role === 'instructor' ||
          currentMember?.role === 'admin'
        );
      },

      getCurrentRole: () => {
        const { currentMember } = get();
        return currentMember?.role || null;
      },

      isHalauOwner: (memberId) => {
        const { currentHalauId, halaus, members, currentMember } = get();
        if (!currentHalauId) return false;

        const halau = halaus.find((h) => h.id === currentHalauId);
        if (!halau) return false;

        // If no memberId provided, check the current member
        const memberToCheck = memberId
          ? members.find((m) => m.id === memberId)
          : currentMember;

        if (!memberToCheck) return false;

        // The owner is the user who created the halau
        return memberToCheck.userId === halau.createdBy;
      },

      getHalauOwnerMember: (halauId) => {
        const { halaus, members } = get();
        const halau = halaus.find((h) => h.id === halauId);
        if (!halau) return undefined;

        // Find the member whose userId matches the halau creator
        return members.find((m) => m.halauId === halauId && m.userId === halau.createdBy);
      },

      // Firebase auth helpers
      setFirebaseUser: (user) => {
        if (user) {
          const { users, halaus, halauMemberships } = get();
          const hasLocalUser = users.some((u) => u.email.toLowerCase() === user.email?.toLowerCase());
          const localUser = users.find((u) => u.id === user.uid);
          const existingHalauId = halauMemberships.find((m) => m.userId === user.uid && m.status === 'approved')?.halauId
            ?? get().currentHalauId;
          const halauExists = existingHalauId ? halaus.some((h) => h.id === existingHalauId) : false;

          set((state) => {
            // Restore currentMember from persisted members if it's missing.
            // Try halau-scoped lookup first; fall back to userId-only search so that
            // recovery scenarios where existingHalauId is null (empty halauMemberships)
            // can still seed currentMember from the members array.
            const restoredMember = state.currentMember
              ?? (existingHalauId
                ? state.members.find((m) => m.userId === user.uid && m.halauId === existingHalauId) ?? null
                : state.members.find((m) => m.userId === user.uid) ?? null);
            return {
              firebaseUser: user,
              isAuthenticated: hasLocalUser,
              isEmailVerified: user.emailVerified,
              currentUser: state.currentUser ?? localUser ?? null,
              currentMember: restoredMember,
            };
          });

          // If authenticated but halau is missing from local store, hydrate from backend
          if (hasLocalUser && existingHalauId && !halauExists) {
            const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL;
            if (backendUrl) {
              authedGet(`${backendUrl}/api/user/school/${encodeURIComponent(existingHalauId)}`)
                .then((r) => r.ok ? r.json() : null)
                .then((json: { data: Record<string, unknown> | null } | null) => {
                  const schoolData = json?.data;
                  if (schoolData) {
                    const rehydratedHalau: import('./types').Halau = {
                      id: existingHalauId,
                      name: (schoolData.name as string) ?? 'My School',
                      description: (schoolData.description as string) ?? '',
                      logo: (schoolData.logo as string) ?? undefined,
                      primaryColor: (schoolData.primaryColor as string) ?? '#8B2FC9',
                      secondaryColor: (schoolData.secondaryColor as string) ?? '#F3E8FF',
                      backgroundPattern: (schoolData.backgroundPattern as string) ?? undefined,
                      themeId: (schoolData.themeId as string) ?? undefined,
                      createdAt: new Date().toISOString(),
                      createdBy: user.uid,
                      inviteCode: (schoolData.inviteCode as string | undefined) ?? existingHalauId,
                      customClassLevels: (schoolData.customClassLevels as import('./types').CustomClassLevel[] | undefined) ?? undefined,
                      defaultClassLevelOverrides: (schoolData.defaultClassLevelOverrides as Record<string, { label?: string; description?: string }> | undefined) ?? undefined,
                    };
                    set((state) => ({
                      halaus: state.halaus.some((h) => h.id === existingHalauId)
                        ? state.halaus
                        : [...state.halaus, rehydratedHalau],
                    }));
                  }
                })
                .catch((err: unknown) => { console.error('[store] halau rehydration failed:', err); });
            }
          }

          // Always refresh class levels for existing halau on sign-in
          if (hasLocalUser && existingHalauId && halauExists) {
            const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL;
            if (backendUrl) {
              authedGet(`${backendUrl}/api/user/school/${encodeURIComponent(existingHalauId)}`)
                .then((r) => r.ok ? r.json() : null)
                .then((json: { data: Record<string, unknown> | null } | null) => {
                  const schoolData = json?.data;
                  if (schoolData) {
                    set((state) => ({
                      halaus: state.halaus.map((h) =>
                        h.id === existingHalauId
                          ? {
                              ...h,
                              customClassLevels: (schoolData.customClassLevels as import('./types').CustomClassLevel[] | undefined) ?? h.customClassLevels,
                              defaultClassLevelOverrides: (schoolData.defaultClassLevelOverrides as Record<string, { label?: string; description?: string }> | undefined) ?? h.defaultClassLevelOverrides,
                            }
                          : h
                      ),
                    }));
                  }
                })
                .catch((err: unknown) => { console.warn('[store] class level refresh failed:', err); });

              // Refresh members from Firestore
              authedGet(`${backendUrl}/api/user/school/${encodeURIComponent(existingHalauId)}/members`)
                .then((r) => r.ok ? r.json() : null)
                .then((json: { data: Record<string, unknown>[] | null } | null) => {
                  const docs = json?.data;
                  if (!Array.isArray(docs) || docs.length === 0) return;
                  set((state) => {
                    const newMembers = [...state.members];
                    for (const doc of docs) {
                      const id = (doc.id as string) ?? '';
                      if (!id) continue;
                      if (!isMemberDoc(doc)) continue;
                      const existingIdx = newMembers.findIndex((m) => m.id === id);
                      if (existingIdx >= 0) {
                        newMembers[existingIdx] = safeMergeMember(doc, newMembers[existingIdx]);
                      } else {
                        newMembers.push(doc);
                      }
                    }
                    return { members: newMembers };
                  });
                })
                .catch((err: unknown) => { console.warn('[store] member refresh failed:', err); });

              // Refresh events from Firestore
              authedGet(`${backendUrl}/api/user/school/${encodeURIComponent(existingHalauId)}/events`)
                .then((r) => r.ok ? r.json() : null)
                .then((json: { data: Record<string, unknown>[] | null } | null) => {
                  const docs = json?.data;
                  if (!Array.isArray(docs) || docs.length === 0) return;
                  set((state) => {
                    const newEvents = [...state.events];
                    for (const doc of docs) {
                      const id = (doc.id as string) ?? '';
                      if (!id) continue;
                      const existingIdx = newEvents.findIndex((e) => e.id === id);
                      if (existingIdx >= 0) {
                        const firestoreUpdatedAt = (doc.updatedAt as string) ?? '';
                        const localUpdatedAt = newEvents[existingIdx].createdAt ?? '';
                        if (firestoreUpdatedAt > localUpdatedAt) {
                          newEvents[existingIdx] = { ...newEvents[existingIdx], ...doc } as import('./types').Event;
                        }
                      } else {
                        newEvents.push(doc as unknown as import('./types').Event);
                      }
                    }
                    return { events: newEvents };
                  });
                })
                .catch((err: unknown) => { console.warn('[store] event refresh failed:', err); });

              // Refresh payments from Firestore
              authedGet(`${backendUrl}/api/user/school/${encodeURIComponent(existingHalauId)}/payments`)
                .then((r) => r.ok ? r.json() : null)
                .then((json: { data: Record<string, unknown>[] | null } | null) => {
                  const docs = json?.data;
                  if (!Array.isArray(docs) || docs.length === 0) return;
                  set((state) => {
                    const newPayments = [...state.payments];
                    for (const doc of docs) {
                      const id = (doc.id as string) ?? '';
                      if (!id) continue;
                      const existingIdx = newPayments.findIndex((p) => p.id === id);
                      if (existingIdx >= 0) {
                        const firestoreUpdatedAt = (doc.updatedAt as string) ?? '';
                        const localUpdatedAt = newPayments[existingIdx].recordedAt ?? '';
                        if (firestoreUpdatedAt > localUpdatedAt) {
                          newPayments[existingIdx] = { ...newPayments[existingIdx], ...doc } as import('./types').Payment;
                        }
                      } else {
                        newPayments.push(doc as unknown as import('./types').Payment);
                      }
                    }
                    return { payments: newPayments };
                  });
                })
                .catch((err: unknown) => { console.warn('[store] payment refresh failed:', err); });

              // Refresh videos from Firestore
              const videoRefreshSchoolId = existingHalauId;
              authedGet(`${backendUrl}/api/user/school/${encodeURIComponent(existingHalauId)}/videos`)
                .then((r) => r.ok ? r.json() : null)
                .then((json: { data: Record<string, unknown>[] | null } | null) => {
                  if (get().currentHalauId !== videoRefreshSchoolId) return;
                  const docs = json?.data;
                  if (!Array.isArray(docs) || docs.length === 0) return;
                  set((state) => {
                    const newVideos = [...state.videos];
                    for (const doc of docs) {
                      const id = (doc.id as string) ?? '';
                      if (!id) continue;
                      const existingIdx = newVideos.findIndex((v) => v.id === id);
                      if (existingIdx < 0) {
                        newVideos.push(doc as unknown as Video);
                      }
                    }
                    return { videos: newVideos };
                  });
                })
                .catch((err: unknown) => { console.warn('[store] video refresh failed:', err); });
            }
          }

          // If no local user at all, hydrate everything from Firestore via backend
          if (!hasLocalUser && user.email) {
            const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL;
            if (backendUrl) {
              authedGet(`${backendUrl}/api/user/me?uid=${encodeURIComponent(user.uid)}`)
                .then((r) => r.ok ? r.json() : null)
                .then(async (json: { data: Record<string, unknown> | null } | null) => {
                  const firestoreDoc = json?.data;
                  if (!firestoreDoc?.schoolId) return;

                  const schoolId = firestoreDoc.schoolId as string;
                  const fullName = (firestoreDoc.name as string) ?? '';
                  const parts = fullName.trim().split(' ');
                  const firstName = parts[0] ?? '';
                  const lastName = parts.slice(1).join(' ');

                  const newUser: import('./types').User = {
                    id: user.uid,
                    email: user.email!.toLowerCase(),
                    firstName,
                    lastName,
                    passwordHash: '',
                    createdAt: new Date().toISOString(),
                    emailVerified: user.emailVerified,
                  };

                  // Fetch school doc
                  const schoolRes = await authedGet(`${backendUrl}/api/user/school/${encodeURIComponent(schoolId)}`);
                  const schoolJson = schoolRes.ok ? await schoolRes.json() as { data: Record<string, unknown> | null } : null;
                  const schoolData = schoolJson?.data;

                  const newHalau: import('./types').Halau | null = schoolData ? {
                    id: schoolId,
                    name: (schoolData.name as string) ?? 'My School',
                    description: (schoolData.description as string) ?? '',
                    logo: (schoolData.logo as string) ?? undefined,
                    primaryColor: (schoolData.primaryColor as string) ?? '#8B2FC9',
                    secondaryColor: (schoolData.secondaryColor as string) ?? '#F3E8FF',
                    backgroundPattern: (schoolData.backgroundPattern as string) ?? undefined,
                    themeId: (schoolData.themeId as string) ?? undefined,
                    createdAt: new Date().toISOString(),
                    createdBy: user.uid,
                    inviteCode: (schoolData.inviteCode as string | undefined) ?? schoolId,
                    customClassLevels: (schoolData.customClassLevels as import('./types').CustomClassLevel[] | undefined) ?? undefined,
                    defaultClassLevelOverrides: (schoolData.defaultClassLevelOverrides as Record<string, { label?: string; description?: string }> | undefined) ?? undefined,
                  } : null;

                  const firestoreRoleRaw = (firestoreDoc.role ?? 'student') as string;
                  const role = (firestoreRoleRaw === 'owner' ? 'teacher' : firestoreRoleRaw) as import('./types').UserRole;
                  const newMembership: import('./types').HalauMembership = {
                    id: user.uid + '_' + schoolId,
                    userId: user.uid,
                    halauId: schoolId,
                    role,
                    status: 'approved',
                    joinedAt: new Date().toISOString(),
                  };

                  const isLeader = role === 'teacher' || role === 'instructor' || role === 'admin';
                  const newMember: import('./types').Member = {
                    id: user.uid,
                    userId: user.uid,
                    halauId: schoolId,
                    firstName,
                    lastName,
                    email: user.email!.toLowerCase(),
                    phone: '',
                    role,
                    memberType: isLeader ? 'returning' : 'new',
                    membershipPlan: 'monthly',
                    status: 'approved',
                    joinedAt: new Date().toISOString(),
                  };

                  set((state) => ({
                    users: [...state.users, newUser],
                    halaus: newHalau
                      ? state.halaus.some((h) => h.id === schoolId)
                        // Halau already exists — merge in fresh class level data from Firestore
                        ? state.halaus.map((h) =>
                            h.id === schoolId
                              ? {
                                  ...h,
                                  customClassLevels: newHalau.customClassLevels ?? h.customClassLevels,
                                  defaultClassLevelOverrides: newHalau.defaultClassLevelOverrides ?? h.defaultClassLevelOverrides,
                                }
                              : h
                          )
                        : [...state.halaus, newHalau]
                      : state.halaus,
                    halauMemberships: !state.halauMemberships.some((m) => m.id === newMembership.id)
                      ? [...state.halauMemberships, newMembership]
                      : state.halauMemberships,
                    members: !state.members.some((m) => m.userId === user.uid && m.halauId === schoolId)
                      ? [...state.members, newMember]
                      : state.members,
                    currentUser: newUser,
                    currentMember: state.currentMember ?? newMember,
                    currentHalauId: schoolId,
                    isAuthenticated: true,
                    isEmailVerified: user.emailVerified,
                  }));
                })
                .catch((err: unknown) => { console.error('[store] user hydration from backend failed:', err); });
            }
          }
        } else {
          set({
            firebaseUser: null,
            currentUser: null,
            currentMember: null,
            currentHalauId: null,
            isAuthenticated: false,
            isEmailVerified: false,
          });
        }
      },

      refreshEmailVerification: async () => {
        const result = await refreshUser();
        if (result.success && result.user) {
          const verified = result.user.emailVerified;
          set((state) => ({
            isEmailVerified: verified,
            firebaseUser: result.user ?? state.firebaseUser,
            currentUser: state.currentUser ? { ...state.currentUser, emailVerified: verified } : null,
          }));
          return verified;
        }
        return false;
      },

      resendVerification: async () => {
        return await resendVerificationEmail();
      },

      refreshSchoolData: async () => {
        const { currentHalauId } = get();
        if (!currentHalauId) return;
        const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL;
        if (!backendUrl) return;

        const halauId = currentHalauId;

        // Fire all four fetches immediately so they run in parallel.
        // Events + payments are independent fire-and-forget; school + members are
        // awaited together so their state update is atomic (currentMember seeding).

        // --- PHASE 2 (fire-and-forget, non-critical) — started before await ---

        authedGet(`${backendUrl}/api/user/school/${encodeURIComponent(halauId)}/events`)
          .then((r) => r.ok ? r.json() : null)
          .then((json: { data: Record<string, unknown>[] | null } | null) => {
            const docs = json?.data;
            if (!Array.isArray(docs) || docs.length === 0) return;
            set((state) => {
              const newEvents = [...state.events];
              for (const doc of docs) {
                const id = (doc.id as string) ?? '';
                if (!id) continue;
                const existingIdx = newEvents.findIndex((e) => e.id === id);
                if (existingIdx >= 0) {
                  const firestoreUpdatedAt = (doc.updatedAt as string) ?? '';
                  const localUpdatedAt = newEvents[existingIdx].createdAt ?? '';
                  if (firestoreUpdatedAt > localUpdatedAt) {
                    newEvents[existingIdx] = { ...newEvents[existingIdx], ...doc } as import('./types').Event;
                  }
                } else {
                  newEvents.push(doc as unknown as import('./types').Event);
                }
              }
              return { events: newEvents };
            });
          })
          .catch((err: unknown) => { console.error('[store] refreshSchoolData events failed', { halauId, err }); });

        authedGet(`${backendUrl}/api/user/school/${encodeURIComponent(halauId)}/payments`)
          .then((r) => r.ok ? r.json() : null)
          .then((json: { data: Record<string, unknown>[] | null } | null) => {
            const docs = json?.data;
            if (!Array.isArray(docs) || docs.length === 0) return;
            set((state) => {
              const newPayments = [...state.payments];
              for (const doc of docs) {
                const id = (doc.id as string) ?? '';
                if (!id) continue;
                const existingIdx = newPayments.findIndex((p) => p.id === id);
                if (existingIdx >= 0) {
                  const firestoreUpdatedAt = (doc.updatedAt as string) ?? '';
                  const localUpdatedAt = newPayments[existingIdx].recordedAt ?? '';
                  if (firestoreUpdatedAt > localUpdatedAt) {
                    newPayments[existingIdx] = { ...newPayments[existingIdx], ...doc } as import('./types').Payment;
                  }
                } else {
                  newPayments.push(doc as unknown as import('./types').Payment);
                }
              }
              return { payments: newPayments };
            });
          })
          .catch((err: unknown) => { console.error('[store] refreshSchoolData payments failed', { halauId, err }); });

        // --- PHASE 1: Fetch school + members in parallel for atomic state update ---
        const [schoolResult, membersResult] = await Promise.allSettled([
          authedGet(`${backendUrl}/api/user/school/${encodeURIComponent(halauId)}`)
            .then((r) => r.ok ? r.json() as Promise<{ data: Record<string, unknown> | null }> : null)
            .catch((err: unknown) => {
              console.error('[store] refreshSchoolData school fetch failed', { halauId, err });
              return null;
            }),
          authedGet(`${backendUrl}/api/user/school/${encodeURIComponent(halauId)}/members`)
            .then((r) => r.ok ? r.json() as Promise<{ data: Record<string, unknown>[] | null }> : null)
            .catch((err: unknown) => {
              console.error('[store] refreshSchoolData members fetch failed', { halauId, err });
              return null;
            }),
        ]);

        const schoolJson = schoolResult.status === 'fulfilled' ? schoolResult.value : null;
        const membersJson = membersResult.status === 'fulfilled' ? membersResult.value : null;

        // --- ATOMIC STATE UPDATE: halaus + members + currentMember in a single set() ---
        set((state) => {
          const updates: Partial<AppState> = {};

          // UPSERT HALAU: insert if missing, update if present
          // Protects existing fields — never overwrites with undefined/empty values
          const schoolData = schoolJson?.data;
          if (schoolData) {
            const fetchedInviteCode = schoolData.inviteCode as string | undefined;
            const existingHalau = state.halaus.find((h) => h.id === halauId);

            if (existingHalau) {
              // Update path: spread existing, only overwrite fields that are truthy in response
              updates.halaus = state.halaus.map((h) =>
                h.id === halauId
                  ? {
                      ...h,
                      ...(schoolData.name ? { name: schoolData.name as string } : {}),
                      ...(schoolData.primaryColor ? { primaryColor: schoolData.primaryColor as string } : {}),
                      ...(schoolData.secondaryColor ? { secondaryColor: schoolData.secondaryColor as string } : {}),
                      ...(schoolData.customClassLevels !== undefined ? { customClassLevels: schoolData.customClassLevels as import('./types').CustomClassLevel[] } : {}),
                      ...(schoolData.defaultClassLevelOverrides !== undefined ? { defaultClassLevelOverrides: schoolData.defaultClassLevelOverrides as Record<string, { label?: string; description?: string }> } : {}),
                      // inviteCode: only set if defined — never overwrite with undefined
                      ...(fetchedInviteCode !== undefined ? { inviteCode: fetchedInviteCode } : {}),
                    }
                  : h
              );
            } else {
              // Insert path: halau missing from cache (first-time recovery scenario)
              const newHalau: import('./types').Halau = {
                id: halauId,
                name: (schoolData.name as string) || 'My School',
                description: '',
                primaryColor: (schoolData.primaryColor as string) || '#0D9488',
                secondaryColor: (schoolData.secondaryColor as string) || '#F59E0B',
                inviteCode: fetchedInviteCode ?? halauId,
                createdAt: new Date().toISOString(),
                createdBy: state.currentUser?.id ?? '',
                ...(schoolData.customClassLevels !== undefined ? { customClassLevels: schoolData.customClassLevels as import('./types').CustomClassLevel[] } : {}),
                ...(schoolData.defaultClassLevelOverrides !== undefined ? { defaultClassLevelOverrides: schoolData.defaultClassLevelOverrides as Record<string, { label?: string; description?: string }> } : {}),
              };
              updates.halaus = [...state.halaus, newHalau];
            }
          } else {
            console.error('[store] refreshSchoolData received no school data — halau state not updated', { halauId });
          }

          // UPSERT MEMBERS + SEED/SYNC currentMember
          const docs = membersJson?.data;
          if (Array.isArray(docs) && docs.length > 0) {
            const newMembers = [...state.members];
            for (const doc of docs) {
              const id = (doc.id as string) ?? '';
              if (!id) continue;
              // Skip blank/corrupt docs
              if (!doc.role && !doc.userId) continue;
              const existingIdx = newMembers.findIndex((m) => m.id === id);
              if (existingIdx >= 0) {
                newMembers[existingIdx] = safeMergeMember(doc, newMembers[existingIdx]);
              } else {
                newMembers.push(doc as unknown as import('./types').Member);
              }
            }
            updates.members = newMembers;

            const { currentMember, currentUser } = state;
            if (currentMember) {
              // Sync: update currentMember if their record changed (role/status)
              const freshSelf = newMembers.find((m) => m.id === currentMember.id || m.userId === currentMember.userId);
              if (freshSelf && (freshSelf.status !== currentMember.status || freshSelf.role !== currentMember.role)) {
                const merged = safeMergeMember(freshSelf as unknown as Record<string, unknown>, currentMember);
                if (merged !== currentMember) {
                  updates.currentMember = merged;
                }
              }
            } else if (currentUser) {
              // SEED: first-time recovery — currentMember is null but user is authenticated
              const selfMember = newMembers.find((m) => m.userId === currentUser.id);
              if (selfMember) {
                updates.currentMember = selfMember;
              } else {
                console.error('[store] refreshSchoolData could not seed currentMember — no member found for currentUser', { halauId, userId: currentUser.id });
              }
            }
          } else if (membersJson !== null) {
            // membersJson was fetched but returned empty — log as anomaly
            console.error('[store] refreshSchoolData members response was empty', { halauId });
          }

          return updates;
        });

        // Invariant checks run after set() so the callback above stays side-effect-free.
        const { halaus: committedHalaus, currentMember: committedMember } = get();
        if (!committedHalaus.some((h) => h.id === halauId)) {
          console.error('[store] CRITICAL: refreshSchoolData failed to hydrate halau in state', { halauId });
        }
        if (!committedMember) {
          console.error('[store] CRITICAL: refreshSchoolData failed to set currentMember', { halauId });
        } else if (!committedMember.role) {
          console.error('[store] CRITICAL: refreshSchoolData currentMember.role is undefined', { halauId, memberId: committedMember.id });
        }

      },

      setCurrentMemberSubscription: (subscription) => {
        set((state) => {
          if (!state.currentMember) return state;
          // Merge subscription fields rather than wholesale replace — prevents a partial
          // incoming object (e.g. { active: true, plan: null }) from clobbering valid
          // existing fields that weren't included in the update.
          const mergedSubscription: import('./types').MemberSubscription = {
            ...state.currentMember.subscription,
            ...Object.fromEntries(
              Object.entries(subscription).filter(([, v]) => v !== undefined)
            ),
          } as import('./types').MemberSubscription;
          const updated = { ...state.currentMember, subscription: mergedSubscription };
          return {
            currentMember: updated,
            members: state.members.map((m) =>
              m.id === updated.id ? updated : m
            ),
          };
        });
      },

      // Dev/Testing helpers - clears all local data
      clearAllData: () => {
        set({
          currentUser: null,
          firebaseUser: null,
          currentMember: null,
          currentHalauId: null,
          isAuthenticated: false,
          isEmailVerified: false,
          users: [],
          members: [],
          halaus: [],
          halauMemberships: [],
          events: [],
          attendances: [],
          rsvps: [],
          payments: [],
          shows: [],
          showParticipations: [],
          videos: [],
          waivers: [],
          waiverSignatures: [],
          chatChannels: [],
          chatMessages: [],
          notifications: [],
          organizationDues: [],
          memberDues: [],
          overdueExpenses: [],
          financialTransactions: [],
          pendingPaymentSubmissions: [],
        });
      },
    }),
    {
      name: 'halau-app-storage',
      version: 4, // v4: operational data (members/events/payments) is now Firestore-only.
                  // Wipe local cache so stale AsyncStorage data doesn't conflict with cloud.
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (_persistedState, _version) => {
        // Return a clean auth-only state on any version mismatch.
        // Operational data is loaded fresh from Firestore on every sign-in.
        return {};
      },
      // Only persist UI preferences, auth session, and halau structure.
      // Operational collections (members, events, payments, attendance, etc.) are loaded
      // fresh from Firestore on every sign-in — AsyncStorage is no longer their source of truth.
      partialize: (state) => ({
        // Halau structure — kept locally so the app shell renders instantly before network
        halaus: state.halaus,
        halauMemberships: state.halauMemberships,
        users: state.users,
        // Auth session
        currentUser: state.currentUser,
        currentMember: state.currentMember,
        currentHalauId: state.currentHalauId,
        // UI preferences
        isDarkMode: state.isDarkMode,
        hasSeenIntro: state.hasSeenIntro,
        hasSeenWelcomePopup: state.hasSeenWelcomePopup,
        seenGuides: state.seenGuides,
        trialStartDate: state.trialStartDate,
        hasSeenTrialReminder: state.hasSeenTrialReminder,
        hasAcknowledgedTrial: state.hasAcknowledgedTrial,
      }),
    }
  )
);

// Re-export useShallow for components to use with derived selectors
export { useShallow };
