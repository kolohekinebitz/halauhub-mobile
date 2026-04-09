import { DarkTheme, DefaultTheme, ThemeProvider, Theme } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useEffect, useState, useMemo, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAppStore, useShallow } from '@/lib/store';
import { onAuthStateChanged } from '@/lib/firebase-auth';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { initSentry } from '@/lib/sentry';
import { TourProvider } from '@/lib/tourContext';
import { usePaywallGuard } from '@/lib/usePaywallGuard';

// Initialize background telemetry — silent no-op until EXPO_PUBLIC_SENTRY_DSN is set.
// Does NOT wrap the navigator or modify any routing/auth logic.
initSentry();

// ─── Stable module-level Zustand selector ────────────────────────────────────
// Defined at module scope so the function reference never changes between renders,
// preventing Zustand from re-subscribing on every render cycle.
type _StoreState = ReturnType<typeof useAppStore.getState>;
const selectAuthState = (s: _StoreState) => {
  const role = s.currentMember?.role ?? null;
  // Teachers, instructors, and admins must NEVER be treated as pending — they are always approved
  const isLeader = role === 'teacher' || role === 'instructor' || role === 'admin';
  const rawStatus = s.currentMember?.status ?? null;
  return {
    isAuthenticated: s.isAuthenticated,
    isEmailVerified: s.isEmailVerified,
    currentHalauId: s.currentHalauId,
    isDarkMode: s.isDarkMode,
    hasSeenIntro: s.hasSeenIntro,
    isHydrating: s.isHydrating,
    setFirebaseUser: s.setFirebaseUser,
    refreshSchoolData: s.refreshSchoolData,
    retryAccountRecovery: s.retryAccountRecovery,
    currentMemberStatus: isLeader ? 'approved' : rawStatus,
  };
};

// Custom dark theme with true black background
const CustomDarkTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#000000',
    card: '#000000',
    text: '#FFFFFF',
    border: '#1F2937',
    primary: '#0D9488',
  },
};

// Custom light theme
const CustomLightTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#F9FAFB',
    card: '#FFFFFF',
    text: '#111827',
    border: '#E5E7EB',
    primary: '#0D9488',
  },
};

export const unstable_settings = {
  initialRouteName: 'auth',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Create QueryClient with optimized defaults
const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 2,
    },
  },
});

