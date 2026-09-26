import { createHash } from 'crypto';
import { prisma, prismaSystem } from '../lib/prisma';
import { embed, toVectorLiteral } from '../lib/embeddings';
import { logger } from '../lib/logger';
import { getConfig } from '../lib/config';

/** Must match `lib/embeddings.ts`'s model — recorded per row so a future model
 * change is visible in the data, not just in code. */
const EMBEDDING_MODEL_VERSION = 'Xenova/all-MiniLM-L6-v2';

/**
 * The text actually embedded for one campaign — objective, channel, offer,
 * message, and its *measured* outcome, not a guess. This is what
 * `search_prior_campaigns` and the strategy/faithfulness roles ground
 * against, so what goes in here is what the agent can later cite as real
 * history.
 */
function campaignOutcomeText(campaign: {
  name: string;
  objective: string;
  channel: string;
  offer: string | null;
  messageContent: string;
  status: string;
  performance: unknown;
  currency: string;
  locale: string;
}): string {
  const perf = campaign.performance as { sent?: number; converted?: number; revenue?: number } | null;
  const formattedRevenue = new Intl.NumberFormat(campaign.locale, {
    style: 'currency',
    currency: campaign.currency,
    maximumFractionDigits: 0,
  }).format(perf?.revenue ?? 0);
  const outcome = perf?.sent
    ? `Measured outcome: ${perf.sent} sent, ${perf.converted ?? 0} converted, ${formattedRevenue} revenue.`
    : `Status: ${campaign.status} (no delivery outcome recorded yet).`;
  return [
    `Objective: ${campaign.objective}`,
    `Channel: ${campaign.channel}`,
    campaign.offer ? `Offer: ${campaign.offer}` : null,
    `Message: ${campaign.messageContent}`,
    outcome,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function embedCampaignOutcome(campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    select: {
      id: true,
      companyId: true,
      name: true,
      objective: true,
      channel: true,
      offer: true,
      messageContent: true,
      status: true,
      performance: true,
      company: { select: { currency: true, locale: true } },
    },
  });

  const content = campaignOutcomeText({ ...campaign, currency: campaign.company.currency, locale: campaign.company.locale });
  const contentHash = createHash('sha256').update(content).digest('hex');
  const vector = await embed(content);
  const literal = toVectorLiteral(vector);

  // Real upsert against the partial unique index on campaign_id — a re-embed
  // (e.g. a manual backfill re-run) updates the existing row instead of
  // creating a duplicate. source_version only increments when the content
  // actually changed, so re-running against unchanged outcomes is a no-op
  // beyond the write itself.
  await prisma.$executeRaw`
    INSERT INTO campaign_embeddings
      (id, company_id, campaign_id, content, embedding, source_type, source_version, model_version, content_hash, updated_at)
    VALUES
      (gen_random_uuid()::text, ${campaign.companyId}, ${campaign.id}, ${content}, ${literal}::vector, 'campaign', 1, ${EMBEDDING_MODEL_VERSION}, ${contentHash}, now())
    ON CONFLICT (campaign_id) WHERE campaign_id IS NOT NULL DO UPDATE SET
      content = EXCLUDED.content,
      embedding = EXCLUDED.embedding,
      model_version = EXCLUDED.model_version,
      content_hash = EXCLUDED.content_hash,
      updated_at = now(),
      source_version = campaign_embeddings.source_version + CASE
        WHEN campaign_embeddings.content_hash = EXCLUDED.content_hash THEN 0
        ELSE 1
      END
  `;
}

export interface SimilarCampaign {
  campaignId: string | null;
  content: string;
  /** Reciprocal Rank Fusion score — relative, higher is a better match. Not a
   * distance or a probability; only meaningful compared against other rows
   * from the same query. */
  score: number;
}

