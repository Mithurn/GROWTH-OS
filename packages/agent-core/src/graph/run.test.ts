import { describe, it, expect } from 'vitest';
import { buildGrowthAgent, runGrowthAgent } from './run';
import { calls, finish, scriptedPlanner } from '../planner/scripted';
import { catalogFor, invokeTool } from '../tools/registry';
import type { RunContext, ToolHandler } from '../types';

const ctx: RunContext = {
  companyId: 'co_real',
  runId: 'run_1',
  goal: 'win back churned buyers',
  mode: 'shadow',
};

const handlers: Record<string, ToolHandler> = {
  growthos_query_metrics: async (_args, run) => ({
    totalCustomers: 500,
    avgOrderValue: 1200,
    companyIdEcho: run.companyId,
  }),
  growthos_estimate_impact: async () => ({
    expectedRevenue: 9000,
    lowRevenue: 4000,
    highRevenue: 14000,
  }),
  growthos_think: async (args) => ({ noted: true, thought: (args as { thought: string }).thought }),
  growthos_finish: async (args) => ({ summary: (args as { summary: string }).summary }),
};

describe('permission gate', () => {
  it('strips a smuggled companyId and injects the runtime tenant', async () => {
    const outcome = await invokeTool(
      { name: 'growthos_query_metrics', args: { companyId: 'co_attacker', response_format: 'concise' } },
      ctx,
      handlers,
    );
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result).toMatchObject({ companyIdEcho: 'co_real' });
    }
  });

  it('refuses a mutating tool name in shadow mode with an actionable error', async () => {
    const outcome = await invokeTool(
      { name: 'growthos_create_opportunity', args: { opportunity_type: 'Retention-Churn' } },
      ctx,
      handlers,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toMatch(/not bound/i);
      expect(outcome.error).toMatch(/growthos_query_metrics/);
    }
  });

  it('lists mutating tools in live catalog and hides them in shadow', () => {
    const shadow = catalogFor('shadow').map((t) => t.name);
    const live = catalogFor('live').map((t) => t.name);
    expect(shadow).not.toContain('growthos_create_opportunity');
    expect(live).toContain('growthos_create_opportunity');
    expect(live).toContain('growthos_launch_campaign');
  });

  it('returns a compact, fixable error for bad args — not a stack trace', async () => {
    const outcome = await invokeTool(
      { name: 'growthos_read_campaign_performance', args: { campaign_id: '' } },
      ctx,
      { growthos_read_campaign_performance: async () => ({}) },
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).not.toMatch(/at /);
      expect(outcome.error).toMatch(/campaign_id/);
    }
  });
});

describe('harness loop', () => {
  it('runs a scripted observe → estimate → finish trace on one thread', async () => {
    const graph = buildGrowthAgent({
      planner: scriptedPlanner([
        calls([{ name: 'growthos_query_metrics', args: { response_format: 'concise' } }]),
        calls([{ name: 'growthos_think', args: { thought: 'churn segment is the fit' } }]),
        calls([
          {
            name: 'growthos_estimate_impact',
            args: { opportunity_type: 'Retention-Churn', audience_size: 40, avg_order_value: 1200 },
          },
        ]),
        finish('Churn-risk is the play; estimated ₹4k–14k. Would draft if I could act.'),
      ]),
      handlers,
      mode: 'shadow',
      maxSteps: 8,
    });

    const out = await runGrowthAgent(graph, {
      companyId: 'co_real',
      goal: 'win back churned buyers',
      runId: 'run_scripted',
    });

    expect(out.status).toBe('finished');
    expect(out.summary).toMatch(/Churn-risk/);
    expect(out.steps.some((s) => s.tool === 'growthos_query_metrics')).toBe(true);
    expect(out.steps.some((s) => s.tool === 'growthos_estimate_impact')).toBe(true);
    expect(out.companyId).toBe('co_real');
  });

  it('stops instead of spinning when the planner idles twice', async () => {
    const graph = buildGrowthAgent({
      planner: scriptedPlanner([]),
      handlers,
      mode: 'shadow',
    });
    const out = await runGrowthAgent(graph, {
      companyId: 'co_real',
      goal: 'g',
      runId: 'run_idle',
    });
    expect(out.status).toBe('stopped');
    expect(out.summary).toMatch(/no actions/i);
  });

  it('does not leak trace state across thread_ids', async () => {
    const graph = buildGrowthAgent({
      planner: scriptedPlanner([
        finish('A done'),
        finish('B done'),
      ]),
      handlers,
    });

    const a = await runGrowthAgent(graph, { companyId: 'co_a', goal: 'ga', runId: 'run_a' });
    const b = await runGrowthAgent(graph, { companyId: 'co_b', goal: 'gb', runId: 'run_b' });

    expect(a.companyId).toBe('co_a');
    expect(a.summary).toBe('A done');
    expect(b.companyId).toBe('co_b');
    expect(b.summary).toBe('B done');
  });

  it('injects guardrails into tool context — the model cannot set them', async () => {
    let seen: unknown;
    const graph = buildGrowthAgent({
      planner: scriptedPlanner([
        calls([{ name: 'growthos_check_guardrails', args: { potential_revenue: 10_000 } }]),
        finish('checked'),
      ]),
      handlers: {
        ...handlers,
        growthos_check_guardrails: async (_args, run) => {
          seen = run.guardrails;
          return { allowed: true };
        },
      },
    });

    await runGrowthAgent(graph, {
      companyId: 'co_real',
      goal: 'g',
      runId: 'run_guard',
      guardrails: { max_budget: 5000, channels: ['whatsapp'] },
    });

    expect(seen).toEqual({ max_budget: 5000, channels: ['whatsapp'] });
  });

  it('stops when the wall-clock slice is exceeded', async () => {
    const graph = buildGrowthAgent({
      planner: {
        async plan() {
          await new Promise((r) => setTimeout(r, 20));
          return { type: 'finish', summary: 'should not finish' };
        },
      },
      handlers,
      maxWallMs: 5,
    });

    const out = await runGrowthAgent(graph, {
      companyId: 'co_real',
      goal: 'g',
      runId: 'run_wall',
    });

    expect(out.status).toBe('stopped');
    expect(out.summary).toMatch(/wall-clock/i);
  });
});
