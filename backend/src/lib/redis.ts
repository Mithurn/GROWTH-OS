import Redis from 'ioredis';

let client: Redis | null = null;

function redisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL is required.');
  return url;
}

function connect(): Redis {
  const url = redisUrl();
  return new Redis(url, {
    maxRetriesPerRequest: 1,
    tls: url.startsWith('rediss://') ? {} : undefined,
  });
}

/** Shared command client: cache, frequency cap, webhook dedup, stream writes. */
export function getClient(): Redis {
  if (client) return client;
  client = connect();
  client.on('error', (err) => {
    console.warn('[Redis] Connection error:', err.message);
  });
  return client;
}

/** A dedicated connection. Blocking stream reads cannot share the command client. */
export function createSubscriber(): Redis {
  const sub = connect();
  sub.on('error', (err) => {
    console.warn('[Redis] Subscriber error:', err.message);
  });
  return sub;
}

/** Fails boot when Redis is missing or unreachable instead of hanging the first queued job. */
export async function assertRedisReachable(timeoutMs = 10_000): Promise<void> {
  const redis = new Redis(redisUrl(), {
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
    connectTimeout: timeoutMs,
    tls: redisUrl().startsWith('rediss://') ? {} : undefined,
  });
  redis.on('error', () => {});
  try {
    await redis.connect();
    await redis.ping();
  } finally {
    redis.disconnect();
  }
}

/**
 * Frequency cap: max 2 messages per customer per calendar day.
 * Returns true if the message should be suppressed.
 * Fails open on a transient Redis error, so no message is suppressed.
 */
export async function checkAndIncrFrequencyCap(customerId: string): Promise<boolean> {
  const redis = getClient();

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
 * Fails open on a transient Redis error, so no event is suppressed.
 */
export async function isDuplicateWebhook(messageId: string, status: string): Promise<boolean> {
  const redis = getClient();

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

  try {
    return await redis.get(`segment:${hash}`);
  } catch {
    return null;
  }
}

export async function setSegmentCache(hash: string, data: string): Promise<void> {
  const redis = getClient();

  try {
    await redis.set(`segment:${hash}`, data, 'EX', 900);
  } catch {
    // non-critical, ignore
  }
}
