-- Persist the uploaded CSVs on the session row so a spin-down mid-import can
-- resume instead of leaving the session stuck at "processing" forever.
ALTER TABLE "ingestion_sessions" ADD COLUMN IF NOT EXISTS "customer_csv" BYTEA;
ALTER TABLE "ingestion_sessions" ADD COLUMN IF NOT EXISTS "order_csv" BYTEA;
