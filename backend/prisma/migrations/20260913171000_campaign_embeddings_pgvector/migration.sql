-- ============================================================
-- Phase 7: campaign-outcome embeddings (pgvector).
--
-- Written, not applied. Do not run prisma migrate deploy against a
-- real database without explicit per-command confirmation.
--
-- Embeddings cover campaign outcomes and persona narratives only —
-- not customer rows. SQL remains the lookup for structured data.
-- growthos_search_prior_campaigns stays an honest empty stub until
-- this migration is applied and a backfill exists.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "campaign_embeddings" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "campaign_id" TEXT,
  "content" TEXT NOT NULL,
  "embedding" vector(384),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "campaign_embeddings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "campaign_embeddings_company_id_idx" ON "campaign_embeddings"("company_id");
CREATE INDEX IF NOT EXISTS "campaign_embeddings_campaign_id_idx" ON "campaign_embeddings"("campaign_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'campaign_embeddings_embedding_hnsw'
  ) THEN
    CREATE INDEX "campaign_embeddings_embedding_hnsw"
      ON "campaign_embeddings"
      USING hnsw ("embedding" vector_cosine_ops);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaign_embeddings_company_id_fkey'
  ) THEN
    ALTER TABLE "campaign_embeddings"
      ADD CONSTRAINT "campaign_embeddings_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaign_embeddings_campaign_id_fkey'
  ) THEN
    ALTER TABLE "campaign_embeddings"
      ADD CONSTRAINT "campaign_embeddings_campaign_id_fkey"
      FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
