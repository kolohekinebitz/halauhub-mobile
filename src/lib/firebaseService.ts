/**
 * Firestore service — lazy initialization, single controlled network lifecycle.
 *
 * Rules:
 *  • firebase/firestore module is NEVER imported at the top level.
 *    Every access goes through require() inside a function body.
 *  • Firestore initializes exactly once (_dbInitialized guard).
 *  • Network enables exactly once per subscriber session (_networkPromise dedup).
 *  • Listener is always attached BEFORE the network is enabled.
 *  • withFirestoreNetwork is the only path for one-off write operations.
 */

import type { Firestore } from 'firebase/firestore';
import app from './firebase';
import type { ChatMessage } from './types';

// ─── Singleton Firestore instance ─────────────────────────────────────────────

let _db: Firestore | null = null;
let _dbInitialized = false;
/** Tracks the in-flight disableNetwork() call from initialization so ensureNetworkEnabled
 *  can await it before calling enableNetwork(), eliminating the race-condition that causes
 *  "Could not reach Cloud Firestore backend" warnings. */
let _pendingDisable: Promise<void> | null = null;

export function getDB(): Firestore {
  if (_dbInitialized && _db) return _db;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const lib = require('firebase/firestore') as typeof import('firebase/firestore');

  // Suppress all Firestore SDK logs. In this environment WebSocket connections to
  // Firestore are blocked by design; every connection attempt produces an
  // "unavailable" error that is handled gracefully by the callers.
  lib.setLogLevel('silent');

  try {
    _db = lib.initializeFirestore(app, { localCache: lib.memoryLocalCache() });
  } catch {
    // Already initialized on hot-reload — get existing instance.
    _db = lib.getFirestore(app);
  }

  // Network off by default — track the promise so ensureNetworkEnabled can
  // wait for it before calling enableNetwork (avoids the race condition).
  _pendingDisable = lib.disableNetwork(_db).catch(() => {/* best-effort */}).finally(() => { _pendingDisable = null; });

  _dbInitialized = true;
  return _db!;
}

// ─── Network lifecycle ────────────────────────────────────────────────────────

let _firestoreNetworkEnabled = false;
let _networkPromise: Promise<void> | null = null;

/**
 * Enables Firestore network exactly once.
 * Concurrent callers share the same in-flight Promise so only a single
 * enableNetwork() call ever reaches the SDK.
 */
async function ensureNetworkEnabled(db: Firestore): Promise<void> {
  if (_firestoreNetworkEnabled) return;

  // Wait for any in-flight disableNetwork() (from initialization or a prior
  // subscription cleanup) to settle before calling enableNetwork(), so the two
  // operations don't race inside Firebase's internal queue.
  if (_pendingDisable) {
    await _pendingDisable;
  }

  if (_networkPromise) {
    await _networkPromise;
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { enableNetwork } = require('firebase/firestore') as typeof import('firebase/firestore');

  _networkPromise = enableNetwork(db)
    .then(() => { _firestoreNetworkEnabled = true; })
    .catch(() => {/* best-effort */})
    .finally(() => { _networkPromise = null; });

  await _networkPromise;
}

/**
 * Temporarily enables Firestore network, runs `fn`, then disables it again
 * if the network was off before this call (i.e. no persistent subscriber
 * is currently holding the connection open).
 * Used exclusively by firebase-firestore.ts for one-off writes.
 */
export async function withFirestoreNetwork<T>(fn: () => Promise<T>): Promise<T> {
  const wasEnabled = _firestoreNetworkEnabled;
  try {
    await ensureNetworkEnabled(getDB());
    return await fn();
  } finally {
    if (!wasEnabled) {
      _firestoreNetworkEnabled = false;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { disableNetwork } = require('firebase/firestore') as typeof import('firebase/firestore');
      disableNetwork(getDB()).catch(() => {/* best-effort */});
    }
  }
}

// ─── Real-time subscriptions ──────────────────────────────────────────────────

/**
 * Subscribe to real-time chat messages for a halau.
 *
 * Mandatory order of operations:
 *  1. getDB()                — lazy init, network still disabled
 *  2. build query            — constructed offline, no connection
 *  3. onSnapshot()           — listener wired up BEFORE any network traffic
 *  4. ensureNetworkEnabled() — connection opened only after listener is ready
 *
 * @returns Unsubscribe function — call on component unmount.
 */
export function subscribeToHalauMessages(
  halauId: string,
  onMessages: (messages: ChatMessage[]) => void,
  onError?: (err: Error) => void,
): () => void {
  let unsubscribe: (() => void) | undefined;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { collection, query, where, onSnapshot } =
      require('firebase/firestore') as typeof import('firebase/firestore');

    const db = getDB();

    const q = query(
      collection(db, 'chatMessages'),
      where('halauId', '==', halauId),
    );

    // Step 3 — listener attached FIRST, before any network activity.
    unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const incoming: ChatMessage[] = snapshot.docs.map((d) => ({
          ...(d.data() as ChatMessage),
          id: d.id,
        }));
        onMessages(incoming);
      },
      (err: Error) => {
        if (__DEV__) console.warn('[firebaseService] snapshot error:', err);
        onError?.(err);
      },
    );

    // Step 4 — enable network exactly once, now that the listener exists.
    ensureNetworkEnabled(db).catch(() => {/* best-effort */});

  } catch {
    /* Firestore unavailable — caller falls back to local state */
  }

  return () => {
    unsubscribe?.();
    _firestoreNetworkEnabled = false;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { disableNetwork } = require('firebase/firestore') as typeof import('firebase/firestore');
    // Track this promise so a subsequent ensureNetworkEnabled() call waits for it
    // before calling enableNetwork() — prevents a race if the halauId changes quickly.
    _pendingDisable = disableNetwork(getDB()).catch(() => {/* best-effort */}).finally(() => { _pendingDisable = null; });
  };
}
