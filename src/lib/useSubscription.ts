/**
 * useSubscription
 *
 * Central hook for subscription state throughout the app.
 *
 * Rules:
 *  - Students and Guardians → always "not_required" (free access, no paywall)
 *  - Teachers / Instructors / Owners → RC entitlement "school_owner_teacher" ($9.99/mo)
 *    → get a 14-day free trial when they first create a school
 *  - Admins → RC entitlement "school_owner" ($6.99/mo)
 *  - pending_admin → treated as student until invite is accepted
 *
 * After each check, subscription state is mirrored to Firestore users/{uid}
 * so the backend can verify entitlements without hitting RevenueCat directly.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { hasEntitlement, isRevenueCatEnabled, getCustomerInfo } from '@/lib/revenuecatClient';
import {
  RC_TEACHER_ENTITLEMENT_ID,
  RC_ADMIN_ENTITLEMENT_ID,
  TEACHER_PRICE_FALLBACK,
  ADMIN_PRICE_FALLBACK,
} from '@/lib/subscription';
import { saveSubscriptionToFirestore } from '@/lib/firebase-firestore';

export type SubscriptionTier = 'owner_paid' | 'free' | 'student';

export type SubscriptionStatus =
  | 'loading'
  | 'active'        // paid subscription confirmed
  | 'trialing'      // owner within 14-day free trial window
  | 'expired'       // trial ended, no active subscription
  | 'not_required'; // student / guardian — never needs to pay

export interface SubscriptionState {
  // ── Status ────────────────────────────────────────────────────────────────
  status: SubscriptionStatus;
  /** Legacy alias – true while the initial RC check is in flight */
  isLoading: boolean;

  // ── Role ──────────────────────────────────────────────────────────────────
  isOwnerOrAdmin: boolean;
  /** True for teacher/instructor/owner roles ($9.99 plan) */
  isTeacherRole: boolean;
  /** Current tier string (legacy compat) */
  tier: SubscriptionTier;

  // ── Pricing ───────────────────────────────────────────────────────────────
  /** Price string appropriate for this user's role */
  priceFallback: string;

  // ── Access ────────────────────────────────────────────────────────────────
  /** True when the user can access all features right now */
  hasAccess: boolean;
  /** Days left in 14-day trial (only meaningful when status === 'trialing') */
  trialDaysLeft: number;

  // ── Feature flags (owner_paid unlocks all; free/student = false) ──────────
  canAddAdmins: boolean;
  canCustomizeBranding: boolean;
  canManagePermissions: boolean;
  /** -1 = unlimited */
  maxStudents: number;
  hasUnlimitedStudents: boolean;

  /** Re-check subscription (call after purchase / restore) */
  refresh: () => Promise<void>;
}

