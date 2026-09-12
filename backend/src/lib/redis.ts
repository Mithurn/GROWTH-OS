import Redis from 'ioredis';

let client: Redis | null = null;

function redisOptions() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  return {
    url,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
    tls: url.startsWith('rediss://') ? {} : undefined,
  } as const;
}

/**
 * Shared command client (cache, frequency cap, webhook dedup).
 * Returns null when `REDIS_URL` is unset so callers can fall back in-process.
 */
export function getClient(): Redis | null {
  if (client) return client;
  const options = redisOptions();
  if (!options) return null;

  client = new Redis(options.url, options);
  client.on('error', (err) => {
    console.warn('[Redis] Connection error:', err.message);
  });

  return client;
}

/** A dedicated connection. ioredis subscribers cannot share a connection with commands. */
export function createSubscriber(): Redis | null {
  const options = redisOptions();
  if (!options) return null;
  const sub = new Redis(options.url, options);
  sub.on('error', (err) => {
    console.warn('[Redis] Subscriber error:', err.message);
  });
  return sub;
}

/**
 * Frequency cap: max 2 messages per customer per calendar day.
 * Returns true if the message should be suppressed.
 * Fails open — if Redis is unavailable, no messages are suppressed.
 */
export async function checkAndIncrFrequencyCap(customerId: string): Promise<boolean> {
  const redis = getClient();
  if (!redis) return false;

  const date = new Date().toISOString().slice(0, 10);
  const key = `comm:${customerId}:${date}`;

  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 86400);
    return count > 2;
  } catch {
    return false;
  }
}

/**
 * Webhook dedup: SET NX with 7-day TTL on dlr:{messageId}:{status}.
 * Returns true if this event has already been processed (duplicate).
 * Fails open — if Redis is unavailable, no events are suppressed.
 */
export async function isDuplicateWebhook(messageId: string, status: string): Promise<boolean> {
  const redis = getClient();
  if (!redis) return false;

  const key = `dlr:${messageId}:${status}`;
  try {
    const result = await redis.set(key, '1', 'EX', 604800, 'NX');
    return result === null; // null = key already existed = duplicate
  } catch {
    return false;
  }
}

/**
 * Opportunity segment cache: store LLM-derived opportunities keyed by
 * a hash of the company's analytics snapshot + agent goal (15-min TTL).
 */
export async function getSegmentCache(hash: string): Promise<string | null> {
  const redis = getClient();
  if (!redis) return null;

  try {
    return await redis.get(`segment:${hash}`);
  } catch {
    return null;
  }
}

export async function setSegmentCache(hash: string, data: string): Promise<void> {
  const redis = getClient();
  if (!redis) return;

  try {
    await redis.set(`segment:${hash}`, data, 'EX', 900);
  } catch {
    // non-critical, ignore
  }
}