function RootLayoutNav() {
  const segments = useSegments();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  // Track pending navigation with a ref — no state update needed, avoids extra renders
  const isNavigatingRef = useRef(false);
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Consolidate auth-related primitives into a single stable shallow selector.
  // selectAuthState is defined at module scope so its reference never changes.
  const {
    isAuthenticated,
    isEmailVerified,
    currentHalauId,
    isDarkMode,
    hasSeenIntro,
    isHydrating,
    setFirebaseUser,
    refreshSchoolData,
    retryAccountRecovery,
    currentMemberStatus,
  } = useAppStore(useShallow(selectAuthState));

  // Memoize the theme to prevent unnecessary re-renders
  const theme = useMemo(() => isDarkMode ? CustomDarkTheme : CustomLightTheme, [isDarkMode]);

  // Redirect teacher/instructor to paywall when trial expired and no subscription
  usePaywallGuard();

  // Refresh all school data when app returns to foreground
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active' && isAuthenticated) {
        void refreshSchoolData();
      }
    };
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [isAuthenticated, refreshSchoolData]);

  // Validate Firebase auth state on startup - this syncs persisted state with actual Firebase auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged((user) => {
      // Sync the store with Firebase's actual auth state
      setFirebaseUser(user);
      setIsAuthChecked(true);
    });

    return () => unsubscribe();
  }, [setFirebaseUser]);

  // BUG-05: Cold-restart recovery — app was killed while isHydrating:true (not persisted).
  // If the user is authenticated + verified but has no schoolId after auth check, trigger
  // recovery proactively before the routing effect can send them to onboarding.
  useEffect(() => {
    if (isAuthChecked && isAuthenticated && isEmailVerified && !currentHalauId && !isHydrating) {
      void retryAccountRecovery();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthChecked]); // Only runs once when Firebase auth is first confirmed

  // BUG-10: Refresh school data on initial mount when already authenticated (AsyncStorage
  // rehydration). Repopulates ephemeral collections (members, etc.) that are not persisted.
  useEffect(() => {
    if (isAuthChecked && isAuthenticated && currentHalauId) {
      void refreshSchoolData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthChecked]); // Only on first auth check — foreground handler covers subsequent refreshes

  // Mark as mounted after first render - do NOT hide splash until auth is checked
  useEffect(() => {
    const init = async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      setIsMounted(true);
      // Splash is hidden only after auth check completes (see effect below)
    };
    init();
  }, []);

  // Hide splash screen only once auth is resolved, to prevent any flash of (tabs)
  useEffect(() => {
    if (isMounted && isAuthChecked) {
      SplashScreen.hideAsync();
    }
  }, [isMounted, isAuthChecked]);

  // Handle protected routes after mounting AND auth check is complete
  useEffect(() => {
    if (!isMounted || isNavigatingRef.current) return;

    const currentSegment = segments[0];
    const inAuthGroup = currentSegment === 'auth';
    const inOnboarding = currentSegment === 'onboarding';
    const inVerifyEmail = currentSegment === 'verify-email';
    const inIntro = currentSegment === 'intro';
    const inPendingApproval = currentSegment === 'pending-approval';
    // invite-accept handles its own auth state — let it render even when unauthenticated
    // so the user sees a proper "please log in" message instead of losing the deep link params.
    const inInviteAccept = currentSegment === 'invite-accept';

    // Determine where we need to navigate (if anywhere)
    let targetRoute: string | null = null;

    // PRIORITY 1: New device / first time — always go to intro before anything else.
    // Skip this if already authenticated — an existing account should never see intro again.
    if (!hasSeenIntro && !isAuthenticated) {
      if (!inIntro) {
        targetRoute = '/intro';
      }
      // Don't process further auth logic until intro is done
      if (targetRoute) {
        isNavigatingRef.current = true;
        // Cancel any pending timer before scheduling a new one
        if (navTimerRef.current) clearTimeout(navTimerRef.current);
        navTimerRef.current = setTimeout(() => {
          router.replace(targetRoute as never);
          // Reset flag after navigation settles (no setState, no extra render)
          navTimerRef.current = setTimeout(() => { isNavigatingRef.current = false; }, 350);
        }, 0);
        return () => {
          if (navTimerRef.current) clearTimeout(navTimerRef.current);
          // Reset the navigation lock so that if this effect re-runs before the timer fires
          // (e.g. isHydrating flips true mid-flight), the new effect is not permanently blocked.
          isNavigatingRef.current = false;
        };
      }
      return;
    }

    // PRIORITY 2: Wait for Firebase auth check before making auth-based decisions
    if (!isAuthChecked) return;

    // PRIORITY 2b: Recovery in progress — a background call is resolving schoolId.
    // Route to the "Restoring your account..." screen instead of silently blocking or
    // incorrectly routing to onboarding.
    // IMPORTANT: Cancel any pending navigation timer before evaluating — BUG-C01 fix.
    // Without this, a queued setTimeout(() => router.replace('/onboarding')) from a
    // prior render (when isHydrating was briefly false) will fire after this block
    // sets isNavigatingRef=true, silently winning the race and stranding the user.
    if (isAuthenticated && isEmailVerified && !currentHalauId && isHydrating) {
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
      isNavigatingRef.current = false;
      const inRecovering = currentSegment === 'recovering';
      // Never pull the user off invite-accept — it handles its own loading state
      if (!inRecovering && !inInviteAccept) {
        targetRoute = '/recovering';
      } else {
        return;
      }
    }

    if (!isAuthenticated) {
      // Not logged in - go to auth (but let invite-accept screen handle its own auth gate)
      if (!inAuthGroup && !inInviteAccept) {
        targetRoute = '/auth';
      }
    } else if (!isEmailVerified) {
      // Logged in but email not verified
      if (!inVerifyEmail) {
        targetRoute = '/verify-email';
      }
    } else if (!currentHalauId) {
      // Logged in, verified, but no halau — skip redirect when on invite-accept
      if (!inOnboarding && !inInviteAccept) {
        targetRoute = '/onboarding';
      }
    } else if (currentMemberStatus === 'pending') {
      // Joined a halau but awaiting teacher approval
      if (!inPendingApproval) {
        targetRoute = '/pending-approval';
      }
    } else {
      // Fully authenticated with halau - go to tabs if on auth/intro/onboarding/verify/recovering screens
      if (inAuthGroup || inIntro || inOnboarding || inVerifyEmail || inPendingApproval || currentSegment === 'recovering') {
        targetRoute = '/(tabs)';
      }
    }

    // Only navigate if we have a target
    if (targetRoute) {
      isNavigatingRef.current = true;
      // Cancel any pending timer before scheduling a new one
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
      navTimerRef.current = setTimeout(() => {
        router.replace(targetRoute as never);
        navTimerRef.current = setTimeout(() => { isNavigatingRef.current = false; }, 350);
      }, 0);
      return () => {
        if (navTimerRef.current) clearTimeout(navTimerRef.current);
        // Reset the navigation lock so that if this effect re-runs before the timer fires
        // (e.g. recovery starts while onboarding navigation was pending), the new invocation
        // is not permanently blocked by a stale isNavigatingRef.current = true.
        isNavigatingRef.current = false;
      };
    }
  }, [isMounted, isAuthChecked, isAuthenticated, isEmailVerified, currentHalauId, hasSeenIntro, isHydrating, currentMemberStatus, segments, router]);

  return (
    <ThemeProvider value={theme}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="intro" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="verify-email" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="recovering" options={{ headerShown: false }} />
        <Stack.Screen name="pending-approval" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, headerBackTitle: '' }} />
        <Stack.Screen name="members/index" options={{ headerShown: false }} />
        <Stack.Screen name="members/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="members/pending" options={{ headerShown: false }} />
        <Stack.Screen name="events/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="halau/branding" options={{ headerShown: false }} />
        <Stack.Screen name="settings/permissions" options={{ headerShown: false }} />
        <Stack.Screen name="settings/titles" options={{ headerShown: false }} />
        <Stack.Screen name="payments/index" options={{ headerShown: false }} />
        <Stack.Screen name="shows/index" options={{ headerShown: false }} />
        <Stack.Screen name="shows/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="waivers/index" options={{ headerShown: false }} />
        <Stack.Screen name="attendance" options={{ headerShown: false }} />
        <Stack.Screen name="financials/index" options={{ headerShown: false }} />
        <Stack.Screen name="financials/manage-dues" options={{ headerShown: false }} />
        <Stack.Screen name="financials/record-payment" options={{ headerShown: false }} />
        <Stack.Screen name="financials/request-reimbursement" options={{ headerShown: false }} />
        <Stack.Screen name="financials/expense/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="financials/due/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="financials/dues/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="financials/transaction/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="financials/export" options={{ headerShown: false }} />
        <Stack.Screen name="paywall" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
        <Stack.Screen name="terms-of-service" options={{ headerShown: false }} />
        <Stack.Screen name="help-center" options={{ headerShown: false }} />
        <Stack.Screen name="delete-account" options={{ headerShown: false }} />
        <Stack.Screen name="invite-accept" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: true }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  // Use useRef to maintain stable QueryClient across re-renders
  const queryClientRef = useRef<QueryClient | null>(null);
  if (!queryClientRef.current) {
    queryClientRef.current = createQueryClient();
  }

  return (
    <QueryClientProvider client={queryClientRef.current}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <ErrorBoundary>
            <TourProvider>
              <RootLayoutNav />
            </TourProvider>
          </ErrorBoundary>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
