import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock('../config/openrouter', () => ({
  openai: { chat: { completions: { create: mockCreate } } },
  openRouterConfig: { configured: true, defaultModel: 'test-model' },
}));

vi.mock('./campaign-embeddings', () => ({
  searchSimilarCampaigns: vi.fn(),
}));

import { reviewCampaignFaithfulness } from './campaign-faithfulness';
import { searchSimilarCampaigns } from './campaign-embeddings';
import { openRouterConfig } from '../config/openrouter';

function completionWith(json: object) {
  return { choices: [{ message: { content: JSON.stringify(json) } }] };
}

describe('reviewCampaignFaithfulness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (openRouterConfig as { configured: boolean }).configured = true;
  });

  it('returns an honest unverified result when no LLM is configured', async () => {
    (openRouterConfig as { configured: boolean }).configured = false;
    const result = await reviewCampaignFaithfulness('co_1', 'draft text');
    expect(result.groundedness_score).toBeNull();
    expect(result.reasoning).toMatch(/no llm configured/i);
  });

  it('returns an honest empty result when there is no retrieval history', async () => {
    vi.mocked(searchSimilarCampaigns).mockResolvedValue([]);
    const result = await reviewCampaignFaithfulness('co_1', 'draft text');
    expect(result.groundedness_score).toBeNull();
    expect(result.reasoning).toMatch(/no prior campaign history/i);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('keeps a claim supported when it cites a campaign that was actually retrieved', async () => {
    vi.mocked(searchSimilarCampaigns).mockResolvedValue([
      { campaignId: 'camp_real', content: '15% off win-back, 12% conversion', score: 0.03 },
    ]);
    mockCreate.mockResolvedValue(completionWith({
      groundedness_score: 90,
      claims: [{ text: '15% off drives strong conversion', supported: true, cited_campaign_ids: ['camp_real'] }],
      reasoning: 'Matches prior campaign data.',
    }));

    const result = await reviewCampaignFaithfulness('co_1', '15% off drives strong conversion');
    expect(result.unsupported_claims).toEqual([]);
    expect(result.claims[0]).toMatchObject({ supported: true, citedCampaignIds: ['camp_real'] });
    expect(result.grounded_in).toEqual(['camp_real']);
  });

  it('downgrades a claim to unsupported when it cites a campaign id that was never retrieved', async () => {
    vi.mocked(searchSimilarCampaigns).mockResolvedValue([
      { campaignId: 'camp_real', content: 'real evidence', score: 0.03 },
    ]);
    mockCreate.mockResolvedValue(completionWith({
      groundedness_score: 80,
      claims: [{ text: 'a made-up statistic', supported: true, cited_campaign_ids: ['camp_hallucinated'] }],
      reasoning: 'Looks plausible.',
    }));

    const result = await reviewCampaignFaithfulness('co_1', 'draft citing a made-up statistic');
    expect(result.unsupported_claims).toEqual(['a made-up statistic']);
    expect(result.claims[0]).toMatchObject({ supported: false, citedCampaignIds: [] });
  });

  it('reports an honest unverified result when the judge call fails', async () => {
    vi.mocked(searchSimilarCampaigns).mockResolvedValue([
      { campaignId: 'camp_real', content: 'real evidence', score: 0.03 },
    ]);
    mockCreate.mockRejectedValue(new Error('upstream timeout'));

    const result = await reviewCampaignFaithfulness('co_1', 'draft text');
    expect(result.groundedness_score).toBeNull();
    expect(result.reasoning).toMatch(/unverified/i);
  });
});
