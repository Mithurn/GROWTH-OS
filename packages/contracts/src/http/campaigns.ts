import { z } from 'zod';

export const GenerateCampaignSchema = z.object({
  opportunityId: z.string().min(1, 'opportunityId is required'),
  model: z.string().optional(),
});

export const SaveCampaignSchema = z.object({
  opportunityId: z.string().min(1, 'opportunityId is required'),
  campaign: z.record(z.string(), z.unknown()),
});

export const RefineCampaignSchema = z.object({
  modifier: z.string().optional().default(''),
  channel:  z.string().optional(),
});
