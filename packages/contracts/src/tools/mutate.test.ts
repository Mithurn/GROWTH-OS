import { describe, it, expect } from 'vitest';
import {
  CreateOpportunityArgs,
  DraftCampaignArgs,
  LaunchCampaignArgs,
  RequestApprovalArgs,
} from './mutate';

describe('Phase 4 tool args', () => {
  it('requires a coded opportunity_type', () => {
    expect(CreateOpportunityArgs.safeParse({}).success).toBe(false);
    expect(CreateOpportunityArgs.safeParse({ opportunity_type: 'custom' }).success).toBe(false);
    expect(CreateOpportunityArgs.safeParse({ opportunity_type: 'Retention-Churn' }).success).toBe(true);
  });

  it('refuses an empty opportunity_id / campaign_id', () => {
    expect(DraftCampaignArgs.safeParse({ opportunity_id: '' }).success).toBe(false);
    expect(RequestApprovalArgs.safeParse({ campaign_id: '' }).success).toBe(false);
    expect(LaunchCampaignArgs.safeParse({ campaign_id: '' }).success).toBe(false);
    expect(DraftCampaignArgs.safeParse({ opportunity_id: 'opp_1' }).success).toBe(true);
  });
});
