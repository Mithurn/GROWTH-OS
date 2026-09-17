import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { RedisStore } from 'rate-limit-redis';
import { getClient } from '../lib/redis';
import { getConfig } from '../lib/config';
import type { ConfigKey } from '@growthos/contracts/config/registry';
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

/**
 * `windowMs` is resolved from global config once per process (memoized on first
 * request) rather than per-request — express-rate-limit requires the window to
 * stay fixed for the life of a limiter instance, so re-reading it per-request
 * would be both wasted Redis calls and actively wrong (the store keys its
 * buckets by the window it was constructed with).
 *
 * `limit` (max requests) is resolved per-request from `getConfig`, tenant- and
 * plan-overridable — the lever that actually matters for a paywalled product,
 * where a Pro tenant should get a materially higher ceiling than Free without
 * a deploy.
 */
function buildLimiter(
  prefix: string,
  windowKey: ConfigKey,
  maxKey: ConfigKey,
  message: string,
  keyGenerator?: (req: AuthRequest) => string,
): RequestHandler {
  let instance: RequestHandler | null = null;
  let building: Promise<RequestHandler> | null = null;

  async function build(): Promise<RequestHandler> {
    // windowKey/maxKey are typed as the general ConfigKey union (which also covers
    // string-valued keys like llm.model), so TS can't narrow the return type to
    // number from the caller's specific key — every key this function is actually
    // called with is numeric.
    const windowMs = (await getConfig(null, windowKey)) as number;
    return rateLimit({
      windowMs,
      limit: async (req) => (await getConfig((req as AuthRequest).companyId ?? null, maxKey)) as number,
      standardHeaders: true,
      legacyHeaders: false,
      store: redisStore(prefix),
      ...(keyGenerator ? { keyGenerator } : {}),
      message: { error: message },
    });
  }

  return (req, res, next) => {
    if (instance) return instance(req, res, next);
    building ??= build().then((built) => {
      instance = built;
      return built;
    });
    building.then((built) => built(req, res, next)).catch(next);
  };
}

/** Baseline budget applied to the whole `/api` surface. Runs before auth, so it's IP-keyed. */
export const generalLimiter = buildLimiter(
  'rl:general:',
  'rate_limit.general.window_ms',
  'rate_limit.general.max',
  'Too many requests, please try again later.',
);

/**
 * Anything that calls the model. Every one of these routes costs real OpenRouter
 * credits, so this is a spend control as much as an abuse control.
 */
export const llmLimiter = buildLimiter(
  'rl:llm:',
  'rate_limit.llm.window_ms',
  'rate_limit.llm.max',
  'AI rate limit reached, please wait a moment.',
  tenantOrIpKey,
);

/** CSV parsing is CPU-bound and the payloads are large, so it gets its own budget. */
export const uploadLimiter = buildLimiter(
  'rl:upload:',
  'rate_limit.upload.window_ms',
  'rate_limit.upload.max',
  'Too many uploads, please try again later.',
  tenantOrIpKey,
);

/**
 * The channel service can emit one event per recipient per status transition, so this
 * ceiling is high — it exists to bound abuse, not to shape normal traffic. No tenant
 * is resolved on this route (it's called by the channel service, not a signed-in
 * user), so it stays IP-keyed.
 */
export const webhookLimiter = buildLimiter(
  'rl:webhook:',
  'rate_limit.webhook.window_ms',
  'rate_limit.webhook.max',
  'Webhook rate limit reached.',
);
