-- Configuration layer (docs/V3_PLAN.md Phase 1). Every tunable value that used
-- to be a literal in a .ts file now resolves company -> plan -> this table's
-- default, via backend/src/lib/config.ts. The Zod registry at
-- packages/contracts/src/config/registry.ts is the source of truth for what a
-- key means and what type it must be; the seed values below mirror that
-- registry's own `.default(...)` exactly, as of this migration.

CREATE TABLE IF NOT EXISTS "config_defaults" (
  "key"         TEXT NOT NULL,
  "value"       JSONB NOT NULL,
  "description" TEXT NOT NULL,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "config_defaults_pkey" PRIMARY KEY ("key")
);

CREATE TABLE IF NOT EXISTS "plan_config" (
  "id"         TEXT NOT NULL,
  "plan_id"    TEXT NOT NULL,
  "key"        TEXT NOT NULL,
  "value"      JSONB NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "plan_config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "plan_config_plan_id_key_key" ON "plan_config"("plan_id", "key");
CREATE INDEX IF NOT EXISTS "plan_config_plan_id_idx" ON "plan_config"("plan_id");

CREATE TABLE IF NOT EXISTS "company_config" (
  "id"         TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "key"        TEXT NOT NULL,
  "value"      JSONB NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "company_config_company_id_key_key" ON "company_config"("company_id", "key");
CREATE INDEX IF NOT EXISTS "company_config_company_id_idx" ON "company_config"("company_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_config_company_id_fkey'
  ) THEN
    ALTER TABLE "company_config"
      ADD CONSTRAINT "company_config_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Formatting-only fields (docs/V3_PLAN.md Phase 1.3) — replace the hardcoded
-- ₹ / en-IN in queues.ts and campaign-embeddings.ts. No monetary math depends
-- on these, only display.
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'en-IN';

INSERT INTO "config_defaults" ("key", "value", "description") VALUES
  ('rfm.frequency.high_min_orders', '8', 'RFM: minimum total orders for "High" purchase frequency'),
  ('rfm.frequency.high_max_days', '45', 'RFM: max days since last order to still count as "High" frequency'),
  ('rfm.frequency.medium_min_orders', '3', 'RFM: minimum total orders for "Medium" purchase frequency'),
  ('rfm.frequency.medium_max_days', '120', 'RFM: max days since last order to still count as "Medium" frequency'),
  ('rfm.engagement.recency_window_days', '365', 'RFM: days over which recency score decays to zero'),
  ('rfm.engagement.frequency_points_per_order', '12', 'RFM: engagement points awarded per order (capped at 100)'),
  ('rfm.engagement.monetary_log_divisor', '4', 'RFM: divisor in the log10(spend) monetary score formula'),
  ('rfm.engagement.weight_recency', '0.45', 'RFM: weight of the recency component in engagement score'),
  ('rfm.engagement.weight_frequency', '0.35', 'RFM: weight of the frequency component in engagement score'),
  ('rfm.engagement.weight_monetary', '0.2', 'RFM: weight of the monetary component in engagement score'),
  ('estimator.global_prior_conversion_rate', '0.05', 'Impact estimator: fallback conversion rate for a tenant with no campaign history'),
  ('estimator.prior_weight', '20', 'Impact estimator: virtual-observation weight of the prior in Bayesian shrinkage'),
  ('estimator.confidence_z', '1.645', 'Impact estimator: z-score for the revenue interval (1.645 = ~90%)'),
  ('queue.retry.attempts', '3', 'BullMQ: retry attempts before a job is marked failed'),
  ('queue.retry.backoff_delay_ms', '2000', 'BullMQ: base exponential backoff delay between retries'),
  ('queue.opportunity_discovery.concurrency', '2', 'BullMQ: opportunity-discovery worker concurrency'),
  ('queue.campaign_generation.concurrency', '3', 'BullMQ: campaign-generation worker concurrency'),
  ('queue.persona_generation.concurrency', '1', 'BullMQ: persona-generation worker concurrency'),
  ('queue.ingestion.concurrency', '1', 'BullMQ: ingestion worker concurrency'),
  ('ingestion.resume.cutoff_hours', '24', 'How far back to look for interrupted ingestion sessions to resume'),
  ('ingestion.resume.max_sessions', '20', 'Max interrupted ingestion sessions resumed per boot'),
  ('approval.auto_launch_max_value', '20000', 'Campaign auto-launch: max potential revenue for a "major" opportunity to auto-launch without human approval'),
  ('rate_limit.general.window_ms', '900000', 'Rate limit: general /api window (ms)'),
  ('rate_limit.general.max', '200', 'Rate limit: general /api max requests per window'),
  ('rate_limit.llm.window_ms', '60000', 'Rate limit: LLM-calling routes window (ms)'),
  ('rate_limit.llm.max', '10', 'Rate limit: LLM-calling routes max requests per window'),
  ('rate_limit.upload.window_ms', '900000', 'Rate limit: CSV upload window (ms)'),
  ('rate_limit.upload.max', '20', 'Rate limit: CSV upload max requests per window'),
  ('rate_limit.webhook.window_ms', '60000', 'Rate limit: inbound channel-status webhook window (ms)'),
  ('rate_limit.webhook.max', '600', 'Rate limit: inbound channel-status webhook max requests per window'),
  ('upload.max_bytes', '10485760', 'Max CSV upload size in bytes'),
  ('upload.max_files', '2', 'Max files accepted per upload request'),
  ('llm.model', '"google/gemini-2.5-flash"', 'Default OpenRouter model id'),
  ('llm.timeout_ms', '60000', 'Per-request LLM call timeout (ms)'),
  ('llm.max_retries', '1', 'OpenAI SDK client-level retry count'),
  ('llm.parse_retry.max_attempts', '3', 'parseWithRetry: max attempts to get valid JSON from the model'),
  ('llm.parse_retry.base_delay_ms', '1000', 'parseWithRetry: base exponential backoff delay (ms)'),
  ('llm.pricing.usd_per_mtok_in', '0.3', 'Cost ledger: USD per million input tokens (OpenRouter estimate)'),
  ('llm.pricing.usd_per_mtok_out', '2.5', 'Cost ledger: USD per million output tokens (OpenRouter estimate)'),
  ('agent.max_steps_per_role', '6', 'Supervisor: max LangGraph steps per specialist role per run'),
  ('agent.max_steps_single', '8', 'Single-agent (non-supervisor) shadow path: max LangGraph steps per run'),
  ('agent.interval_ms', '21600000', 'Local-dev in-process agent interval (ms) — production uses external cron instead')
ON CONFLICT ("key") DO NOTHING;
