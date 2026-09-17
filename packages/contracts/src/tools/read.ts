import { z } from 'zod';
import { OpportunityTypeSchema, ResponseFormat } from './common';

/** Snapshot of this tenant. Never accepts companyId — the runtime injects it. */
export const QueryMetricsArgs = z.object({
  response_format: ResponseFormat,
});

/** Size + sample for one coded segment. The model picks a type, not a predicate. */
export const SegmentCustomersArgs = z.object({
  opportunity_type: OpportunityTypeSchema,
  sample_limit: z.number().int().min(1).max(8).default(5),
  response_format: ResponseFormat,
});

export const ListOpportunitiesArgs = z.object({
  limit: z.number().int().min(1).max(8).default(5),
  response_format: ResponseFormat,
});

export const EstimateImpactArgs = z.object({
  opportunity_type: OpportunityTypeSchema,
  audience_size: z.number().int().min(0),
  avg_order_value: z.number().min(0),
});

export const ReadCampaignPerformanceArgs = z.object({
  campaign_id: z.string().min(1, 'campaign_id is required — copy it from growthos_list_opportunities or a prior step, do not invent one'),
  response_format: ResponseFormat,
});

export const SearchPriorCampaignsArgs = z.object({
  query: z.string().min(1).max(200),
  limit: z.number().int().min(1).max(5).default(3),
});

export const CheckGuardrailsArgs = z.object({
  potential_revenue: z.number().min(0),
  channel: z.string().optional(),
});

export const ThinkArgs = z.object({
  thought: z.string().min(1).max(2000),
});

export const FinishArgs = z.object({
  summary: z.string().min(1, 'finish requires a non-empty summary of what you observed').max(2000),
});
