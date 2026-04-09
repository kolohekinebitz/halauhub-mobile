/**
 * TourContext
 * Global tour state that survives navigation.
 * Mount <TourProvider> at the root layout so the overlay renders above every screen.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { InteractiveTour } from '@/components/InteractiveTour';
import { getGuide } from '@/lib/guideRegistry';
import { useAppStore } from '@/lib/store';
import { THEME_PALETTES, getThemeById, DEFAULT_THEME } from '@/lib/themes';
import type { TourConfig } from '@/components/InteractiveTour';

// ─── Route map ────────────────────────────────────────────────────────────────
// Maps guide IDs to the Expo Router path that should be shown under the tour.
const GUIDE_ROUTES: Record<string, string> = {
  dashboard:  '/(tabs)/',
  chat:       '/(tabs)/chat',
  events:     '/(tabs)/events',
  videos:     '/(tabs)/videos',
  members:    '/members',
  financials: '/financials',
  waivers:    '/waivers',
  attendance: '/attendance',
};

// ─── Context ──────────────────────────────────────────────────────────────────

interface TourContextValue {
  startFeatureGuide: (guideId: string) => void;
}

const TourContext = createContext<TourContextValue>({
  startFeatureGuide: () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TourProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [activeTour, setActiveTour] = useState<TourConfig | null>(null);
  const pendingGuideRef = useRef<string | null>(null);

  const markGuideSeen = useAppStore((s) => s.markGuideSeen);
  const currentHalauId = useAppStore((s) => s.currentHalauId);
  const getHalau = useAppStore((s) => s.getHalau);

  const halau = currentHalauId ? getHalau(currentHalauId) : null;
  const theme = halau?.themeId
    ? getThemeById(halau.themeId) || DEFAULT_THEME
    : THEME_PALETTES.find((t) => t.primary === halau?.primaryColor) || DEFAULT_THEME;

  const startFeatureGuide = useCallback(
    (guideId: string) => {
      const guide = getGuide(guideId);
      if (!guide) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      markGuideSeen(guideId);

      const targetRoute = GUIDE_ROUTES[guideId];

      if (targetRoute) {
        // Navigate to the target screen first, then open the tour after a single
        // frame so the screen has mounted and the user can see what the pointer refers to.
        pendingGuideRef.current = guideId;
        router.push(targetRoute as never);

        // One rAF isn't enough across JS bridge + native layout — 550 ms is a safe
        // "screen settled" window that works on both iOS and Android without a busy-wait.
        setTimeout(() => {
          if (pendingGuideRef.current === guideId) {
            pendingGuideRef.current = null;
            setActiveTour(guide);
          }
        }, 550);
      } else {
        // No navigation needed — show immediately.
        setActiveTour(guide);
      }
    },
    [router, markGuideSeen]
  );

  const closeTour = useCallback(() => {
    pendingGuideRef.current = null;
    setActiveTour(null);
  }, []);

  return (
    <TourContext.Provider value={{ startFeatureGuide }}>
      {children}
      <InteractiveTour
        config={activeTour}
        onClose={closeTour}
        primaryColor={theme.primary}
      />
    </TourContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTour(): TourContextValue {
  return useContext(TourContext);
}
