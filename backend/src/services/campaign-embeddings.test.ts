import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../lib/prisma';
import * as embeddings from '../lib/embeddings';
import { embedCampaignOutcome, searchSimilarCampaigns, backfillCampaignEmbeddings } from './campaign-embeddings';

vi.mock('../lib/embeddings', () => ({
  embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  toVectorLiteral: (v: number[]) => `[${v.join(',')}]`,
}));

describe('embedCampaignOutcome', () => {
  beforeEach(() => vi.clearAllMocks());

  it('embeds the objective, channel, offer, message, and measured outcome, not a guess', async () => {
    vi.mocked(prisma.campaign.findUniqueOrThrow).mockResolvedValue({
      id: 'camp_1',
      companyId: 'co_1',
      name: 'Win-back',
      objective: 'Recover dormant VIPs',
      channel: 'WhatsApp',
      offer: '15% off',
      messageContent: 'Come back for 15% off',
      status: 'Launched',
      performance: { sent: 100, converted: 12, revenue: 45000 },
    } as never);

    await embedCampaignOutcome('camp_1');

    expect(embeddings.embed).toHaveBeenCalledWith(expect.stringContaining('100 sent, 12 converted, ₹45000 revenue'));
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('states the campaign has no recorded outcome instead of inventing one for an unlaunched draft', async () => {
    vi.mocked(prisma.campaign.findUniqueOrThrow).mockResolvedValue({
      id: 'camp_2',
      companyId: 'co_1',
      name: 'Draft',
      objective: 'x',
      channel: 'Email',
      offer: null,
      messageContent: 'x',
      status: 'Draft',
      performance: null,
    } as never);

    await embedCampaignOutcome('camp_2');

    expect(embeddings.embed).toHaveBeenCalledWith(expect.stringContaining('no delivery outcome recorded yet'));
  });
});

describe('searchSimilarCampaigns', () => {
  beforeEach(() => vi.clearAllMocks());

  it('scopes the query to the given company and returns ranked results', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { campaign_id: 'camp_1', content: 'VIP reward campaign', distance: 0.2 },
      { campaign_id: 'camp_2', content: 'churn win-back', distance: 0.6 },
    ]);

    const results = await searchSimilarCampaigns('co_1', 'reward loyal customers', 2);

    expect(results).toEqual([
      { campaignId: 'camp_1', content: 'VIP reward campaign', distance: 0.2 },
      { campaignId: 'camp_2', content: 'churn win-back', distance: 0.6 },
    ]);
  });

  it('returns an empty array, not an error, when there is no embedded history', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
    const results = await searchSimilarCampaigns('co_1', 'anything', 3);
    expect(results).toEqual([]);
  });
});

describe('backfillCampaignEmbeddings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('skips campaigns that already have an embedded row', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ campaign_id: 'camp_already_done' }]);
    vi.mocked(prisma.campaign.findMany).mockResolvedValue([
      { id: 'camp_already_done' },
      { id: 'camp_new' },
    ] as never);
    vi.mocked(prisma.campaign.findUniqueOrThrow).mockResolvedValue({
      id: 'camp_new',
      companyId: 'co_1',
      name: 'x',
      objective: 'x',
      channel: 'Email',
      offer: null,
      messageContent: 'x',
      status: 'Draft',
      performance: null,
    } as never);

    const count = await backfillCampaignEmbeddings();

    expect(count).toBe(1);
    expect(prisma.campaign.findUniqueOrThrow).toHaveBeenCalledTimes(1);
    expect(prisma.campaign.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'camp_new' } }),
    );
  });
});
