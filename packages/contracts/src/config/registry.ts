import { z } from 'zod';

/**
 * Every tunable value in the backend that used to be a literal in a `.ts` file
 * resolves through this registry instead. One entry per key: a Zod schema
 * (which also carries the default via `.default(...)`), and a one-line
 * description shown wherever config is inspected or edited.
 *
 * Resolution order (see backend/src/lib/config.ts): company override -> plan
 * override -> this schema's default. A key not listed here cannot be read —
 * `getConfig` only accepts keys from `CONFIG_KEYS`, so a typo fails at compile
 * time, not at 2am in production.
 *
 * See docs/V3_PLAN.md Phase 1.3 for the literal each key replaced.
 */
export const CONFIG_REGISTRY = {
  // ── RFM scoring (packages/domain/src/rfm/scoring.ts) ──────────────────────
  // Interim: parameterizes the current heuristic. Phase 4.3 replaces the
  // heuristic itself with quantile RFM fitted on real data; these keys retire
  // with it rather than being reused by it.
  'rfm.frequency.high_min_orders': z.number().int().positive().default(8),
  'rfm.frequency.high_max_days': z.number().int().positive().default(45),
  'rfm.frequency.medium_min_orders': z.number().int().positive().default(3),
  'rfm.frequency.medium_max_days': z.number().int().positive().default(120),
  'rfm.engagement.recency_window_days': z.number().int().positive().default(365),
  'rfm.engagement.frequency_points_per_order': z.number().positive().default(12),
  'rfm.engagement.monetary_log_divisor': z.number().positive().default(4),
  'rfm.engagement.weight_recency': z.number().min(0).max(1).default(0.45),
  'rfm.engagement.weight_frequency': z.number().min(0).max(1).default(0.35),
  'rfm.engagement.weight_monetary': z.number().min(0).max(1).default(0.2),

  // ── Impact estimator (packages/domain/src/impact/estimate.ts) ────────────
  // The prior itself is a placeholder pending the empirical-Bayes fit in
  // Phase 4.3 (measured per opportunity type, across all tenants). The
  // shrinkage weight and interval z-score are legitimate tunables independent
  // of that work and stay config-driven either way.
  'estimator.global_prior_conversion_rate': z.number().min(0).max(1).default(0.05),
  'estimator.prior_weight': z.number().positive().default(20),
  'estimator.confidence_z': z.number().positive().default(1.645),

  // ── Queues (backend/src/lib/queues.ts) ────────────────────────────────────
  'queue.retry.attempts': z.number().int().positive().default(3),
  'queue.retry.backoff_delay_ms': z.number().int().positive().default(2000),
  'queue.opportunity_discovery.concurrency': z.number().int().positive().default(2),
  'queue.campaign_generation.concurrency': z.number().int().positive().default(3),
  'queue.persona_generation.concurrency': z.number().int().positive().default(1),
  'queue.ingestion.concurrency': z.number().int().positive().default(1),
  'queue.communication_dispatch.concurrency': z.number().int().positive().default(10),
  'ingestion.resume.cutoff_hours': z.number().int().positive().default(24),
  'ingestion.resume.max_sessions': z.number().int().positive().default(20),

  // ── Campaign approval (backend/src/lib/queues.ts) ─────────────────────────
  'approval.auto_launch_max_value': z.number().nonnegative().default(20000),
  'campaign.quiet_hours': z.object({
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(0).max(23),
  }).default({ startHour: 21, endHour: 9 }),

  // ── Rate limits & uploads (backend/src/middleware/rate-limits.ts, upload.ts) ─
  // Plan-overridable today via plan_config; becomes plan_limits proper in
  // Phase 3.1 without changing how callers read these keys.
  'rate_limit.general.window_ms': z.number().int().positive().default(15 * 60 * 1000),
  'rate_limit.general.max': z.number().int().positive().default(200),
  'rate_limit.llm.window_ms': z.number().int().positive().default(60 * 1000),
  'rate_limit.llm.max': z.number().int().positive().default(10),
  'rate_limit.upload.window_ms': z.number().int().positive().default(15 * 60 * 1000),
  'rate_limit.upload.max': z.number().int().positive().default(20),
  'rate_limit.webhook.window_ms': z.number().int().positive().default(60 * 1000),
  'rate_limit.webhook.max': z.number().int().positive().default(600),
  'upload.max_bytes': z.number().int().positive().default(10 * 1024 * 1024),
  'upload.max_files': z.number().int().positive().default(2),

  // ── LLM (backend/src/config/openrouter.ts, backend/src/lib/ai.ts) ────────
  'llm.model': z.string().min(1).default('google/gemini-2.5-flash'),
  'llm.timeout_ms': z.number().int().positive().default(60_000),
  'llm.max_retries': z.number().int().nonnegative().default(1),
  'llm.parse_retry.max_attempts': z.number().int().positive().default(3),
  'llm.parse_retry.base_delay_ms': z.number().int().positive().default(1000),
  'llm.pricing.usd_per_mtok_in': z.number().nonnegative().default(0.3),
  'llm.pricing.usd_per_mtok_out': z.number().nonnegative().default(2.5),

  // ── Agent (packages/agent-core/src/supervisor/run.ts, backend/src/server.ts) ─
  'agent.max_steps_per_role': z.number().int().positive().default(6),
  'agent.max_steps_single': z.number().int().positive().default(8),
  'agent.interval_ms': z.number().int().positive().default(21_600_000),
} as const;

export type ConfigKey = keyof typeof CONFIG_REGISTRY;
export type ConfigValue<K extends ConfigKey> = z.infer<(typeof CONFIG_REGISTRY)[K]>;

export const CONFIG_KEYS = Object.keys(CONFIG_REGISTRY) as ConfigKey[];

/** The schema's own `.default(...)` value — the last rung of the resolution ladder. */
export function schemaDefault<K extends ConfigKey>(key: K): ConfigValue<K> {
  // The indexed schema type is a union across every key, so TS can't correlate
  // it back to this call's specific K — the cast is sound because K always
  // selects the matching schema at runtime.
  return CONFIG_REGISTRY[key].parse(undefined) as ConfigValue<K>;
}
