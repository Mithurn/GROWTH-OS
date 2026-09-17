import { describe, it, expect } from 'vitest';
import { runSupervisedAgent } from './run';
import { calls, finish, scriptedPlanner } from '../planner/scripted';
import { invokeTool } from '../tools/registry';
import type { RunContext, ToolHandler } from '../types';

const handlers: Record<string, ToolHandler> = {
  growthos_query_metrics: async () => ({ totalCustomers: 500, avgOrderValue: 1200 }),
  growthos_list_opportunities: async () => ({ audience_size: 174, data: [{ id: 'opp_1' }] }),
  growthos_estimate_impact: async () => ({ expectedRevenue: 9000, lowRevenue: 4000, highRevenue: 14000 }),
  growthos_draft_campaign: async () => ({ campaignId: 'camp_1' }),
  growthos_check_guardrails: async () => ({ allowed: true, reason: null }),
  growthos_think: async (args) => ({ noted: true, thought: (args as { thought: string }).thought }),
  growthos_finish: async (args) => ({ summary: (args as { summary: string }).summary }),
};

describe('role enforcement', () => {
  it('denies a discovery-role context calling a strategy-only tool', async () => {
    const ctx: RunContext = { companyId: 'co_1', runId: 'r1', goal: 'g', mode: 'shadow', role: 'discovery' };
    const outcome = await invokeTool({ name: 'growthos_draft_campaign', args: { opportunity_id: 'opp_1' } }, ctx, handlers);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toMatch(/discovery specialist/i);
  });

  it('allows a discovery-role context to call its own tools', async () => {
    const ctx: RunContext = { companyId: 'co_1', runId: 'r1', goal: 'g', mode: 'shadow', role: 'discovery' };
    const outcome = await invokeTool({ name: 'growthos_query_metrics', args: {} }, ctx, handlers);
    expect(outcome.ok).toBe(true);
  });

  it('a role can always reach growthos_think and growthos_finish', async () => {
    const ctx: RunContext = { companyId: 'co_1', runId: 'r1', goal: 'g', mode: 'shadow', role: 'guardrail' };
    expect((await invokeTool({ name: 'growthos_think', args: { thought: 'x' } }, ctx, handlers)).ok).toBe(true);
    expect((await invokeTool({ name: 'growthos_finish', args: { summary: 'x' } }, ctx, handlers)).ok).toBe(true);
  });
});

describe('runSupervisedAgent', () => {
  it('runs discovery, strategy, guardrail in order when discovery finds an audience', async () => {
    const seen: string[] = [];
    // scriptedPlanner is stateful across the whole run — each buildGrowthAgent call gets a fresh
    // graph but shares this one planner instance, so turns advance sequentially across all three roles.
    const planner = scriptedPlanner([
      calls([{ name: 'growthos_list_opportunities', args: {} }]),
      finish('found 174 in Retention-VIP'),
      calls([{ name: 'growthos_estimate_impact', args: { audience_size: 174, avg_order_value: 1200 } }]),
      finish('drafted a campaign at ₹9000 expected'),
      calls([{ name: 'growthos_check_guardrails', args: { potential_revenue: 9000 } }]),
      finish('guardrails pass'),
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

    expect(result.roles.map((r) => r.role)).toEqual(['discovery', 'strategy', 'guardrail']);
    expect(result.status).toBe('finished');
    expect(seen).toEqual([
      'start->discovery',
      'discovery->strategy',
      'strategy->guardrail',
      'guardrail->end',
    ]);
  });

  it('skips strategy and guardrail when discovery finds nothing', async () => {
    const emptyHandlers: Record<string, ToolHandler> = {
      ...handlers,
      growthos_list_opportunities: async () => ({ audience_size: 0, data: [] }),
    };
    const planner = scriptedPlanner([
      calls([{ name: 'growthos_list_opportunities', args: {} }]),
      finish('nothing found'),
    ]);

    const result = await runSupervisedAgent({
      companyId: 'co_1',
      goal: 'grow repeat purchases',
      runId: 'run_empty',
      planner,
      handlers: emptyHandlers,
    });

    expect(result.roles.map((r) => r.role)).toEqual(['discovery']);
  });

  it('gives each role a distinct checkpoint thread id derived from the run id', async () => {
    const threadIds: string[] = [];
    const planner = scriptedPlanner([
      calls([{ name: 'growthos_list_opportunities', args: {} }]),
      finish('a'),
      finish('b'),
      finish('c'),
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
      new Set(['run_threads:discovery', 'run_threads:strategy', 'run_threads:guardrail']),
    );
  });
});
