-- Add onboarding profile columns to companies table
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "onboarding_profile" JSONB;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "onboarding_completed_at" TIMESTAMP(3);
