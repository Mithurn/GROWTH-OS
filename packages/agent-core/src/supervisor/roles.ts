import type { SupervisorRole } from '../types';

/**
 * Which tools each specialist may be offered and may call. `growthos_think`
 * and `growthos_finish` are available to every role — a specialist still
 * needs to reason and still needs a way to end its own turn.
 */
const SHARED_TOOLS = ['growthos_think', 'growthos_finish'];

export const ROLE_TOOLS: Record<SupervisorRole, string[]> = {
  strategy: [
    'growthos_query_metrics',
    'growthos_segment_customers',
    'growthos_list_opportunities',
    'growthos_estimate_impact',
    'growthos_search_prior_campaigns',
    ...SHARED_TOOLS,
  ],
  risk_reviewer: [
    'growthos_check_faithfulness',
    'growthos_search_prior_campaigns',
    'growthos_check_guardrails',
    'growthos_read_campaign_performance',
    ...SHARED_TOOLS,
  ],
};

/**
 * Fixed pipeline order — see run.ts for why the routing itself is
 * deterministic, not an LLM call. Faithfulness runs right after Strategy,
 * before Guardrail: check the draft is telling the truth before checking
 * whether it's within budget, not the other way round.
 */
export const ROLE_SEQUENCE: SupervisorRole[] = ['strategy', 'risk_reviewer'];
