import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../../lib/prisma';
import { runShadowObserve } from '../agent-shadow';
import { calls, finish, scriptedPlanner } from '@growthos/agent-core';
import type { ToolHandler } from '@growthos/agent-core';

const handlers: Record<string, ToolHandler> = {
  growthos_query_metrics: async () => ({ totalCustomers: 10 }),
  growthos_finish: async (args) => ({ summary: (args as { summary: string }).summary }),
};

function observePlanner() {
  return scriptedPlanner([
    calls([{ name: 'growthos_query_metrics', args: { response_format: 'concise' } }]),
    finish('Churn-risk is the play. Would draft if I could act.'),
  ]);
}

beforeEach(() => {
  vi.mocked(prisma.agentRun.create).mockReset();
  vi.mocked(prisma.agentRun.update).mockReset();
  vi.mocked(prisma.agentStep.create).mockReset();
});

describe('runShadowObserve', () => {
  it('still finishes when agent_runs cannot be written', async () => {
    vi.mocked(prisma.agentRun.create).mockRejectedValue(new Error('relation "agent_runs" does not exist'));

    const out = await runShadowObserve(
      { companyId: 'co_1', agentId: 'ag_1', goal: 'grow repeat' },
      { planner: observePlanner(), handlers },
    );

    expect(out.status).toBe('finished');
    expect(out.summary).toMatch(/Churn-risk/);
    expect(prisma.agentStep.create).not.toHaveBeenCalled();
    expect(prisma.agentRun.update).not.toHaveBeenCalled();
  });

  it('persists the run and each step when the tables exist', async () => {
    vi.mocked(prisma.agentRun.create).mockResolvedValue({ id: 'run_db' } as never);
    vi.mocked(prisma.agentStep.create).mockResolvedValue({} as never);
    vi.mocked(prisma.agentRun.update).mockResolvedValue({} as never);

    const out = await runShadowObserve(
      { companyId: 'co_1', agentId: 'ag_1', goal: 'grow repeat' },
      { planner: observePlanner(), handlers },
    );

    expect(out.status).toBe('finished');
    expect(prisma.agentRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: 'co_1',
          agentId: 'ag_1',
          mode: 'shadow',
        }),
      }),
    );
    expect(prisma.agentStep.create).toHaveBeenCalled();
    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'run_db' },
        data: expect.objectContaining({ status: 'finished' }),
      }),
    );
  });

  it('SHADOW_PLANNER=scripted runs the observe tape through real handlers', async () => {
    vi.mocked(prisma.agentRun.create).mockRejectedValue(new Error('missing table'));
    const previous = process.env.SHADOW_PLANNER;
    process.env.SHADOW_PLANNER = 'scripted';

    try {
      const out = await runShadowObserve({ companyId: 'co_1', agentId: 'ag_1', goal: 'grow repeat' });
      expect(out.status).toBe('finished');
      expect(out.summary).toMatch(/Scripted observe/);
    } finally {
      if (previous === undefined) delete process.env.SHADOW_PLANNER;
      else process.env.SHADOW_PLANNER = previous;
    }
  });
});
