import { getClient } from './redis';

const PREFIX = 'cache:';

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const raw = await getClient().get(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function setCached(key: string, data: unknown, ttlMs: number): Promise<void> {
  try {
    await getClient().set(PREFIX + key, JSON.stringify(data), 'PX', ttlMs);
  } catch {
    // A failed cache write only costs a recompute on the next read.
  }
}
