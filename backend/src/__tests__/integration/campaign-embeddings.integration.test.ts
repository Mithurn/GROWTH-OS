import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startTestDb, type TestDb } from './testDb';

describe('campaign embeddings — real Postgres constraint and upsert', () => {
  let db: TestDb;
  let companyId: string;
  let previousDatabaseUrl: string | undefined;

  beforeAll(async () => {
    db = await startTestDb();
    previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = db.connectionUri;
    vi.resetModules();

    const company = await db.prisma.company.create({
      data: { companyName: `Embeddings ${Date.now()}` },
    });
    companyId = company.id;
  }, 60_000);

  afterAll(async () => {
    const { prisma } = await import('../../lib/prisma');
    await prisma.$disconnect();
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    await db?.stop();
  });

  async function createCampaign(key: string) {
    const opportunity = await db.prisma.opportunity.create({
      data: {
        companyId,
        opportunityKey: key,
        opportunityType: 'Retention-Churn',
        title: key,
        description: key,
        audienceSize: 1,
        potentialRevenue: 100,
        confidenceScore: 1,
        priorityScore: 1,
        recommendedAction: 'Test',
        supportingCustomerSegment: 'Test',
        audienceDefinition: {},
        triggerReason: 'Test',
        aiSummary: 'Test',
      },
    });
    return db.prisma.campaign.create({
      data: {
        companyId,
        opportunityId: opportunity.id,
        name: key,
        objective: key,
        channel: 'Email',
        messageContent: key,
      },
    });
  }

  it('re-embedding the same campaign updates the row instead of creating a duplicate', async () => {
    const campaign = await createCampaign('embed-once');
    const { embedCampaignOutcome } = await import('../../services/campaign-embeddings');

    await embedCampaignOutcome(campaign.id);
    await embedCampaignOutcome(campaign.id);

    const rows = await db.prisma.$queryRaw<{ count: number }[]>`
      SELECT count(*)::int AS count FROM campaign_embeddings WHERE campaign_id = ${campaign.id}
    `;
    expect(rows[0].count).toBe(1);
  }, 30_000);

  it('bumps source_version only when the embedded content actually changed', async () => {
    const campaign = await createCampaign('embed-version');
    const { embedCampaignOutcome } = await import('../../services/campaign-embeddings');

    await embedCampaignOutcome(campaign.id);
    const afterFirst = await db.prisma.$queryRaw<{ source_version: number; content_hash: string }[]>`
      SELECT source_version, content_hash FROM campaign_embeddings WHERE campaign_id = ${campaign.id}
    `;
    expect(afterFirst[0].source_version).toBe(1);

    // Re-embed with no change to the campaign's content — same row, version unchanged.
    await embedCampaignOutcome(campaign.id);
    const afterNoop = await db.prisma.$queryRaw<{ source_version: number; content_hash: string }[]>`
      SELECT source_version, content_hash FROM campaign_embeddings WHERE campaign_id = ${campaign.id}
    `;
    expect(afterNoop[0].source_version).toBe(1);
    expect(afterNoop[0].content_hash).toBe(afterFirst[0].content_hash);

    // Now the campaign has a real measured outcome — the embedded content changes.
    await db.prisma.campaign.update({
      where: { id: campaign.id },
      data: { performance: { sent: 10, converted: 2, revenue: 5000 } },
    });
    await embedCampaignOutcome(campaign.id);
    const afterChange = await db.prisma.$queryRaw<{ source_version: number; content_hash: string }[]>`
      SELECT source_version, content_hash FROM campaign_embeddings WHERE campaign_id = ${campaign.id}
    `;
    expect(afterChange[0].source_version).toBe(2);
    expect(afterChange[0].content_hash).not.toBe(afterFirst[0].content_hash);
  }, 30_000);
});
