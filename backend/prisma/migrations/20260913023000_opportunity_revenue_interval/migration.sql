-- ============================================================
-- Adds interval bounds around opportunities.potential_revenue.
--
-- Part of replacing the LLM-invented potential_revenue/confidence_score/priority_score
-- with a deterministic estimator (packages/domain/src/impact/estimate.ts) — see
-- docs/ARCHITECTURE_V2.md §1 and §5, docs/PROGRESS.md Phase 1. The estimator always
-- produces a range, not a bare point number, so the UI can say "₹40K-60K" instead of
-- implying false precision with a single figure. Existing rows default both bounds to
-- 0, matching potential_revenue's own existing default, rather than null.
-- ============================================================

ALTER TABLE "opportunities"
  ADD COLUMN IF NOT EXISTS "potential_revenue_low" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "potential_revenue_high" DECIMAL(12,2) NOT NULL DEFAULT 0;
