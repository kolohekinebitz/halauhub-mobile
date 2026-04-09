/**
 * Firestore User Document Service
 *
 * Writes subscription state to Firestore under users/{uid} so the server
 * can verify entitlements without hitting RevenueCat directly.
 *
 * Canonical schema (users/{uid}):
 * {
 *   name: string,
 *   role: "owner" | "teacher" | "instructor" | "admin" | "pending_admin" | "student" | "guardian",
 *   schoolId: string,
 *   trialActive: boolean,              // true during 14-day trial window
 *   paymentResponsibility: "owner" | "self" | null,
 *   invitedBy: string | null,          // uid of owner who sent the admin invite
 *   inviteStatus: "none" | "pending" | "accepted" | "declined",
 *   subscription: {
 *     active: boolean,
 *     plan: "owner_monthly" | "admin_monthly" | null,
 *     price: number,                   // 9.99 | 6.99 | 0
 *     renewalDate: Timestamp | null,   // set by backend webhook
 *     seats?: number,                  // only on owner docs — count of paid admin seats
 *   }
 * }
 */

import type { Timestamp, FieldValue } from 'firebase/firestore';
import { auth, getFirebaseIdToken } from './firebase';
import { getDB, withFirestoreNetwork } from './firebaseService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FirestoreRole =
  | 'owner'
  | 'teacher'
  | 'instructor'
  | 'admin'
  | 'pending_admin'
  | 'student'
  | 'guardian';

export type FirestoreInviteStatus = 'none' | 'pending' | 'accepted' | 'declined';
/** null = not relevant for students/guardians who were never in a billing flow */
export type FirestorePaymentResponsibility = 'self' | 'owner' | null;

export interface FirestoreSubscription {
  active: boolean;
  plan: 'owner_monthly' | 'admin_monthly' | null;
  /** 9.99 | 6.99 | 0 — always a number, never null */
  price: number;
  /** Firestore Timestamp set by the backend RC webhook. null until first webhook fires. */
  renewalDate: Timestamp | null;
  /** Only on owner docs — number of admin seats the owner is paying for */
  seats?: number;
}

export interface FirestoreUserDoc {
  name: string;
  role: FirestoreRole;
  schoolId: string;
  /** True during the 14-day free trial (teacher/owner only) */
  trialActive: boolean;
  /**
   * ISO date string set by the backend when the owner first creates a school.
   * The client MUST NOT write this field — it is authoritative server-side only.
   */
  trialStartDate?: string;
  paymentResponsibility: FirestorePaymentResponsibility;
  /** uid of the owner who sent this user an admin invite — null for all other roles */
  invitedBy: string | null;
  inviteStatus: FirestoreInviteStatus;
  subscription: FirestoreSubscription;
  updatedAt?: FieldValue;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isConfigured(): boolean {
  return !!process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Write or merge the subscription block on the user's Firestore document.
 * Optionally writes trialActive alongside the subscription block so the
 * backend security rules (isPaidTeacherOrOwner) can read it directly.
 * Non-blocking — RevenueCat remains the source of truth.
 */
export async function saveSubscriptionToFirestore(
  subscription: FirestoreSubscription,
  trialActive?: boolean
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    if (__DEV__) console.warn('[Firestore] saveSubscriptionToFirestore: no authenticated user');
    return;
  }
  if (!isConfigured()) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { doc, setDoc, serverTimestamp } = require('firebase/firestore') as typeof import('firebase/firestore');
    const payload: Record<string, unknown> = {
      subscription,
      updatedAt: serverTimestamp(),
    };
    if (trialActive !== undefined) {
      payload.trialActive = trialActive;
    }
    await withFirestoreNetwork(() => setDoc(doc(getDB(), 'users', uid), payload, { merge: true }));
    if (__DEV__) console.log('[Firestore] Subscription saved:', subscription.plan, subscription.active);
  } catch (error) {
    if (__DEV__) console.warn('[Firestore] Failed to save subscription:', error);
  }
}

/**
 * Write just the user's name to Firestore immediately after sign-up.
 * Called before onboarding so firstName/lastName can be recovered on other devices.
 * Uses merge so it never overwrites existing role/schoolId data.
 */