export function useSubscription(): SubscriptionState {
  const role = useAppStore((s) => s.currentMember?.role ?? null);
  const firestoreSubscriptionActive = useAppStore((s) => s.currentMember?.subscription?.active ?? false);
  const isTrialActive = useAppStore((s) => s.isTrialActive);
  const getTrialDaysRemaining = useAppStore((s) => s.getTrialDaysRemaining);
  // Subscribe to trialStartDate directly so that when it loads (in a separate set() call
  // after currentMember), the check() re-runs and correctly resolves 'trialing' instead
  // of briefly hitting 'expired' before the date is available.
  const trialStartDate = useAppStore((s) => s.trialStartDate);

  // teacher/instructor are both on the $9.99 owner plan
  const isTeacherRole = role === 'teacher' || role === 'instructor';
  const isAdminRole = role === 'admin';
  const isOwnerOrAdmin = isTeacherRole || isAdminRole;
  // Any role that is NOT one of the three paying roles is always free.
  // This is intentionally exclusion-based (not a whitelist) so unknown/corrupted roles
  // and provisional members default to free rather than accidentally triggering the paywall.
  const isStudentOrGuardian = role !== null && !isTeacherRole && !isAdminRole;

  const [status, setStatus] = useState<SubscriptionStatus>('loading');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Track mount/unmount so async callbacks never call setStatus after unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset status to 'loading' whenever role changes so a fresh check is performed.
  // Without this, a role transition (e.g. P6 provisional 'student' → real 'teacher')
  // would leave the status stuck at 'not_required' until the component unmounts.
  const prevRoleRef = useRef(role);
  useEffect(() => {
    if (prevRoleRef.current !== role) {
      prevRoleRef.current = role;
      if (role !== null) setStatus('loading');
    }
  }, [role]);

  // Safety: if still loading after 5s, resolve based on trial state to prevent infinite spinner.
  // Only fires if role is known — never resolves while role is still null (avoids teacher → student misclassification).
  useEffect(() => {
    if (status !== 'loading') return;
    if (role === null) return; // Wait until role is loaded before resolving
    timeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      setStatus((prev) => {
        if (prev !== 'loading') return prev;
        // Exclusion-based: only gate teacher/instructor/admin roles
        if (role !== 'teacher' && role !== 'instructor' && role !== 'admin') return 'not_required';
        if (isTeacherRole && isTrialActive()) return 'trialing';
        if (isTeacherRole) return 'expired';
        if (isAdminRole) return 'expired';
        return 'expired';
      });
    }, 5000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [status, role, isTeacherRole, isAdminRole, isTrialActive]);

  const check = useCallback(async () => {
    // No role loaded yet — stay loading
    if (role === null) return;

    // Students and guardians never need a subscription
    if (isStudentOrGuardian) {
      if (isMountedRef.current) setStatus('not_required');
      return;
    }

    // Firestore subscription.active: true means the backend has already confirmed
    // an active subscription (e.g. test accounts, webhook-confirmed purchases).
    // Treat this as fully active — no RC check or trial needed.
    if (firestoreSubscriptionActive) {
      if (isMountedRef.current) setStatus('active');
      return;
    }

    // Owner / admin — check the entitlement matching their role
    if (isRevenueCatEnabled()) {
      const entitlementId = isTeacherRole
        ? RC_TEACHER_ENTITLEMENT_ID   // school_owner_teacher ($9.99)
        : RC_ADMIN_ENTITLEMENT_ID;    // school_owner ($6.99)

      const result = await hasEntitlement(entitlementId);
      if (result.ok && result.data) {
        if (isMountedRef.current) setStatus('active');

        // Mirror active subscription to Firestore
        const customerInfoResult = await getCustomerInfo();
        let renewalDate: string | null = null;
        if (customerInfoResult.ok) {
          const ent = customerInfoResult.data.entitlements.active?.[entitlementId];
          renewalDate = ent?.expirationDate ?? null;
        }

        await saveSubscriptionToFirestore({
          active: true,
          plan: isTeacherRole ? 'owner_monthly' : 'admin_monthly',
          price: isTeacherRole ? 9.99 : 6.99,
          renewalDate: null,  // Timestamp written by backend webhook; null until then
        }, false); // active subscription — trial no longer needed
        return;
      }

      // Entitlement not found — mirror inactive state
      await saveSubscriptionToFirestore({
        active: false,
        plan: null,
        price: 0,
        renewalDate: null,
      }); // trialActive left undefined — don't overwrite it here
    }

    // Fall back to local 14-day trial (teachers/owners only — not admins)
    if (isTeacherRole && isTrialActive()) {
      if (isMountedRef.current) setStatus('trialing');
      // Keep trialActive: true in Firestore so security rules pass during trial
      saveSubscriptionToFirestore({ active: false, plan: null, price: 0, renewalDate: null }, true);
      return;
    }

    // Trial expired and no paid subscription
    if (isTeacherRole) {
      saveSubscriptionToFirestore({ active: false, plan: null, price: 0, renewalDate: null }, false);
    }
    if (isMountedRef.current) setStatus('expired');
  }, [role, firestoreSubscriptionActive, isTeacherRole, isStudentOrGuardian, isTrialActive, trialStartDate]);

  useEffect(() => {
    check();
  }, [check]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const isLoading = status === 'loading';
  const hasAccess =
    status === 'active' ||
    status === 'trialing' ||
    status === 'not_required';

  const hasPaidFeatures = isOwnerOrAdmin && hasAccess && !isLoading;

  const tier: SubscriptionTier = isStudentOrGuardian
    ? 'student'
    : hasPaidFeatures
    ? 'owner_paid'
    : 'free';

  const trialDaysLeft = getTrialDaysRemaining();
  const priceFallback = isTeacherRole ? TEACHER_PRICE_FALLBACK : ADMIN_PRICE_FALLBACK;

  return {
    status,
    isLoading,
    isOwnerOrAdmin,
    isTeacherRole,
    tier,
    priceFallback,
    hasAccess,
    trialDaysLeft,
    canAddAdmins: hasPaidFeatures,
    canCustomizeBranding: hasPaidFeatures,
    canManagePermissions: hasPaidFeatures,
    maxStudents: -1,
    hasUnlimitedStudents: true,
    refresh: check,
  };
}
