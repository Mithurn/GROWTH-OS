-- Tenant isolation was app-code-only for these four tables — company_id lived
-- only on the parent customer/order. Denormalizing it onto each row makes
-- tenant scoping a WHERE clause the Prisma client extension can enforce.

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "customer_metrics" ADD COLUMN IF NOT EXISTS "company_id" TEXT;
ALTER TABLE "customer_attributes" ADD COLUMN IF NOT EXISTS "company_id" TEXT;

UPDATE "orders" o
SET "company_id" = c."company_id"
FROM "customers" c
WHERE o."customer_id" = c."id" AND o."company_id" IS NULL;

UPDATE "order_items" oi
SET "company_id" = o."company_id"
FROM "orders" o
WHERE oi."order_id" = o."id" AND oi."company_id" IS NULL;

UPDATE "customer_metrics" cm
SET "company_id" = c."company_id"
FROM "customers" c
WHERE cm."customer_id" = c."id" AND cm."company_id" IS NULL;

UPDATE "customer_attributes" ca
SET "company_id" = c."company_id"
FROM "customers" c
WHERE ca."customer_id" = c."id" AND ca."company_id" IS NULL;

-- Every row backfilled above has a customer (and orders always have one via a
-- NOT NULL FK), so NOT NULL is safe immediately rather than a follow-up
-- migration once "all rows backfilled" is confirmed separately.
ALTER TABLE "orders" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "order_items" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "customer_metrics" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "customer_attributes" ALTER COLUMN "company_id" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_company_id_fkey') THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_company_id_fkey') THEN
    ALTER TABLE "order_items" ADD CONSTRAINT "order_items_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_metrics_company_id_fkey') THEN
    ALTER TABLE "customer_metrics" ADD CONSTRAINT "customer_metrics_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_attributes_company_id_fkey') THEN
    ALTER TABLE "customer_attributes" ADD CONSTRAINT "customer_attributes_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "orders_company_id_idx" ON "orders"("company_id");
CREATE INDEX IF NOT EXISTS "order_items_company_id_idx" ON "order_items"("company_id");
CREATE INDEX IF NOT EXISTS "customer_metrics_company_id_idx" ON "customer_metrics"("company_id");
CREATE INDEX IF NOT EXISTS "customer_attributes_company_id_idx" ON "customer_attributes"("company_id");

-- Composite indexes for the query shapes that were previously served by
-- lib/scoped-query.ts's batched `.in()` calls against a customer-id list.
CREATE INDEX IF NOT EXISTS "orders_company_id_order_date_idx" ON "orders"("company_id", "order_date");
CREATE INDEX IF NOT EXISTS "customer_metrics_company_id_total_spent_idx" ON "customer_metrics"("company_id", "total_spent");
