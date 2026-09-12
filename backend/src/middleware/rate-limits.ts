import rateLimit from 'express-rate-limit';

/** Baseline budget applied to the whole `/api` surface. */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
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
  message: { error: 'AI rate limit reached, please wait a moment.' },
});

/** CSV parsing is CPU-bound and the payloads are large, so it gets its own budget. */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads, please try again later.' },
});

/**
 * The channel service can emit one event per recipient per status transition, so this
 * ceiling is high — it exists to bound abuse, not to shape normal traffic.
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Webhook rate limit reached.' },
});
