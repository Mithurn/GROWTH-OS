import { describe, it, expect, vi } from 'vitest';
import { openRouterPlanner } from '../agent-planner';

describe('openRouterPlanner', () => {
  it('finishes without calling the model when the platform cap vetoes', async () => {
    const complete = vi.fn();
    const charge = vi.fn();
    const planner = openRouterPlanner({
      complete: complete as never,
      charge,
      budget: async () => ({ allowed: false, reason: 'Platform key is capped at $0.', spent: 0 }),
    });

    const plan = await planner.plan({
      goal: 'grow repeat',
      steps: [],
      tools: [{ name: 'growthos_query_metrics', description: 'snapshot' }],
      companyId: 'co_1',
      runId: 'run_1',
    });

    expect(plan).toEqual({ type: 'finish', summary: 'Platform key is capped at $0.' });
    expect(complete).not.toHaveBeenCalled();
    expect(charge).not.toHaveBeenCalled();
  });

  it('records tokens after a completion', async () => {
    const charge = vi.fn().mockResolvedValue(undefined);
    const planner = openRouterPlanner({
      budget: async () => ({ allowed: true, spent: 0 }),
      charge,
      complete: (async () => ({
        usage: { prompt_tokens: 100, completion_tokens: 20 },
        choices: [
          {
            message: {
              tool_calls: [
                { function: { name: 'growthos_query_metrics', arguments: '{"response_format":"concise"}' } },
              ],
            },
          },
        ],
      })) as never,
    });

    const plan = await planner.plan({
      goal: 'grow repeat',
      steps: [],
      tools: [{ name: 'growthos_query_metrics', description: 'snapshot' }],
      companyId: 'co_1',
      runId: 'run_1',
    });

    expect(plan.type).toBe('calls');
    expect(charge).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'co_1',
        runId: 'run_1',
        provider: 'openrouter',
        tokensIn: 100,
        tokensOut: 20,
        source: 'platform',
      }),
    );
  });
});
