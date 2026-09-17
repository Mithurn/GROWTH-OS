-- Production was edited by hand, so a database built only from these migrations
-- could not run the app. Every statement matches what production already has and
-- is a no-op there.

-- Prisma's @default(uuid()) and @updatedAt are client-side; supabase-js inserts need DB defaults.
ALTER TABLE "agent_actions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "agents" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "campaigns" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "communication_events" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "communications" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "companies" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "customer_attributes" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "customer_metrics" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "customers" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "opportunities" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "opportunity_customers" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "order_items" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "orders" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "personas" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "processed_webhook_events" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "products" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "agents" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "campaigns" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "communications" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "companies" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "customer_attributes" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "customer_metrics" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "customers" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "opportunities" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "personas" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "predicted_conversion_rate" DOUBLE PRECISION;
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "alternative_strategies" JSONB;
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "opportunity_personas" JSONB;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "external_order_id" TEXT;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "customer_metrics" ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "customer_attributes" ADD COLUMN IF NOT EXISTS "company_id" TEXT;

-- The chat onboarding that used this table was removed; production never had it.
DROP TABLE IF EXISTS "onboarding_conversations";
