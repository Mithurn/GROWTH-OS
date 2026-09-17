-- ============================================================
-- Phase 5: per-tenant integrations (BYOK) and cost ledger.
--
-- Written, not applied. Do not run prisma migrate deploy against a
-- real database without explicit per-command confirmation.
--
-- Secrets live as AES-256-GCM ciphertext. Plaintext exists only inside
-- the decrypt→use call frame. See backend/src/lib/crypto-secret.ts.
-- ============================================================

CREATE TABLE IF NOT EXISTS "integrations" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'simulator',
  "ciphertext" TEXT,
  "iv" TEXT,
  "auth_tag" TEXT,
  "key_version" INTEGER NOT NULL DEFAULT 1,
  "last_verified_at" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'unconfigured',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "integrations_company_id_kind_key" ON "integrations"("company_id", "kind");
CREATE INDEX IF NOT EXISTS "integrations_company_id_idx" ON "integrations"("company_id");

CREATE TABLE IF NOT EXISTS "cost_ledger" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "run_id" TEXT,
  "provider" TEXT NOT NULL,
  "model" TEXT,
  "tokens_in" INTEGER NOT NULL DEFAULT 0,
  "tokens_out" INTEGER NOT NULL DEFAULT 0,
  "estimated_cost" DECIMAL(12,6) NOT NULL DEFAULT 0,
  "source" TEXT NOT NULL DEFAULT 'platform',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "cost_ledger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cost_ledger_company_id_idx" ON "cost_ledger"("company_id");
CREATE INDEX IF NOT EXISTS "cost_ledger_run_id_idx" ON "cost_ledger"("run_id");
CREATE INDEX IF NOT EXISTS "cost_ledger_created_at_idx" ON "cost_ledger"("created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'integrations_company_id_fkey'
  ) THEN
    ALTER TABLE "integrations"
      ADD CONSTRAINT "integrations_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cost_ledger_company_id_fkey'
  ) THEN
    ALTER TABLE "cost_ledger"
      ADD CONSTRAINT "cost_ledger_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
