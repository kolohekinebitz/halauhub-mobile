/**
 * RevenueCat Client Module
 *
 * This module provides a centralized RevenueCat SDK wrapper that gracefully handles
 * missing configuration. The app will work fine whether or not RevenueCat is configured.
 *
 * Environment Variables:
 * - EXPO_PUBLIC_VIBECODE_REVENUECAT_TEST_KEY: Used in development/test builds (both platforms)
 * - EXPO_PUBLIC_VIBECODE_REVENUECAT_APPLE_KEY: Used in production builds (iOS)
 * - EXPO_PUBLIC_VIBECODE_REVENUECAT_GOOGLE_KEY: Used in production builds (Android)
 * These are automatically injected into the workspace by the Vibecode service once the user sets up RevenueCat in the Payments tab.
 *
 * Platform Support:
 * - iOS/Android: Fully supported via app stores
 * - Web: Disabled (RevenueCat only supports native app stores)
 *
 * The module automatically selects the correct key based on __DEV__ mode.
 * 
 * This module is used to get the current customer info, offerings, and purchase packages.
 * These exported functions are found at the bottom of the file.
 */

import { Platform } from "react-native";
import Purchases, {
  type PurchasesOfferings,
  type CustomerInfo,
  type PurchasesPackage,
} from "react-native-purchases";

// Check if running on web
const isWeb = Platform.OS === "web";

// Check for environment keys
const testKey = process.env.EXPO_PUBLIC_VIBECODE_REVENUECAT_TEST_KEY;
const appleKey = process.env.EXPO_PUBLIC_VIBECODE_REVENUECAT_APPLE_KEY;
const googleKey = process.env.EXPO_PUBLIC_VIBECODE_REVENUECAT_GOOGLE_KEY;

// Use __DEV__ and Platform to determine which key to use
const getApiKey = (): string | undefined => {
  if (isWeb) return undefined;
  if (__DEV__) return testKey;

  // Production: use platform-specific key
  return Platform.OS === "ios" ? appleKey : googleKey;
};

const apiKey = getApiKey();

// Track if RevenueCat is enabled
const isEnabled = !!apiKey && !isWeb;

const LOG_PREFIX = "[RevenueCat]";

export type RevenueCatGuardReason =
  | "web_not_supported"
  | "not_configured"
  | "sdk_error";

export type RevenueCatResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: RevenueCatGuardReason; error?: unknown };

// Internal guard to get consistent success/failure results from RevenueCat.
const guardRevenueCatUsage = async <T>(
  action: string,
  operation: () => Promise<T>,
): Promise<RevenueCatResult<T>> => {
  if (isWeb) {
    if (__DEV__) console.log(
      `${LOG_PREFIX} ${action} skipped: payments are not supported on web.`,
    );
    return { ok: false, reason: "web_not_supported" };
  }

  if (!isEnabled) {
    if (__DEV__) console.log(`${LOG_PREFIX} ${action} skipped: RevenueCat not configured`);
    return { ok: false, reason: "not_configured" };
  }

  try {
    const data = await operation();
    return { ok: true, data };
  } catch (error) {
    // Always log errors — use console.error in production so Sentry/crash reporters
    // capture them. Only use verbose console.log in __DEV__ for extra detail.
    console.error(`${LOG_PREFIX} ${action} failed:`, error);
    if (__DEV__) {
      try {
        console.log(`${LOG_PREFIX} ${action} error detail:`, JSON.stringify(error));
      } catch {
        console.log(`${LOG_PREFIX} ${action} error detail: [circular or non-serializable]`);
      }
    }
    return { ok: false, reason: "sdk_error", error };
  }
};

// Initialize RevenueCat if key exists
if (isEnabled) {
  try {
    // Set up custom log handler.
    // In production: only forward ERROR to keep logs clean.
    // In __DEV__: forward all levels (DEBUG/INFO/WARN/ERROR) so TestFlight
    // and simulator purchase flows are fully traceable.
    Purchases.setLogHandler((logLevel, message) => {
      if (__DEV__) {
        // Forward all levels in development for full purchase flow traceability
        if (logLevel === Purchases.LOG_LEVEL.ERROR) {
          console.error(LOG_PREFIX, message);
        } else if (logLevel === Purchases.LOG_LEVEL.WARN) {
          console.warn(LOG_PREFIX, message);
        } else {
          console.log(LOG_PREFIX, message);
        }
      } else {
        // Production: only surface errors and warnings
        if (logLevel === Purchases.LOG_LEVEL.ERROR) {
          console.error(LOG_PREFIX, message);
        } else if (logLevel === Purchases.LOG_LEVEL.WARN) {
          console.warn(LOG_PREFIX, message);
        }
      }
    });

    Purchases.configure({ apiKey: apiKey! });
    if (__DEV__) console.log(`${LOG_PREFIX} SDK initialized successfully`);
  } catch (error) {
    if (__DEV__) console.error(`${LOG_PREFIX} Failed to initialize:`, error);
  }
}

