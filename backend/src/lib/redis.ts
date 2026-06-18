import Redis from 'ioredis';

let client: Redis | null = null;

function getClient(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (client) return client;

  client = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
    tls: process.env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
  });

  client.on('error', (err) => {
    console.warn('[Redis] Connection error:', err.message);
  });

  return client;
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
