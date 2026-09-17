import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getClient } from '../lib/redis';
import type { AuthRequest } from './auth';

/**
 * Backed by the shared Redis client so limits hold across every instance —
 * the in-memory default resets per-process, which is a no-op once Render
 * runs more than one.
 */
function redisStore(prefix: string) {
  return new RedisStore({
    prefix,
    // ioredis's `.call` overloads are keyed to specific command-name string literals
    // for typed replies, which doesn't line up with rate-limit-redis's generic
    // "any raw command" signature — the cast is the ioredis-recommended shape here.
    sendCommand: (...args: string[]) => (getClient().call as (...a: string[]) => Promise<any>)(...args),
  });
}

/**
 * Keys by tenant once one is resolved (post-auth routes), falling back to IP
 * for routes that run before auth (`generalLimiter`) or have none
 * (`webhookLimiter`). A shared IP — offices, NAT, mobile carriers — must not
 * share one tenant's budget, and one tenant must not be capped by another's
 * traffic just because they resolve to the same address.
 */
function tenantOrIpKey(req: AuthRequest): string {
  return req.companyId ?? ipKeyGenerator(req.ip ?? 'unknown');
}

/** Baseline budget applied to the whole `/api` surface. Runs before auth, so it's IP-keyed. */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore('rl:general:'),
  message: { error: 'Too many requests, please try again later.' },
});

/**
 * Anything that calls the model. Every one of these routes costs real OpenRouter
 * credits, so this is a spend control as much as an abuse control.
 */
export const llmLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore('rl:llm:'),
  keyGenerator: tenantOrIpKey,
  message: { error: 'AI rate limit reached, please wait a moment.' },
});

/** CSV parsing is CPU-bound and the payloads are large, so it gets its own budget. */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore('rl:upload:'),
  keyGenerator: tenantOrIpKey,
  message: { error: 'Too many uploads, please try again later.' },
});

/**
 * The channel service can emit one event per recipient per status transition, so this
 * ceiling is high — it exists to bound abuse, not to shape normal traffic. No tenant
 * is resolved on this route (it's called by the channel service, not a signed-in
 * user), so it stays IP-keyed.
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore('rl:webhook:'),
  message: { error: 'Webhook rate limit reached.' },
});
