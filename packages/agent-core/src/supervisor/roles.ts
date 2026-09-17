import type { SupervisorRole } from '../types';

/**
 * Which tools each specialist may be offered and may call. `growthos_think`
 * and `growthos_finish` are available to every role — a specialist still
 * needs to reason and still needs a way to end its own turn.
 */
const SHARED_TOOLS = ['growthos_think', 'growthos_finish'];

export const ROLE_TOOLS: Record<SupervisorRole, string[]> = {
  discovery: [
    'growthos_query_metrics',
    'growthos_segment_customers',
    'growthos_list_opportunities',
    ...SHARED_TOOLS,
  ],
  strategy: [
    'growthos_estimate_impact',
    'growthos_search_prior_campaigns',
    'growthos_draft_campaign',
    ...SHARED_TOOLS,
  ],
  guardrail: [
    'growthos_check_guardrails',
    'growthos_read_campaign_performance',
    ...SHARED_TOOLS,
  ],
};

/** Fixed pipeline order — see run.ts for why the routing itself is deterministic, not an LLM call. */
export const ROLE_SEQUENCE: SupervisorRole[] = ['discovery', 'strategy', 'guardrail'];
