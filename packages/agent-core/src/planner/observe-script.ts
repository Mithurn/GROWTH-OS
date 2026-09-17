import type { Planner, TraceStep } from '../types';
import { calls, finish } from './scripted';

function resultOf(steps: TraceStep[], tool: string): Record<string, unknown> | undefined {
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const step = steps[i];
    if (step.tool === tool && step.result && typeof step.result === 'object') {
      return step.result as Record<string, unknown>;
    }
  }
  return undefined;
}

function hasResult(steps: TraceStep[], tool: string): boolean {
  return resultOf(steps, tool) !== undefined;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

const SEGMENTS = [
  { type: 'Retention-Churn', key: 'churnRiskCustomers' },
  { type: 'Retention-VIP', key: 'vipCustomers' },
  { type: 'Upsell', key: 'lowEngagementCustomers' },
  { type: 'Reactivation', key: 'dormantCustomers' },
] as const;

function pickOpportunityType(metrics?: Record<string, unknown>): (typeof SEGMENTS)[number]['type'] {
  let best: (typeof SEGMENTS)[number] = SEGMENTS[0];
  let bestN = -1;
  for (const segment of SEGMENTS) {
    const n = num(metrics?.[segment.key]);
    if (n > bestN) {
      best = segment;
      bestN = n;
    }
  }
  return best.type;
}

/**
 * Deterministic observe tape. Reads prior tool results — it does not invent
 * rupees. Used when there is no LLM key, and as the golden sequence a live
 * planner is later compared against. Not a recording of a paid model.
 */
export function observeScriptPlanner(): Planner {
  return {
    async plan({ steps }) {
      if (!hasResult(steps, 'growthos_query_metrics')) {
        return calls([{ name: 'growthos_query_metrics', args: { response_format: 'concise' } }]);
      }
      if (!hasResult(steps, 'growthos_think')) {
        return calls([
          {
            name: 'growthos_think',
            args: {
              thought:
                'Size the largest coded segment in this tenant snapshot. Audience membership is code, not a guess.',
            },
          },
        ]);
      }
      if (!hasResult(steps, 'growthos_segment_customers')) {
        const metrics = resultOf(steps, 'growthos_query_metrics');
        return calls([
          {
            name: 'growthos_segment_customers',
            args: {
              opportunity_type: pickOpportunityType(metrics),
              sample_limit: 5,
              response_format: 'concise',
            },
          },
        ]);
      }
      if (!hasResult(steps, 'growthos_estimate_impact')) {
        const metrics = resultOf(steps, 'growthos_query_metrics');
        const segment = resultOf(steps, 'growthos_segment_customers');
        const opportunityType =
          typeof segment?.opportunity_type === 'string'
            ? segment.opportunity_type
            : pickOpportunityType(metrics);
        return calls([
          {
            name: 'growthos_estimate_impact',
            args: {
              opportunity_type: opportunityType,
              audience_size: num(segment?.audienceSize),
              avg_order_value: num(metrics?.avgOrderValue),
            },
          },
        ]);
      }
      if (!hasResult(steps, 'growthos_check_guardrails')) {
        const estimate = resultOf(steps, 'growthos_estimate_impact');
        return calls([
          {
            name: 'growthos_check_guardrails',
            args: {
              potential_revenue: num(estimate?.highRevenue, num(estimate?.expectedRevenue)),
            },
          },
        ]);
      }

      const segment = resultOf(steps, 'growthos_segment_customers');
      const estimate = resultOf(steps, 'growthos_estimate_impact');
      const guard = resultOf(steps, 'growthos_check_guardrails');
      const allowed = guard?.allowed === true;
      return finish(
        `Scripted observe (no LLM). ${segment?.opportunity_type ?? 'Segment'} audience ${num(segment?.audienceSize)}; ` +
          `estimate ₹${num(estimate?.lowRevenue)}–${num(estimate?.highRevenue)}; ` +
          `guardrails ${allowed ? 'allowed' : 'blocked'}. Would draft if I could act.`,
      );
    },
  };
}

export const OBSERVE_SCRIPT_TOOLS = [
  'growthos_query_metrics',
  'growthos_think',
  'growthos_segment_customers',
  'growthos_estimate_impact',
  'growthos_check_guardrails',
  'growthos_finish',
] as const;

export function toolSequence(steps: { tool?: string }[]): string[] {
  return steps.filter((s) => s.tool).map((s) => s.tool as string);
}
