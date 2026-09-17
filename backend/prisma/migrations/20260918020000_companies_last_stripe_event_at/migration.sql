-- Stripe does not guarantee webhook delivery order. `plan_updated_at` records
-- when *we* wrote the row, which is useless for detecting a late, stale retry —
-- this column instead stores the Stripe event's own `created` timestamp, so an
-- out-of-order delivery can be compared against the newest event already applied
-- and dropped rather than downgrading (or upgrading) a tenant based on stale data.
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "last_stripe_event_at" TIMESTAMP(3);
