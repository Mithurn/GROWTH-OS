/**
 * Shapes returned by the backend API.
 *
 * These mirror the interfaces the backend exports (`services/campaigns.ts`,
 * `services/opportunities.ts`) and the Prisma schema. They are hand-maintained: the
 * two services deploy separately, so a change on either side has to be reflected here.
 * Keep field names in the backend's snake_case — they come straight off the DB rows.
 */

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export type Channel = 'WhatsApp' | 'Email' | 'SMS';

export type OpportunityStatus =
  | 'Discovered'
  | 'Campaign Created'
  | 'Campaign Launched'
  | 'Completed'
  | 'Dismissed';

export type CampaignStatus = 'Draft' | 'Approved' | 'Launched' | 'Completed';

/** A campaign row as stored. */
export interface Campaign {
  id: string;
  company_id: string;
  opportunity_id: string;
  name: string;
  objective: string;
  channel: string;
  offer: string | null;
  message_angle: string | null;
  message_content: string;
  expected_outcome: string | null;
  reasoning: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  launched_at: string | null;
  completed_at: string | null;
}

/** A campaign row joined with its delivery counters. */
export interface CampaignWithMetrics extends Campaign {
  audience_size: number;
  communications_sent: number;
  communications_delivered: number;
  communications_read: number;
  communications_clicked: number;
  communications_failed: number;
}

/**
 * An AI-drafted campaign, before it is saved. Distinct from `Campaign`: it has no id
 * yet and carries `campaign_content` rather than the persisted `message_content`.
 */
export interface GeneratedCampaign {
  id?: string;
  name: string;
  objective: string;
  channel: Channel;
  offer: string;
  message_angle: string;
  campaign_content: string;
  expected_outcome: string;
  reasoning: string;
}

export interface Opportunity {
  opportunity_id: string;
  opportunity_key: string;
  opportunity_type: string;
  title: string;
  description: string;
  audience_size: number;
  potential_revenue: number;
  confidence_score: number;
  priority_score: number;
  supporting_customer_segment: string;
  recommended_action: string;
  audience_definition: Record<string, unknown>;
  trigger_reason: string;
  ai_summary: string;
  predicted_conversion_rate?: number | null;
  alternative_strategies?: Array<{ title: string; conversion_rate: number; note: string }> | null;
  opportunity_personas?: Array<{ name: string; description: string }> | null;
  status: OpportunityStatus;
  customer_count: number;
  average_spend: number;
  average_orders: number;
  revenue_share: number;
}

export interface OpportunityReport {
  generatedAt: string;
  companyId: string;
  totalCustomers: number;
  totalOpportunities: number;
  totalRevenuePotential: number;
  topOpportunities: Opportunity[];
  opportunityDistribution: Opportunity[];
  validation: {
    everyOpportunityHasAudience: boolean;
    everyOpportunityHasSummary: boolean;
    confidenceScoresPopulated: boolean;
    opportunityCountReasonable: boolean;
  };
}

/** Limits an autonomous agent must respect. Stored as JSON on the agent row. */
export interface AgentGuardrails {
  max_budget?: number;
  frequency_cap?: number;
  channels?: string[];
  [key: string]: unknown;
}