/**
 * Check if RevenueCat is configured and enabled
 *
 * @returns true if RevenueCat is configured with valid API keys
 *
 * @example
 * if (isRevenueCatEnabled()) {
 *   // Show subscription features
 * } else {
 *   // Hide or disable subscription UI
 * }
 */
export const isRevenueCatEnabled = (): boolean => {
  return isEnabled;
};

/**
 * Get available offerings from RevenueCat
 *
 * @param forceRefresh - If true, invalidates the cache before fetching (default: false)
 * @returns RevenueCatResult containing PurchasesOfferings data or a failure reason
 *
 * @example
 * const offeringsResult = await getOfferings();
 * if (offeringsResult.ok && offeringsResult.data.current) {
 *   // Display packages from offeringsResult.data.current.availablePackages
 * }
 */
export const getOfferings = (forceRefresh = false): Promise<
  RevenueCatResult<PurchasesOfferings>
> => {
  return guardRevenueCatUsage("getOfferings", async () => {
    if (forceRefresh) {
      // Invalidate customer info cache to ensure fresh data
      await Purchases.invalidateCustomerInfoCache();
    }
    return Purchases.getOfferings();
  });
};

/**
 * Syncs a CustomerInfo object into the Zustand store.
 * On failure, refetches CustomerInfo once and retries.
 * If still failing, soft-unlocks if any entitlement is active.
 */
async function syncCustomerInfoToStore(customerInfo: CustomerInfo): Promise<void> {
  const trySync = async (info: CustomerInfo): Promise<boolean> => {
    const activeEntitlements = info.entitlements.active ?? {};
    const entitlement =
      activeEntitlements['premium_teacher'] ??
      activeEntitlements['owner_monthly'] ??
      activeEntitlements[Object.keys(activeEntitlements)[0]] ??
      null;
    if (!entitlement) {
      if (__DEV__) console.warn('[RevenueCat] No active entitlement found');
      return true; // nothing to sync
    }
    const { useAppStore } = await import('./store');
    const plan = entitlement.productIdentifier?.includes('admin')
      ? ('admin_monthly' as const)
      : ('owner_monthly' as const);
    useAppStore.getState().setCurrentMemberSubscription({
      active: true,
      plan,
      price: 0,
      renewalDate: entitlement.expirationDate ?? null,
    });
    return true;
  };

  try {
    await trySync(customerInfo);
  } catch {
    // First sync failed — refetch CustomerInfo and retry once
    try {
      const fresh = await Purchases.getCustomerInfo();
      await trySync(fresh);
    } catch {
      // Retry also failed — soft unlock if any entitlement is active
      try {
        const hasAny = Object.keys(customerInfo.entitlements.active ?? {}).length > 0;
        if (hasAny) {
          const { useAppStore } = await import('./store');
          useAppStore.getState().setCurrentMemberSubscription({
            active: true,
            plan: 'owner_monthly',
            price: 0,
            renewalDate: null,
          });
          if (__DEV__) console.warn('[RevenueCat] Soft unlock applied after store sync failure');
        }
      } catch {
        // Truly non-fatal — never block the purchase flow
      }
    }
  }
}

/**
 * Purchase a package
 *
 * @param packageToPurchase - The package to purchase
 * @returns RevenueCatResult containing CustomerInfo data or a failure reason
 *
 * @example
 * const purchaseResult = await purchasePackage(selectedPackage);
 * if (purchaseResult.ok) {
 *   // Purchase successful, check entitlements
 * }
 */
export const purchasePackage = (
  packageToPurchase: PurchasesPackage,
): Promise<RevenueCatResult<CustomerInfo>> => {
  return guardRevenueCatUsage("purchasePackage", async () => {
    const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);

    // Immediately sync active entitlement into Zustand store so the paywall
    // dismisses without requiring a re-login.
    await syncCustomerInfoToStore(customerInfo);

    return customerInfo;
  });
};

