-- Gate 3: hybrid retrieval needs a full-text side to fuse with the existing
-- pgvector cosine search. A generated column stays in sync with `content`
-- automatically — no dual-write path to keep correct by hand.
ALTER TABLE "campaign_embeddings"
  ADD COLUMN IF NOT EXISTS "content_tsv" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', "content")) STORED;

CREATE INDEX IF NOT EXISTS "campaign_embeddings_content_tsv_idx"
  ON "campaign_embeddings" USING gin ("content_tsv");

INSERT INTO "config_defaults" ("key", "value", "description") VALUES
  ('rag.top_k', '5', 'Hybrid retrieval: results returned after fusion'),
  ('rag.candidate_limit', '20', 'Hybrid retrieval: candidates each of vector/full-text search contributes before fusion'),
  ('rag.rrf_k', '60', 'Hybrid retrieval: Reciprocal Rank Fusion constant (standard default)')
ON CONFLICT ("key") DO NOTHING;
