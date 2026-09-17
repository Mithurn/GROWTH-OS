import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../../lib/prisma';
import { getAgentRun, listAgentRuns } from '../agent-runs';

beforeEach(() => {
  vi.mocked(prisma.agentRun.findMany).mockReset();
  vi.mocked(prisma.agentRun.findFirst).mockReset();
  vi.mocked(prisma.agentRun.count).mockReset();
  vi.mocked(prisma.agentStep.findMany).mockReset();
});

describe('listAgentRuns', () => {
  it('returns available:false when the table is missing', async () => {
    vi.mocked(prisma.agentRun.findMany).mockRejectedValue(new Error('relation "agent_runs" does not exist'));
    const out = await listAgentRuns({ companyId: 'co_1', agentId: 'ag_1', page: 1, limit: 20 });
    expect(out.available).toBe(false);
    expect(out.data).toEqual([]);
  });

  it('lists runs for this tenant and agent only', async () => {
    vi.mocked(prisma.agentRun.findMany).mockResolvedValue([{ id: 'run_1', summary: 'ok' }] as never);
    vi.mocked(prisma.agentRun.count).mockResolvedValue(1);
    const out = await listAgentRuns({ companyId: 'co_1', agentId: 'ag_1', page: 1, limit: 20 });
    expect(out.available).toBe(true);
    expect(out.data).toHaveLength(1);
    expect(prisma.agentRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'co_1', agentId: 'ag_1' } }),
    );
  });
});

describe('getAgentRun', () => {
  it('returns null data when the run is missing', async () => {
    vi.mocked(prisma.agentRun.findFirst).mockResolvedValue(null);
    const out = await getAgentRun({ companyId: 'co_1', agentId: 'ag_1', runId: 'run_x' });
    expect(out.available).toBe(true);
    expect(out.data).toBeNull();
  });

  it('includes steps when the run exists', async () => {
    vi.mocked(prisma.agentRun.findFirst).mockResolvedValue({ id: 'run_1', companyId: 'co_1' } as never);
    vi.mocked(prisma.agentStep.findMany).mockResolvedValue([{ id: 's1', toolName: 'growthos_finish' }] as never);
    const out = await getAgentRun({ companyId: 'co_1', agentId: 'ag_1', runId: 'run_1' });
    expect(out.available).toBe(true);
    expect(out.data).toMatchObject({ id: 'run_1', steps: [{ id: 's1' }] });
    expect(prisma.agentRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'run_1', companyId: 'co_1', agentId: 'ag_1' } }),
    );
  });
});