/**
 * Hybrid retrieval, scoped to one tenant — this is the real implementation
 * behind `growthos_search_prior_campaigns`. Combines pgvector cosine
 * similarity with PostgreSQL full-text search via Reciprocal Rank Fusion
 * (RRF): each method ranks its own candidates, a row's fused score is the sum
 * of `1 / (rrfK + rank)` across whichever method(s) it appeared in. A row
 * that ranks well on both counts more than a row that only ranks well on one.
 * Runs both queries regardless of the other's result — vector search finds
 * semantic matches full-text misses (paraphrase, no shared words); full-text
 * finds exact terms (a specific offer code, a product name) that an embedding
 * can blur across neighbors.
 *
 * Returns [] (not an error) if the table has no embedded rows yet for this
 * tenant; callers already treat "no history" as a legitimate, common answer,
 * not a failure.
 */
export async function searchSimilarCampaigns(
  companyId: string,
  query: string,
  limit?: number,
): Promise<SimilarCampaign[]> {
  const [topK, candidateLimit, rrfK] = await Promise.all([
    limit !== undefined ? Promise.resolve(limit) : getConfig(companyId, 'rag.top_k'),
    getConfig(companyId, 'rag.candidate_limit'),
    getConfig(companyId, 'rag.rrf_k'),
  ]);

  const vector = await embed(query);
  const literal = toVectorLiteral(vector);

  const rows = await prisma.$queryRaw<{ campaign_id: string | null; content: string; score: number }[]>`
    WITH vector_search AS (
      SELECT campaign_id, content, row_number() OVER (ORDER BY embedding <=> ${literal}::vector) AS rank
      FROM campaign_embeddings
      WHERE company_id = ${companyId}
      ORDER BY embedding <=> ${literal}::vector
      LIMIT ${candidateLimit}
    ),
    text_search AS (
      SELECT campaign_id, content,
        row_number() OVER (ORDER BY ts_rank_cd(content_tsv, websearch_to_tsquery('english', ${query})) DESC) AS rank
      FROM campaign_embeddings
      WHERE company_id = ${companyId} AND content_tsv @@ websearch_to_tsquery('english', ${query})
      ORDER BY ts_rank_cd(content_tsv, websearch_to_tsquery('english', ${query})) DESC
      LIMIT ${candidateLimit}
    )
    SELECT
      COALESCE(v.campaign_id, t.campaign_id) AS campaign_id,
      COALESCE(v.content, t.content) AS content,
      COALESCE(1.0 / (${rrfK} + v.rank), 0) + COALESCE(1.0 / (${rrfK} + t.rank), 0) AS score
    FROM vector_search v
    FULL OUTER JOIN text_search t ON v.campaign_id = t.campaign_id
    ORDER BY score DESC
    LIMIT ${topK}
  `;

  return rows.map((r) => ({ campaignId: r.campaign_id, content: r.content, score: Number(r.score) }));
}

/** Backfill entry point: every campaign for a tenant (or all tenants) that isn't embedded yet. */
export async function backfillCampaignEmbeddings(companyId?: string): Promise<number> {
  const alreadyEmbedded = await prisma.$queryRaw<{ campaign_id: string }[]>`
    SELECT DISTINCT campaign_id FROM campaign_embeddings WHERE campaign_id IS NOT NULL
  `;
  const done = new Set(alreadyEmbedded.map((r) => r.campaign_id));

  // Manual/admin backfill utility, not reachable from a request — `companyId`
  // omitted means "every tenant" by design, so this deliberately uses the
  // unguarded client (lib/prisma.ts's prismaSystem).
  const campaigns = await prismaSystem.campaign.findMany({
    where: companyId ? { companyId } : undefined,
    select: { id: true },
  });

  let count = 0;
  for (const c of campaigns) {
    if (done.has(c.id)) continue;
    try {
      await embedCampaignOutcome(c.id);
      count += 1;
    } catch (err) {
      logger.warn({ err, campaignId: c.id }, 'Failed to embed campaign, skipping');
    }
  }
  return count;
}