export async function storeUserName(firstName: string, lastName: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || !isConfigured()) return;
  if (!firstName.trim() && !lastName.trim()) return; // Nothing to store

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { doc, setDoc, serverTimestamp } = require('firebase/firestore') as typeof import('firebase/firestore');
    await withFirestoreNetwork(() =>
      setDoc(
        doc(getDB(), 'users', uid),
        {
          name: `${firstName} ${lastName}`.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
    );
    if (__DEV__) console.log(`[Firestore] storeUserName: stored "${firstName} ${lastName}" for ${uid}`);
  } catch (error) {
    if (__DEV__) console.warn('[Firestore] Failed to store user name:', error);
  }
}

/**
 * Upsert the user's profile fields when they sign up or join a halau.
 * Never overwrites subscription data — uses merge.
 */
export async function upsertUserDocument(data: {
  name: string;
  role: FirestoreRole;
  schoolId: string;
  inviteStatus?: FirestoreInviteStatus;
  paymentResponsibility?: FirestorePaymentResponsibility;
  invitedBy?: string | null;
  trialActive?: boolean;
}): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || !isConfigured()) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { doc, setDoc, serverTimestamp } = require('firebase/firestore') as typeof import('firebase/firestore');
    await withFirestoreNetwork(() =>
      setDoc(
        doc(getDB(), 'users', uid),
        {
          name: data.name,
          role: data.role,
          schoolId: data.schoolId,
          inviteStatus: data.inviteStatus ?? 'none',
          paymentResponsibility: data.paymentResponsibility ?? null,
          invitedBy: data.invitedBy ?? null,
          trialActive: data.trialActive ?? false,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
    );
  } catch (error) {
    if (__DEV__) console.warn('[Firestore] Failed to upsert user document:', error);
  }
}

/**
 * Read the full user document from Firestore.
 * Routed through the backend proxy so the mobile client doesn't need
 * a direct WebSocket connection to Firestore (blocked in sandbox/dev).
 */
export async function getUserDocument(): Promise<Partial<FirestoreUserDoc> | null> {
  const uid = auth.currentUser?.uid;
  if (!uid || !isConfigured()) return null;

  try {
    const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL;
    if (!backendUrl) return null;

    const token = await getFirebaseIdToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${backendUrl}/api/user/me?uid=${encodeURIComponent(uid)}`, { headers });
    if (!res.ok) return null;
    const json = await res.json() as { data: Partial<FirestoreUserDoc> | null };
    return json.data ?? null;
  } catch (error) {
    if (__DEV__) console.warn('[Firestore] Failed to read user document via backend:', error);
    return null;
  }
}

/** Convenience: read just the subscription block. */
export async function getSubscriptionFromFirestore(): Promise<FirestoreSubscription | null> {
  const userDoc = await getUserDocument();
  return userDoc?.subscription ?? null;
}

/**
 * Grant an admin seat — calls the backend which:
 *  1. Increments owner's subscription.seats
 *  2. Stamps newAdminId with role="admin", paymentResponsibility="owner", inviteStatus="accepted"
 *  3. Increments schools/{schoolId}.subscription.seats
 *
 * Must be called by an authenticated owner on behalf of the user they are promoting.
 */
export async function addSeatToOwnerBilling(
  ownerId: string,
  newAdminId: string,
  schoolId: string
): Promise<void> {
  const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL;
  if (!backendUrl) {
    const err = '[addSeatToOwnerBilling] EXPO_PUBLIC_VIBECODE_BACKEND_URL not set — cannot absorb cost';
    console.error(err);
    throw new Error(err);
  }

  console.log('[addSeatToOwnerBilling] calling /api/seats/absorb', { ownerId, newAdminId, schoolId });
  const token = await getFirebaseIdToken();
  const response = await fetch(`${backendUrl}/api/seats/absorb`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ownerId, newAdminId, schoolId }),
  });

  if (!response.ok) {
    const body = await response.json().catch((e: unknown) => { console.warn('[addSeatToOwnerBilling] failed to parse error body:', e); return {}; }) as { error?: string };
    const errMsg = `[addSeatToOwnerBilling] ${body.error ?? response.statusText}`;
    console.error('[addSeatToOwnerBilling] API error:', errMsg, { status: response.status });
    throw new Error(errMsg);
  }

  console.log(`[addSeatToOwnerBilling] success — owner=${ownerId} admin=${newAdminId} school=${schoolId}`);
}

/**
 * Send a pending admin invite from an owner to a member.
 * Writes the pending state to the invitee's Firestore doc — no seat is billed yet.
 * Call addSeatToOwnerBilling only after the invitee accepts.
 *
 * Resulting doc on users/{inviteeId}:
 *   { role: "pending_admin", inviteStatus: "pending",
 *     invitedBy: ownerId, paymentResponsibility: "owner" }
 */
export async function sendAdminInvite(params: {
  ownerId: string;
  inviteeId: string;
  schoolId?: string;
  inviteeEmail: string;
  inviteeName?: string;
  ownerName?: string;
  schoolName?: string;
  acceptUrl?: string;
  declineUrl?: string;
}): Promise<void> {
  if (!isConfigured()) return;

  const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL;
  if (!backendUrl) {
    if (__DEV__) console.warn('[Firestore] sendAdminInvite: EXPO_PUBLIC_VIBECODE_BACKEND_URL not set');
    return;
  }

  const token = await getFirebaseIdToken();
  const response = await fetch(`${backendUrl}/api/seats/invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const body = await response.json().catch((e: unknown) => { console.warn('[sendAdminInvite] failed to parse error body:', e); return {}; }) as { error?: string };
    throw new Error(`[sendAdminInvite] ${body.error ?? response.statusText}`);
  }

  if (__DEV__) console.log(`[Firestore] Admin invite sent — owner=${params.ownerId} invitee=${params.inviteeId}`);
}

