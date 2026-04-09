/**
 * usePaywall
 *
 * Encodes the subscription gating rules:
 *
 *   owner / teacher / instructor  →  needs active subscription ($9.99/mo)
 *   admin                         →  needs active subscription ($6.99/mo)
 *   student / guardian            →  always free, no paywall
 *
 * Usage — imperative check inside a handler:
 *
 *   const { requireSubscription } = usePaywall();
 *
 *   function handleCreateEvent() {
 *     if (!requireSubscription()) return;   // navigates to paywall if needed
 *     // ... proceed
 *   }
 *
 * Usage — declarative gate in JSX (renders null + opens paywall automatically):
 *
 *   import { PaywallGate } from '@/lib/usePaywall';
 *
 *   <PaywallGate>
 *     <AdminOnlyScreen />
 *   </PaywallGate>
 */

import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSubscription } from '@/lib/useSubscription';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaywallState {
  /**
   * True when the current user is allowed past the paywall.
   * Students/guardians are always allowed. Owners/admins need an active
   * subscription or an active trial.
   */
  isAllowed: boolean;

  /**
   * True only while the initial subscription check is in flight.
   * Gate on this to avoid a flash of the paywall on app launch.
   */
  isChecking: boolean;

  /**
   * Navigate to the paywall screen if the user lacks access.
   * Returns true if the user is allowed (caller may proceed),
   * false if the paywall was opened (caller should bail).
   *
   * Safe to call from any event handler — no-ops for students/guardians.
   */
  requireSubscription: () => boolean;

  /**
   * Directly open the paywall screen regardless of current status.
   * Useful for "Upgrade" buttons.
   */
  showPaywall: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePaywall(): PaywallState {
  const router = useRouter();
  const { status, isOwnerOrAdmin, isLoading } = useSubscription();

  const isChecking = isLoading;

  // Students/guardians never need to pay (not_required)
  // Owners/admins need active OR trialing
  const isAllowed =
    status === 'not_required' ||
    status === 'active' ||
    status === 'trialing';

  const showPaywall = () => {
    router.push('/paywall' as never);
  };

  const requireSubscription = (): boolean => {
    // Students / guardians always pass
    if (status === 'not_required') return true;

    // Still loading — optimistically allow to avoid blocking UI
    if (isChecking) return true;

    if (!isAllowed) {
      showPaywall();
      return false;
    }

    return true;
  };

  return { isAllowed, isChecking, requireSubscription, showPaywall };
}

// ─── PaywallGate component ────────────────────────────────────────────────────

/**
 * Wraps any subtree that requires an active subscription.
 * Renders nothing and automatically pushes to /paywall when the user
 * lacks access. Shows nothing (null) while the check is in flight.
 *
 * @example
 * <PaywallGate>
 *   <FinancialsScreen />
 * </PaywallGate>
 */
export function PaywallGate({ children }: { children: React.ReactNode }) {
  const { isAllowed, isChecking, showPaywall } = usePaywall();

  useEffect(() => {
    if (!isChecking && !isAllowed) {
      showPaywall();
    }
  }, [isChecking, isAllowed]);

  // While loading, render nothing to avoid a flash of gated content
  if (isChecking) return null;

  // Blocked — paywall opened via useEffect above
  if (!isAllowed) return null;

  return <>{children}</>;
}
