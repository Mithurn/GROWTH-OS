import { z } from 'zod';
import { OpportunityTypeSchema } from './common';

/**
 * Phase 4 surface. Schemas exist so shadow can deny a real name with a
 * compact error. Handlers that write are not registered until live mode
 * is gated on by a per-tenant flag.
 */
export const CreateOpportunityArgs = z.object({
  opportunity_type: OpportunityTypeSchema,
  title: z.string().min(1).max(120).optional(),
});

export const DraftCampaignArgs = z.object({
  opportunity_id: z
    .string()
    .min(1, 'opportunity_id is required — copy it from growthos_list_opportunities'),
  channel: z.enum(['whatsapp', 'email', 'sms']).optional(),
});

export const RequestApprovalArgs = z.object({
  campaign_id: z
    .string()
    .min(1, 'campaign_id is required — copy it from a prior draft step'),
});

export const LaunchCampaignArgs = z.object({
  campaign_id: z
    .string()
    .min(1, 'campaign_id is required — only an approved campaign_id may be launched'),
});
