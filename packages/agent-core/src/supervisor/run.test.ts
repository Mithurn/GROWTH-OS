import { describe, it, expect } from 'vitest';
import { runSupervisedAgent } from './run';
import { calls, finish, scriptedPlanner } from '../planner/scripted';
import { invokeTool } from '../tools/registry';
import type { RunContext, ToolHandler } from '../types';

const handlers: Record<string, ToolHandler> = {
  growthos_query_metrics: async () => ({ totalCustomers: 500, avgOrderValue: 1200 }),
  growthos_list_opportunities: async () => ({ audience_size: 174, data: [{ id: 'opp_1' }] }),
  growthos_estimate_impact: async () => ({ expectedRevenue: 9000, lowRevenue: 4000, highRevenue: 14000 }),
  growthos_search_prior_campaigns: async () => ({ results: [{ campaign_id: 'camp_0', content: 'past VIP win-back', similarity: 0.8 }] }),
  growthos_draft_campaign: async () => ({ campaignId: 'camp_1' }),
  growthos_check_faithfulness: async () => ({ groundedness_score: 92, unsupported_claims: [], grounded_in: ['camp_0'] }),
  growthos_check_guardrails: async () => ({ allowed: true, reason: null }),
  growthos_think: async (args) => ({ noted: true, thought: (args as { thought: string }).thought }),
  growthos_finish: async (args) => ({ summary: (args as { summary: string }).summary }),
};

describe('role enforcement', () => {
  it('denies a strategist context calling a risk-only tool', async () => {
    const ctx: RunContext = { companyId: 'co_1', runId: 'r1', goal: 'g', mode: 'shadow', role: 'strategy' };
    const outcome = await invokeTool({ name: 'growthos_check_faithfulness', args: { draft: 'x' } }, ctx, handlers);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toMatch(/strategy specialist/i);
  });

  it('denies a risk reviewer context calling a strategist-only tool', async () => {
    const ctx: RunContext = { companyId: 'co_1', runId: 'r1', goal: 'g', mode: 'shadow', role: 'risk_reviewer' };
    const outcome = await invokeTool({ name: 'growthos_draft_campaign', args: { opportunity_id: 'opp_1' } }, ctx, handlers);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toMatch(/risk_reviewer specialist/i);
  });

  it('allows a strategist context to call its own tools', async () => {
    const ctx: RunContext = { companyId: 'co_1', runId: 'r1', goal: 'g', mode: 'shadow', role: 'strategy' };
    const outcome = await invokeTool({ name: 'growthos_query_metrics', args: {} }, ctx, handlers);
    expect(outcome.ok).toBe(true);
  });

  it('a role can always reach growthos_think and growthos_finish', async () => {
    const ctx: RunContext = { companyId: 'co_1', runId: 'r1', goal: 'g', mode: 'shadow', role: 'risk_reviewer' };
    expect((await invokeTool({ name: 'growthos_think', args: { thought: 'x' } }, ctx, handlers)).ok).toBe(true);
    expect((await invokeTool({ name: 'growthos_finish', args: { summary: 'x' } }, ctx, handlers)).ok).toBe(true);
  });

  it('allows the risk reviewer to search prior campaigns', async () => {
    const ctx: RunContext = { companyId: 'co_1', runId: 'r1', goal: 'g', mode: 'shadow', role: 'risk_reviewer' };
    const outcome = await invokeTool({ name: 'growthos_search_prior_campaigns', args: { query: 'x', limit: 3 } }, ctx, handlers);
    expect(outcome.ok).toBe(true);
  });
});

describe('runSupervisedAgent', () => {
  it('runs strategist then risk reviewer in order', async () => {
    const seen: string[] = [];
    const planner = scriptedPlanner([
      calls([{ name: 'growthos_list_opportunities', args: {} }]),
      finish('drafted a campaign at ₹9000 expected'),
      calls([{ name: 'growthos_check_faithfulness', args: { draft: 'Win back VIP customers with 15% off' } }]),
      calls([{ name: 'growthos_check_guardrails', args: { potential_revenue: 9000 } }]),
      finish('risk review passed'),
    ]);

    const result = await runSupervisedAgent({
      companyId: 'co_1',
      goal: 'grow repeat purchases',
      runId: 'run_seq',
      planner,
      handlers,
      onRoleTransition: (from, to) => {
        seen.push(`${from ?? 'start'}->${to ?? 'end'}`);
      },
    });

    expect(result.roles.map((r) => r.role)).toEqual(['strategy', 'risk_reviewer']);
    expect(result.status).toBe('finished');
    expect(seen).toEqual([
      'start->strategy',
      'strategy->risk_reviewer',
      'risk_reviewer->end',
    ]);
  });

  it('gives each role a distinct checkpoint thread id derived from the run id', async () => {
    const threadIds: string[] = [];
    const planner = scriptedPlanner([
      calls([{ name: 'growthos_list_opportunities', args: {} }]),
      finish('a'),
      finish('b'),
      finish('c'),
      finish('d'),
    ]);

    await runSupervisedAgent({
      companyId: 'co_1',
      goal: 'g',
      runId: 'run_threads',
      planner,
      handlers,
      onStep: (_step, ctx) => {
        threadIds.push(ctx.runId);
      },
    });

    expect(new Set(threadIds)).toEqual(
      new Set([
        'run_threads:strategy',
        'run_threads:risk_reviewer',
      ]),
    );
  });
});
