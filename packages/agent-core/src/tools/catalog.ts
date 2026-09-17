import type { ZodType } from 'zod';
import {
  CheckGuardrailsArgs,
  CreateOpportunityArgs,
  DraftCampaignArgs,
  EstimateImpactArgs,
  FinishArgs,
  LaunchCampaignArgs,
  ListOpportunitiesArgs,
  QueryMetricsArgs,
  ReadCampaignPerformanceArgs,
  RequestApprovalArgs,
  SearchPriorCampaignsArgs,
  SegmentCustomersArgs,
  ThinkArgs,
} from '@growthos/contracts';
import type { ToolKind, ToolSpec } from '../types';

function spec(
  name: string,
  kind: ToolKind,
  description: string,
  inputSchema: ZodType<unknown>,
): ToolSpec {
  return { name, kind, description, inputSchema };
}

/**
 * The bound tool surface. Namespaced (`growthos_`) so an MCP client that also
 * sees other servers can tell them apart — Anthropic, *Writing effective tools*.
 * Shadow mode binds only `read` + `control`. Live handlers exist but the
 * orchestrator never sets live. `resolvePermissionMode` requires AGENT_LIVE=1
 * and `guardrails.live === true`.
 */
export const TOOL_CATALOG: ToolSpec[] = [
  spec(
    'growthos_query_metrics',
    'read',
    'Tenant-level snapshot: customer count, AOV, spend, and the four coded segment sizes (churn-risk, VIP, dormant, low-engagement). Use this first. Default response is concise. Never ask it for a customer list — that wastes the context window.',
    QueryMetricsArgs,
  ),
  spec(
    'growthos_segment_customers',
    'read',
    'How many customers match one coded opportunity type, plus a small sample of ids. opportunity_type must be one of Retention-Churn, Retention-VIP, Upsell, Reactivation. You cannot invent a custom predicate — audience membership is code, not a prompt.',
    SegmentCustomersArgs,
  ),
  spec(
    'growthos_list_opportunities',
    'read',
    'Opportunities that already exist for this tenant (title, type, audience size, estimated revenue interval). Use before recommending a new one. Default limit 5, max 8.',
    ListOpportunitiesArgs,
  ),
  spec(
    'growthos_estimate_impact',
    'read',
    'Deterministic revenue interval for a segment: Bayesian shrinkage over this tenant\'s own campaign history × audience size × AOV. Pass audience_size and avg_order_value from prior tool results. Do not guess rupees yourself — that is why this tool exists.',
    EstimateImpactArgs,
  ),
  spec(
    'growthos_read_campaign_performance',
    'read',
    'Delivery funnel for one campaign_id (sent / delivered / read / clicked / failed / converted). campaign_id must come from a prior observation, never invented.',
    ReadCampaignPerformanceArgs,
  ),
  spec(
    'growthos_search_prior_campaigns',
    'read',
    'Semantic search over past campaign outcomes. Not implemented until Phase 7 (pgvector). Calling it returns an honest empty result and the reason — do not treat emptiness as "no history."',
    SearchPriorCampaignsArgs,
  ),
  spec(
    'growthos_check_guardrails',
    'read',
    'Deterministic budget and channel-allowlist check. Pass potential_revenue from estimate_impact, not a number you invented. Returns { allowed, reason }.',
    CheckGuardrailsArgs,
  ),
  spec(
    'growthos_think',
    'control',
    'Scratchpad. Write the reasoning for the next tool choice here before you call it, especially when two opportunity types could fit. The thought is recorded in the run trace.',
    ThinkArgs,
  ),
  spec(
    'growthos_finish',
    'control',
    'End the run. Required argument: a short summary of what you observed and what you would recommend. In shadow mode this is the only terminal action — you cannot create, draft, or launch.',
    FinishArgs,
  ),
  spec(
    'growthos_create_opportunity',
    'mutating',
    'Create one coded opportunity for this tenant. Not bound in shadow mode. opportunity_type is required; title is optional.',
    CreateOpportunityArgs,
  ),
  spec(
    'growthos_draft_campaign',
    'mutating',
    'Draft a campaign against an existing opportunity_id. Not bound in shadow mode.',
    DraftCampaignArgs,
  ),
  spec(
    'growthos_request_approval',
    'mutating',
    'Pause for a human decision on a campaign_id (interrupt). Not bound in shadow mode.',
    RequestApprovalArgs,
  ),
  spec(
    'growthos_launch_campaign',
    'external',
    'Claim-then-send an approved campaign. Not bound in shadow mode. Ledger owns the send.',
    LaunchCampaignArgs,
  ),
];

export const SHADOW_KINDS: ToolKind[] = ['read', 'control'];
