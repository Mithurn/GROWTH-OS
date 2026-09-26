-- Gate 3: second corpus (personas) using the same shape campaign_embeddings
-- settled on, including the provenance columns and hybrid-retrieval index
-- from the start rather than growing them incrementally as campaign_embeddings
-- had to.
--
-- Keyed by (company_id, persona_name), not by an individual persona row's id
-- — many customers can share one persona type (they're clustered), so the
-- embedding is of the persona definition itself, once per type, not once per
-- customer who happens to have it.
CREATE TABLE IF NOT EXISTS "persona_embeddings" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "persona_name" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "embedding" vector(384),
  "content_tsv" tsvector GENERATED ALWAYS AS (to_tsvector('english', "content")) STORED,
  "source_type" TEXT NOT NULL DEFAULT 'persona',
  "source_version" INTEGER NOT NULL DEFAULT 1,
  "model_version" TEXT NOT NULL DEFAULT 'Xenova/all-MiniLM-L6-v2',
  "content_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "persona_embeddings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "persona_embeddings_company_id_persona_name_key"
  ON "persona_embeddings"("company_id", "persona_name");
CREATE INDEX IF NOT EXISTS "persona_embeddings_company_id_idx" ON "persona_embeddings"("company_id");
CREATE INDEX IF NOT EXISTS "persona_embeddings_content_tsv_idx" ON "persona_embeddings" USING gin ("content_tsv");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'persona_embeddings_embedding_hnsw') THEN
    CREATE INDEX "persona_embeddings_embedding_hnsw"
      ON "persona_embeddings" USING hnsw ("embedding" vector_cosine_ops);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'persona_embeddings_company_id_fkey') THEN
    ALTER TABLE "persona_embeddings"
      ADD CONSTRAINT "persona_embeddings_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
