/**
 * usePaywallGuard
 *
 * Redirects teacher / instructor / owner roles to /paywall when they
 * have neither an active subscription nor an active trial.
 *
 * Rules:
 *  - Only fires when subscription status is fully resolved (not 'loading')
 *  - Only fires while the user is inside the (tabs) group
 *  - Students / guardians / admins paid by owner → never redirected
 *  - Uses router.replace (not push) so the paywall sits at the same stack
 *    level as tabs — pressing back goes to auth/home, not back to tabs.
 *    This prevents the push-loop bug where returning to tabs re-triggers
 *    the guard immediately.
 */

import { useEffect, useRef } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useSubscription } from '@/lib/useSubscription';
import { useAppStore } from '@/lib/store';

export function usePaywallGuard() {
  const router = useRouter();
  const segments = useSegments();
  const { status, isTeacherRole } = useSubscription();

  // Only guard teacher / instructor roles — admins are handled by invite flow
  const role = useAppStore((s) => s.currentMember?.role ?? null);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);

  // Prevent duplicate redirects in the same render cycle
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    // Wait until subscription status is resolved
    if (status === 'loading') return;

    // Must be authenticated with a role
    if (!isAuthenticated || !role) return;

    // Only gate teacher / instructor roles
    if (!isTeacherRole) return;

    // Only trigger while the user is inside the main tabs
    const inTabs = segments[0] === '(tabs)';
    const alreadyOnPaywall = segments.some((s) => s === 'paywall');

    if (alreadyOnPaywall) return;

    if (!inTabs) {
      // Left tabs entirely (e.g. to onboarding or auth) — reset so guard
      // re-fires if they come back into tabs with expired status
      hasRedirectedRef.current = false;
      return;
    }

    // Access is fine — clear flag and return
    if (status === 'active' || status === 'trialing' || status === 'not_required') {
      hasRedirectedRef.current = false;
      return;
    }

    // status === 'expired' — no active subscription and trial ended.
    // Use replace (not push) so the paywall is not stacked on top of tabs;
    // returning from paywall goes to the prior history entry rather than
    // bouncing back into tabs and re-triggering this guard.
    if (!hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      router.replace('/paywall' as never);
    }
  }, [status, isTeacherRole, isAuthenticated, role, segments, router]);
}