/**
 * Accept a pending admin invite.
 * Bills a seat on the owner's subscription and promotes the invitee to admin.
 * Can be called by either the owner or the invitee themselves.
 */
export async function acceptAdminInvite(
  ownerId: string,
  newAdminId: string,
  schoolId: string
): Promise<void> {
  if (!isConfigured()) {
    throw new Error('[acceptAdminInvite] Firebase not configured — cannot accept invite');
  }

  const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL;
  if (!backendUrl) {
    const err = '[acceptAdminInvite] EXPO_PUBLIC_VIBECODE_BACKEND_URL not set';
    console.error(err);
    throw new Error(err);
  }

  const token = await getFirebaseIdToken();
  const response = await fetch(`${backendUrl}/api/seats/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ownerId, newAdminId, schoolId }),
  });

  if (!response.ok) {
    const body = await response.json().catch((e: unknown) => { console.warn('[acceptAdminInvite] failed to parse error body:', e); return {}; }) as { error?: string };
    throw new Error(`[acceptAdminInvite] ${body.error ?? response.statusText}`);
  }

  if (__DEV__) console.log(`[Firestore] Admin invite accepted — owner=${ownerId} admin=${newAdminId}`);
}

/**
 * Mark an admin invite as declined.
 * Reverts invitee's role back to their original role (defaults to 'student')
 * and sets inviteStatus to 'declined'.
 *
 * No seat is billed so the owner's seat count is unchanged.
 */
export async function declineAdminInvite(
  inviteeId: string,
  revertToRole: FirestoreRole = 'student',
  schoolId?: string
): Promise<void> {
  if (!isConfigured()) return;

  const backendUrl = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL;
  if (!backendUrl) {
    if (__DEV__) console.warn('[Firestore] declineAdminInvite: EXPO_PUBLIC_VIBECODE_BACKEND_URL not set');
    return;
  }

  const token = await getFirebaseIdToken();
  const response = await fetch(`${backendUrl}/api/seats/decline`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ inviteeId, revertToRole, ...(schoolId ? { schoolId } : {}) }),
  });

  if (!response.ok) {
    const body = await response.json().catch((e: unknown) => { console.warn('[declineAdminInvite] failed to parse error body:', e); return {}; }) as { error?: string };
    throw new Error(`[declineAdminInvite] ${body.error ?? response.statusText}`);
  }

  if (__DEV__) console.log(`[Firestore] Admin invite declined — invitee=${inviteeId}`);
}
