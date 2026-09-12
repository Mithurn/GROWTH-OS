import { getClient } from './redis';

const memory = new Map<string, { data: unknown; expiresAt: number }>();
const PREFIX = 'cache:';

/**
 * Read-through cache. Prefers Redis so a Render spin-down (or a second instance)
 * does not drop a warm analytics payload; falls back to process memory when Redis
 * is unset or unreachable so local and Redis-less deploys still work.
 */
export async function getCached<T>(key: string): Promise<T | null> {
  const redis = getClient();
  if (redis) {
    try {
      const raw = await redis.get(PREFIX + key);
      if (raw) return JSON.parse(raw) as T;
      return null;
    } catch {
      // fall through to memory
    }
  }

  const entry = memory.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    memory.delete(key);
    return null;
  }
  return entry.data as T;
}

export async function setCached(key: string, data: unknown, ttlMs: number): Promise<void> {
  const redis = getClient();
  if (redis) {
    try {
      await redis.set(PREFIX + key, JSON.stringify(data), 'PX', ttlMs);
      return;
    } catch {
      // fall through to memory
    }
  }

  memory.set(key, { data, expiresAt: Date.now() + ttlMs });
}
