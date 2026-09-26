import { createHash } from 'crypto';
import { prisma } from '../lib/prisma';
import { embed, toVectorLiteral } from '../lib/embeddings';
import { getConfig } from '../lib/config';

/** Must match lib/embeddings.ts's model — recorded per row so a future model
 * change is visible in the data, not just in code. Same constant as
 * campaign-embeddings.ts; not shared to avoid coupling two independent
 * corpora through an import neither otherwise needs. */
const EMBEDDING_MODEL_VERSION = 'Xenova/all-MiniLM-L6-v2';

function personaContentText(input: { personaName: string; personaDescription: string; customerCount: number }): string {
  return [
    `Persona: ${input.personaName}`,
    `Description: ${input.personaDescription}`,
    `Currently matches ${input.customerCount} customer${input.customerCount === 1 ? '' : 's'} for this tenant.`,
  ].join('\n');
}

/**
 * One embedding per (company, persona type) — many customers can share a
 * persona (they're clustered), so this embeds the persona definition itself,
 * not one row per customer who happens to have it. Called after
 * `upsertPersonaRows` writes real persona rows, once per distinct persona
 * name in that batch — event-driven, same pattern as campaign embeddings.
 */
export async function embedPersona(
  companyId: string,
  personaName: string,
  personaDescription: string,
): Promise<void> {
  const customerCount = await prisma.persona.count({ where: { companyId, personaName } });
  const content = personaContentText({ personaName, personaDescription, customerCount });
  const contentHash = createHash('sha256').update(content).digest('hex');
  const vector = await embed(content);
  const literal = toVectorLiteral(vector);

  await prisma.$executeRaw`
    INSERT INTO persona_embeddings
      (id, company_id, persona_name, content, embedding, source_type, source_version, model_version, content_hash, updated_at)
    VALUES
      (gen_random_uuid()::text, ${companyId}, ${personaName}, ${content}, ${literal}::vector, 'persona', 1, ${EMBEDDING_MODEL_VERSION}, ${contentHash}, now())
    ON CONFLICT (company_id, persona_name) DO UPDATE SET
      content = EXCLUDED.content,
      embedding = EXCLUDED.embedding,
      model_version = EXCLUDED.model_version,
      content_hash = EXCLUDED.content_hash,
      updated_at = now(),
      source_version = persona_embeddings.source_version + CASE
        WHEN persona_embeddings.content_hash = EXCLUDED.content_hash THEN 0
        ELSE 1
      END
  `;
}

export interface SimilarPersona {
  personaName: string;
  content: string;
  score: number;
}

/**
 * Hybrid retrieval (pgvector cosine + PostgreSQL full-text, fused with
 * Reciprocal Rank Fusion), scoped to one tenant — same design as
 * `searchSimilarCampaigns` in campaign-embeddings.ts, over the persona
 * corpus instead. Returns [] if the tenant has no persona embeddings yet;
 * callers already treat "no history" as a legitimate answer.
 */
export async function searchSimilarPersonas(
  companyId: string,
  query: string,
  limit?: number,
): Promise<SimilarPersona[]> {
  const [topK, candidateLimit, rrfK] = await Promise.all([
    limit !== undefined ? Promise.resolve(limit) : getConfig(companyId, 'rag.top_k'),
    getConfig(companyId, 'rag.candidate_limit'),
    getConfig(companyId, 'rag.rrf_k'),
  ]);

  const vector = await embed(query);
  const literal = toVectorLiteral(vector);

  const rows = await prisma.$queryRaw<{ persona_name: string | null; content: string; score: number }[]>`
    WITH vector_search AS (
      SELECT persona_name, content, row_number() OVER (ORDER BY embedding <=> ${literal}::vector) AS rank
      FROM persona_embeddings
      WHERE company_id = ${companyId}
      ORDER BY embedding <=> ${literal}::vector
      LIMIT ${candidateLimit}
    ),
    text_search AS (
      SELECT persona_name, content,
        row_number() OVER (ORDER BY ts_rank_cd(content_tsv, websearch_to_tsquery('english', ${query})) DESC) AS rank
      FROM persona_embeddings
      WHERE company_id = ${companyId} AND content_tsv @@ websearch_to_tsquery('english', ${query})
      ORDER BY ts_rank_cd(content_tsv, websearch_to_tsquery('english', ${query})) DESC
      LIMIT ${candidateLimit}
    )
    SELECT
      COALESCE(v.persona_name, t.persona_name) AS persona_name,
      COALESCE(v.content, t.content) AS content,
      COALESCE(1.0 / (${rrfK} + v.rank), 0) + COALESCE(1.0 / (${rrfK} + t.rank), 0) AS score
    FROM vector_search v
    FULL OUTER JOIN text_search t ON v.persona_name = t.persona_name
    ORDER BY score DESC
    LIMIT ${topK}
  `;

  return rows
    .filter((r): r is { persona_name: string; content: string; score: number } => r.persona_name !== null)
    .map((r) => ({ personaName: r.persona_name, content: r.content, score: Number(r.score) }));
}
