import { describe, it, expect } from 'vitest';
import { GenerateCampaignSchema, RefineCampaignSchema, SaveCampaignSchema } from './campaigns';

describe('GenerateCampaignSchema', () => {
  it('requires an opportunityId', () => {
    expect(GenerateCampaignSchema.safeParse({}).success).toBe(false);
    expect(GenerateCampaignSchema.safeParse({ opportunityId: '' }).success).toBe(false);
    expect(GenerateCampaignSchema.safeParse({ opportunityId: 'opp_1' }).success).toBe(true);
  });
});

describe('SaveCampaignSchema', () => {
  it('requires both an opportunityId and a campaign body', () => {
    expect(SaveCampaignSchema.safeParse({ opportunityId: 'opp_1' }).success).toBe(false);
    expect(SaveCampaignSchema.safeParse({ opportunityId: 'opp_1', campaign: {} }).success).toBe(true);
  });
});

describe('RefineCampaignSchema', () => {
  it('defaults modifier to an empty string so a channel-only refine is valid', () => {
    expect(RefineCampaignSchema.parse({ channel: 'email' })).toEqual({ modifier: '', channel: 'email' });
    expect(RefineCampaignSchema.parse({})).toEqual({ modifier: '' });
  });
});
