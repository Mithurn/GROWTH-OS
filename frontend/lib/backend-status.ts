import { BACKEND_ORIGIN } from './api';

export type BackendStatus = 'checking' | 'online' | 'offline';

const PROBE_TIMEOUT_MS = 6000;

/**
 * Whether the live backend answers. The backend runs on AWS only while it is switched on,
 * so "offline" is a normal state, not an error: the frontend stays up on Vercel regardless.
 */
export async function probeBackend(): Promise<Exclude<BackendStatus, 'checking'>> {
  try {
    const res = await fetch(`${BACKEND_ORIGIN}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return res.ok ? 'online' : 'offline';
  } catch {
    return 'offline';
  }
}
