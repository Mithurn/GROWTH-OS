/**
 * Deterministic guardrail checks the agent cannot talk its way past.
 *
 * v1 of this logic lived as `AgentOrchestrator.meetsGuardrails` and only checked
 * `max_budget`, loosely. This is the same check, extracted so it can be unit tested and
 * so Phase 4 (docs/ARCHITECTURE_V2.md) can enforce it as a LangGraph node the model
 * cannot skip, rather than a helper the orchestrator happens to call. Extending this
 * with frequency caps, channel allowlists, and quiet hours is additive from here — see
 * PROGRESS.md Phase 4.
 */

export interface Guardrails {
  max_budget?: number;
  frequency_cap?: number;
  channels?: string[];
}

export interface GuardrailSubject {
  potentialRevenue: number;
  channel?: string;
}

export interface GuardrailResult {
  allowed: boolean;
  reason?: string;
}

export function checkGuardrails(subject: GuardrailSubject, guardrails: Guardrails): GuardrailResult {
  if (guardrails.max_budget !== undefined && subject.potentialRevenue > guardrails.max_budget) {
    return { allowed: false, reason: 'exceeds max_budget' };
  }

  if (
    guardrails.channels &&
    guardrails.channels.length > 0 &&
    subject.channel &&
    !guardrails.channels.includes(subject.channel)
  ) {
    return { allowed: false, reason: 'channel not in allowlist' };
  }

  return { allowed: true };
}
