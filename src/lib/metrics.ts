/**
 * Lightweight instrumentation metrics.
 *
 * Collects named timing and event markers in memory and periodically flushes
 * them to the backend (fire-and-forget). All failures are silent so metrics
 * never affect app behaviour.
 *
 * Usage:
 *   metrics.start('signIn');
 *   // ... do work ...
 *   metrics.end('signIn');   // logs duration
 *
 *   metrics.event('hydration_complete');
 */

import { getFirebaseIdToken } from './firebase';

interface MetricEntry {
  name: string;
  type: 'timing' | 'event';
  value?: number; // ms for timing, undefined for event
  ts: number;     // unix ms
}

const _timers = new Map<string, number>();
const _buffer: MetricEntry[] = [];
const MAX_BUFFER = 50;
const FLUSH_INTERVAL_MS = 60_000; // flush every 60 s

function push(entry: MetricEntry): void {
  if (_buffer.length >= MAX_BUFFER) _buffer.shift(); // drop oldest
  _buffer.push(entry);
}

export const metrics = {
  /** Start a named timer. */
  start(name: string): void {
    _timers.set(name, Date.now());
  },

  /** End a named timer and record the duration. */
  end(name: string): number {
    const started = _timers.get(name);
    if (started === undefined) return 0;
    _timers.delete(name);
    const ms = Date.now() - started;
    push({ name, type: 'timing', value: ms, ts: Date.now() });
    if (__DEV__) console.log(`[metrics] ${name}: ${ms}ms`);
    return ms;
  },

  /** Record a named event marker (no duration). */
  event(name: string): void {
    push({ name, type: 'event', ts: Date.now() });
    if (__DEV__) console.log(`[metrics] event: ${name}`);
  },
};

/** Flush buffered metrics to the backend. Called automatically on interval. */
async function flushMetrics(): Promise<void> {
  if (_buffer.length === 0) return;
  const payload = _buffer.splice(0, _buffer.length);
  const backendUrl =
    process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ??
    process.env.EXPO_PUBLIC_BACKEND_URL;
  if (!backendUrl) { _buffer.unshift(...payload); return; }

  const MAX_ATTEMPTS = 3;
  let success = false;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const jitter = Math.random() * 300;
      await new Promise((r) => setTimeout(r, 1000 + jitter));
    }
    try {
      const token = await getFirebaseIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${backendUrl}/api/metrics`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ metrics: payload }),
      });
      if (res.ok) { success = true; break; }
    } catch {
      // Retry on next iteration
    }
  }

  if (!success) {
    // All attempts failed — restore entries so the next flush can retry
    _buffer.unshift(...payload);
  }
}

setInterval(() => { void flushMetrics(); }, FLUSH_INTERVAL_MS);
