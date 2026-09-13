import { describe, it, expect } from 'vitest';
import { buildGrowthAgent, runGrowthAgent } from '../graph/run';
import { OBSERVE_SCRIPT_TOOLS, observeScriptPlanner, toolSequence } from './observe-script';
import type { ToolHandler } from '../types';

const handlers: Record<string, ToolHandler> = {
  growthos_query_metrics: async () => ({
    totalCustomers: 500,
    avgOrderValue: 1200,
    churnRiskCustomers: 40,
  }),
  growthos_think: async (args) => ({ noted: true, thought: (args as { thought: string }).thought }),
  growthos_segment_customers: async (args) => ({
    opportunity_type: (args as { opportunity_type: string }).opportunity_type,
    audienceSize: 40,
    sampleCustomerIds: ['c1'],
  }),
  growthos_estimate_impact: async (args) => {
    const a = args as { audience_size: number; avg_order_value: number };
    expect(a.audience_size).toBe(40);
    expect(a.avg_order_value).toBe(1200);
    return { expectedRevenue: 9000, lowRevenue: 4000, highRevenue: 14000 };
  },
  growthos_check_guardrails: async (args) => {
    expect((args as { potential_revenue: number }).potential_revenue).toBe(14000);
    return { allowed: true };
  },
  growthos_finish: async (args) => ({ summary: (args as { summary: string }).summary }),
};

describe('observeScriptPlanner', () => {
  it('plays the golden tool sequence and cites handler numbers — not invented rupees', async () => {
    const graph = buildGrowthAgent({
      planner: observeScriptPlanner(),
      handlers,
      mode: 'shadow',
    });

    const out = await runGrowthAgent(graph, {
      companyId: 'co_real',
      goal: 'win back churned buyers',
      runId: 'run_observe_script',
    });

    expect(out.status).toBe('finished');
    expect(toolSequence(out.steps)).toEqual([...OBSERVE_SCRIPT_TOOLS]);
    expect(out.summary).toMatch(/audience 40/);
    expect(out.summary).toMatch(/4000–14000/);
    expect(out.summary).toMatch(/allowed/);
    expect(out.summary).toMatch(/Scripted observe/);
    expect(out.summary).toMatch(/Retention-Churn/);
  });

  it('sizes the largest coded segment from the snapshot, not a hardcoded churn tape', async () => {
    const graph = buildGrowthAgent({
      planner: observeScriptPlanner(),
      handlers: {
        ...handlers,
        growthos_query_metrics: async () => ({
          totalCustomers: 500,
          avgOrderValue: 1800,
          churnRiskCustomers: 0,
          vipCustomers: 12,
          dormantCustomers: 174,
          lowEngagementCustomers: 8,
        }),
        growthos_segment_customers: async (args) => {
          expect((args as { opportunity_type: string }).opportunity_type).toBe('Reactivation');
          return {
            opportunity_type: 'Reactivation',
            audienceSize: 174,
            sampleCustomerIds: ['c9'],
          };
        },
        growthos_estimate_impact: async (args) => {
          const a = args as { opportunity_type: string; audience_size: number };
          expect(a.opportunity_type).toBe('Reactivation');
          expect(a.audience_size).toBe(174);
          return { expectedRevenue: 20000, lowRevenue: 10000, highRevenue: 30000 };
        },
        growthos_check_guardrails: async () => ({ allowed: true }),
      },
      mode: 'shadow',
    });

    const out = await runGrowthAgent(graph, {
      companyId: 'co_real',
      goal: 'increase AOV',
      runId: 'run_reactivation',
    });

    expect(out.status).toBe('finished');
    expect(out.summary).toMatch(/Reactivation audience 174/);
    expect(out.summary).toMatch(/10000–30000/);
  });
});
