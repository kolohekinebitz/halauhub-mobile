import { getFirebaseIdToken } from './firebase';

const BACKEND_URL =
  process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ??
  process.env.EXPO_PUBLIC_BACKEND_URL ??
  '';

export async function logError(
  context: string,
  error: unknown,
  meta?: Record<string, unknown>,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const payload = {
    context,
    message,
    meta: meta ?? null,
    ts: Date.now(),
    severity: 'error' as const,
  };

  if (__DEV__) {
    console.error('[logger]', payload);
    return;
  }

  if (!BACKEND_URL) return;

  try {
    const token = await getFirebaseIdToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    await fetch(`${BACKEND_URL}/api/metrics`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  } catch {
    // Non-fatal — never throw from the error logger
  }
}
