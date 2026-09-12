-- ============================================================
-- Migration: add_profiles_and_formalize_schema
--
-- Adds:
--   1. profiles table (auth.uid() → company_id mapping)
--   2. ingestion_sessions table (DB-backed ingestion progress)
--   3. companies.user_id column (was in DB but not tracked by Prisma)
--   4. customers.company_id column (was in DB but not tracked by Prisma)
--   5. products.company_id column (was in DB but not tracked by Prisma)
--
-- Uses IF NOT EXISTS / DO blocks throughout because several of these
-- columns already exist in production from manual Supabase edits.
--
-- 2026-09-13: the profiles and ingestion_sessions foreign keys originally used
-- `ADD CONSTRAINT IF NOT EXISTS`, which is not valid PostgreSQL syntax on any
-- version (only a few ALTER TABLE actions, ADD COLUMN among them, accept IF NOT
-- EXISTS — ADD CONSTRAINT does not). `prisma migrate deploy` against a fresh
-- database failed here every time, aborting the whole migration's transaction —
-- verified against a clean postgres:16-alpine container. Rewritten to the same
-- guarded DO-block pattern already used correctly above for customers/products.
-- Editing an already-applied migration changes its checksum: wherever this
-- migration is already recorded as applied (staging/production), the next
-- `prisma migrate deploy` there needs a one-time
-- `prisma migrate resolve --applied 20260627175139_add_profiles_and_formalize_schema`
-- first, or it will refuse to proceed with a checksum mismatch.
-- ============================================================

-- 1. Add user_id to companies (may already exist)
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "user_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "companies_user_id_key" ON "companies"("user_id");

-- 2. Add company_id to customers (may already exist)
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "company_id" TEXT;
-- Add FK only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'customers_company_id_fkey'
      AND table_name = 'customers'
  ) THEN
    ALTER TABLE "customers"
      ADD CONSTRAINT "customers_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "customers_company_id_idx" ON "customers"("company_id");

-- Drop the old global unique on email (email should be unique per-company, not globally)
DROP INDEX IF EXISTS "customers_email_key";

-- 3. Add company_id to products (may already exist)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "company_id" TEXT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'products_company_id_fkey'
      AND table_name = 'products'
  ) THEN
    ALTER TABLE "products"
      ADD CONSTRAINT "products_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
-- Drop old global unique on sku, replace with compound unique per company
DROP INDEX IF EXISTS "products_sku_key";
CREATE UNIQUE INDEX IF NOT EXISTS "products_company_id_sku_key" ON "products"("company_id", "sku");
CREATE INDEX IF NOT EXISTS "products_company_id_idx" ON "products"("company_id");

-- 4. Create profiles table
CREATE TABLE IF NOT EXISTS "profiles" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_company_id_fkey'
      AND table_name = 'profiles'
  ) THEN
    ALTER TABLE "profiles"
      ADD CONSTRAINT "profiles_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "profiles_company_id_idx" ON "profiles"("company_id");

-- Backfill profiles for any existing companies that have a user_id
INSERT INTO "profiles" ("id", "company_id", "role", "created_at")
SELECT "user_id", "id", 'owner', NOW()
FROM "companies"
WHERE "user_id" IS NOT NULL
  AND "user_id" NOT IN (SELECT "id" FROM "profiles");

-- 5. Create ingestion_sessions table
CREATE TABLE IF NOT EXISTS "ingestion_sessions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "step" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingestion_sessions_pkey" PRIMARY KEY ("id")
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ingestion_sessions_company_id_fkey'
      AND table_name = 'ingestion_sessions'
  ) THEN
    ALTER TABLE "ingestion_sessions"
      ADD CONSTRAINT "ingestion_sessions_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "ingestion_sessions_company_id_idx" ON "ingestion_sessions"("company_id");
