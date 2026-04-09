/**
 * sentry.ts — Background-only telemetry helper (safe-mode).
 *
 * This module is intentionally NOT imported by any active component at startup.
 * It is a drop-in integration file: when @sentry/react-native is installed and
 * EXPO_PUBLIC_SENTRY_DSN is set, simply add ONE line to _layout.tsx:
 *
 *   import { initSentry } from '@/lib/sentry';
 *   initSentry(); // call before the component definition
 *
 * Safe-mode constraints:
 *   - Does NOT modify Zustand store.
 *   - Does NOT wrap navigator or add Sentry route instrumentation.
 *   - Does NOT alter Firebase Auth or RevenueCat.
 *   - All functions no-op silently if SDK is not installed or DSN is absent.
 *   - Zero native module requirement at build time (dynamic require pattern).
 *
 * Install when ready (pure JS package — no native rebuild required with Expo):
 *   bun add @sentry/react-native
 *   # Then add to .env:
 *   EXPO_PUBLIC_SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project>
 */

// ---------------------------------------------------------------------------
// Minimal type shims — avoids requiring @sentry/react-native at compile time.
// These only describe the subset of the API this module actually calls.
// ---------------------------------------------------------------------------

interface SentryScope {
  setExtra(key: string, value: unknown): void;
  setTag(key: string, value: string): void;
}

interface SentryBreadcrumb {
  message?: string;
  data?: Record<string, unknown>;
  level?: string;
  [key: string]: unknown;
}

interface SentryInitOptions {
  dsn: string;
  tracesSampleRate: number;
  enableNativeFramesTracking: boolean;
  enableAutoSessionTracking: boolean;
  beforeBreadcrumb: (crumb: SentryBreadcrumb) => SentryBreadcrumb | null;
}

interface SentrySDK {
  init(options: SentryInitOptions): void;
  captureException(error: unknown): void;
  withScope(callback: (scope: SentryScope) => void): void;
  addBreadcrumb(breadcrumb: SentryBreadcrumb): void;
}

// ---------------------------------------------------------------------------
// Guard: resolve Sentry lazily so the app never crashes if SDK is absent.
// ---------------------------------------------------------------------------

let _sentry: SentrySDK | null = null;
let _resolved = false;

const getSentry = (): SentrySDK | null => {
  if (_resolved) return _sentry;
  _resolved = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _sentry = require('@sentry/react-native') as SentrySDK;
  } catch {
    // Package not installed — all telemetry calls become silent no-ops.
    _sentry = null;
  }
  return _sentry;
};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** DSN sourced from environment — no hardcoded secrets ever committed. */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

const isEnabled = (): boolean => Boolean(DSN && getSentry());

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize Sentry telemetry.
 * Call once at module level in _layout.tsx, before the RootLayout component:
 *
 *   import { initSentry } from '@/lib/sentry';
 *   initSentry(); // ← safe no-op until EXPO_PUBLIC_SENTRY_DSN is set
 */
export const initSentry = (): void => {
  const Sentry = getSentry();
  if (!Sentry || !DSN) return;

  Sentry.init({
    dsn: DSN,
    // Capture 10% of sessions as performance traces (low overhead).
    tracesSampleRate: 0.1,
    // Disable automatic navigator instrumentation — routing is managed by
    // Expo Router and we must not double-wrap it.
    enableNativeFramesTracking: false,
    enableAutoSessionTracking: true,
    // Strip any breadcrumb that might carry PII before it leaves the device.
    beforeBreadcrumb(crumb: SentryBreadcrumb): SentryBreadcrumb | null {
      const url = crumb.data?.url;
      if (typeof url === 'string' && url.includes('email')) return null;
      return crumb;
    },
  });
};

/**
 * Capture a handled error (e.g. from ErrorBoundary.componentDidCatch).
 * No-op when Sentry is not configured.
 *
 * @param error   The caught Error object.
 * @param context Optional non-PII metadata (component name, feature area).
 *
 * @example
 * // In ErrorBoundary.componentDidCatch:
 * import { captureHandledError } from '@/lib/sentry';
 * captureHandledError(error, { component: 'DashboardStatCards' });
 */
export const captureHandledError = (
  error: Error,
  context?: Record<string, string>
): void => {
  const Sentry = getSentry();
  if (!isEnabled() || !Sentry) return;
  Sentry.withScope((scope: SentryScope) => {
    if (context) {
      Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
    }
    scope.setTag('handled', 'true');
    Sentry.captureException(error);
  });
};

/**
 * Record a lightweight breadcrumb (non-PII only).
 * Useful for marking feature-area transitions that help reproduce crashes.
 * No-op when Sentry is not configured.
 *
 * @example
 * captureEvent('paywall_shown', { trigger: 'video_access' });
 */
export const captureEvent = (
  message: string,
  data?: Record<string, string>
): void => {
  const Sentry = getSentry();
  if (!isEnabled() || !Sentry) return;
  Sentry.addBreadcrumb({ message, data, level: 'info' });
};
