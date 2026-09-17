-- Billing: "free" is the demo/simulator tier (always available). "pro" unlocks
-- real sends on the platform's own provider keys, funded by the subscription.
-- BYOK real sends are independent of plan.
ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS "razorpay_customer_id" TEXT,
  ADD COLUMN IF NOT EXISTS "razorpay_subscription_id" TEXT,
  ADD COLUMN IF NOT EXISTS "subscription_status" TEXT,
  ADD COLUMN IF NOT EXISTS "plan_updated_at" TIMESTAMP(3);
