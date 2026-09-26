-- Gate 3 (docs/V3_PLAN.md): "Add unique/version constraints and event-driven
-- upserts" for the embedding corpus. campaign_embeddings had neither — the
-- write path in campaign-embeddings.ts already read
-- `INSERT ... ON CONFLICT DO NOTHING`, silently assuming a unique constraint
-- that was never created, so a re-embed created a duplicate row instead of
-- updating one. In practice this was reachable but rare (the only production
-- caller fires once per campaign, guarded by a state-machine transition), so
-- this de-duplicates defensively before adding the constraint rather than
-- assuming no duplicates exist.

-- Keep the newest row per campaign_id; drop older duplicates.
DELETE FROM "campaign_embeddings" a
USING "campaign_embeddings" b
WHERE a."campaign_id" IS NOT NULL
  AND a."campaign_id" = b."campaign_id"
  AND a."created_at" < b."created_at";

ALTER TABLE "campaign_embeddings" ADD COLUMN IF NOT EXISTS "source_type" TEXT NOT NULL DEFAULT 'campaign';
ALTER TABLE "campaign_embeddings" ADD COLUMN IF NOT EXISTS "source_version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "campaign_embeddings" ADD COLUMN IF NOT EXISTS "model_version" TEXT NOT NULL DEFAULT 'Xenova/all-MiniLM-L6-v2';
ALTER TABLE "campaign_embeddings" ADD COLUMN IF NOT EXISTS "content_hash" TEXT;
ALTER TABLE "campaign_embeddings" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill content_hash for any existing rows so the column can go NOT NULL —
-- an md5 of the existing content is a fine one-time value; new writes always
-- supply their own real hash from the current content.
UPDATE "campaign_embeddings" SET "content_hash" = md5("content") WHERE "content_hash" IS NULL;
ALTER TABLE "campaign_embeddings" ALTER COLUMN "content_hash" SET NOT NULL;

-- Partial: source_type = 'campaign' is the only kind that exists today, but
-- the column is already nullable in preparation for persona/opportunity/
-- playbook sources (Gate 3), which won't share campaign_id's uniqueness.
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_embeddings_campaign_id_key"
  ON "campaign_embeddings"("campaign_id")
  WHERE "campaign_id" IS NOT NULL;
