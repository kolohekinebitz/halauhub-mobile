import { useRef } from 'react';

/**
 * Returns a stable reference to `value` that only changes when the value
 * is deeply unequal to the previous one (via JSON serialisation comparison).
 *
 * Use this when a Zustand selector returns an object (e.g. `currentMember`)
 * and you want to prevent re-renders from structurally identical but
 * referentially different objects produced by spread operations.
 *
 * Note: JSON comparison is fast enough for small objects (< 5 KB). Do not
 * use for large arrays or blobs.
 */
export function useDeepMemo<T>(value: T): T {
  const prev = useRef<{ value: T; json: string } | null>(null);
  const json = JSON.stringify(value);
  if (prev.current === null || prev.current.json !== json) {
    prev.current = { value, json };
  }
  return prev.current.value;
}