/**
 * Get current customer info including active entitlements
 *
 * @returns RevenueCatResult containing CustomerInfo data or a failure reason
 *
 * @example
 * const customerInfoResult = await getCustomerInfo();
 * if (
 *   customerInfoResult.ok &&
 *   customerInfoResult.data.entitlements.active["premium"]
 * ) {
 *   // User has active premium entitlement
 * }
 */
export const getCustomerInfo = (): Promise<RevenueCatResult<CustomerInfo>> => {
  return guardRevenueCatUsage("getCustomerInfo", () =>
    Purchases.getCustomerInfo(),
  );
};

/**
 * Restore previous purchases
 *
 * @returns RevenueCatResult containing CustomerInfo data or a failure reason
 *
 * @example
 * const restoreResult = await restorePurchases();
 * if (restoreResult.ok) {
 *   // Purchases restored successfully
 * }
 */
export const restorePurchases = (): Promise<
  RevenueCatResult<CustomerInfo>
> => {
  return guardRevenueCatUsage("restorePurchases", () =>
    Purchases.restorePurchases(),
  );
};

/**
 * Set user ID for RevenueCat (useful for cross-platform user tracking)
 *
 * @param userId - The user ID to set
 * @returns RevenueCatResult<void> describing success/failure
 *
 * @example
 * const result = await setUserId(user.id);
 * if (!result.ok) {
 *   // Handle failure case
 * }
 */
export const setUserId = (userId: string): Promise<RevenueCatResult<void>> => {
  return guardRevenueCatUsage("setUserId", async () => {
    await Purchases.logIn(userId);
  });
};

/**
 * Log out the current user
 *
 * @returns RevenueCatResult<void> describing success/failure
 *
 * @example
 * const result = await logoutUser();
 * if (!result.ok) {
 *   // Handle failure case
 * }
 */
export const logoutUser = (): Promise<RevenueCatResult<void>> => {
  return guardRevenueCatUsage("logoutUser", async () => {
    await Purchases.logOut();
  });
};

/**
 * Check if user has a specific entitlement active
 *
 * @param entitlementId - The entitlement identifier (e.g., "premium", "pro")
 * @returns RevenueCatResult<boolean> describing entitlement state or failure
 *
 * @example
 * const premiumResult = await hasEntitlement("premium");
 * if (premiumResult.ok && premiumResult.data) {
 *   // Show premium features
 * }
 */
export const hasEntitlement = async (
  entitlementId: string,
): Promise<RevenueCatResult<boolean>> => {
  const customerInfoResult = await getCustomerInfo();

  if (!customerInfoResult.ok) {
    return {
      ok: false,
      reason: customerInfoResult.reason,
      error: customerInfoResult.error,
    };
  }

  const isActive = Boolean(
    customerInfoResult.data.entitlements.active?.[entitlementId],
  );
  return { ok: true, data: isActive };
};

/**
 * Check if user has any active subscription
 *
 * @returns RevenueCatResult<boolean> describing subscription state or failure
 *
 * @example
 * const subscriptionResult = await hasActiveSubscription();
 * if (subscriptionResult.ok && subscriptionResult.data) {
 *   // User is a paying subscriber
 * }
 */
export const hasActiveSubscription = async (): Promise<
  RevenueCatResult<boolean>
> => {
  const customerInfoResult = await getCustomerInfo();

  if (!customerInfoResult.ok) {
    return {
      ok: false,
      reason: customerInfoResult.reason,
      error: customerInfoResult.error,
    };
  }

  const hasSubscription =
    Object.keys(customerInfoResult.data.entitlements.active || {}).length > 0;
  return { ok: true, data: hasSubscription };
};

/**
 * Get a specific package from the current offering
 *
 * @param packageIdentifier - The package identifier (e.g., "$rc_monthly", "$rc_annual")
 * @returns RevenueCatResult containing the package (or null) or a failure reason
 *
 * @example
 * const packageResult = await getPackage("$rc_monthly");
 * if (packageResult.ok && packageResult.data) {
 *   // Display monthly subscription option
 * }
 */
export const getPackage = async (
  packageIdentifier: string,
): Promise<RevenueCatResult<PurchasesPackage | null>> => {
  const offeringsResult = await getOfferings();

  if (!offeringsResult.ok) {
    return {
      ok: false,
      reason: offeringsResult.reason,
      error: offeringsResult.error,
    };
  }

  const pkg =
    offeringsResult.data.current?.availablePackages.find(
      (availablePackage) => availablePackage.identifier === packageIdentifier,
    ) ?? null;

  return { ok: true, data: pkg };
};
