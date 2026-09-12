-- Make CSV ingestion re-runnable.
--
-- `importCustomers` plain-inserted every row, so re-uploading a file (a retry after a
-- partial failure, or a corrected export) created duplicate customers instead of
-- updating them. A compound unique lets the import upsert on the CSV's own id.
--
-- Mirrors the existing products constraint: scoped per company, since two tenants can
-- legitimately use the same external id. `external_customer_id` is nullable and
-- Postgres treats NULLs as distinct in a unique index, so rows without one are
-- unaffected.

-- Collapse any duplicates already in the table, keeping the earliest row, so the
-- index can be created.
DELETE FROM "customers" c
USING "customers" dup
WHERE c."company_id" = dup."company_id"
  AND c."external_customer_id" = dup."external_customer_id"
  AND c."external_customer_id" IS NOT NULL
  AND (c."created_at", c."id") > (dup."created_at", dup."id");

CREATE UNIQUE INDEX IF NOT EXISTS "customers_company_id_external_customer_id_key"
  ON "customers"("company_id", "external_customer_id");
