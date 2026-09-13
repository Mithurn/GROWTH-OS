import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

function tableMissing(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /agent_runs|agent_steps|does not exist|P2021/i.test(message);
}

export async function listAgentRuns(input: {
  companyId: string;
  agentId: string;
  page: number;
  limit: number;
}) {
  try {
    const where = { companyId: input.companyId, agentId: input.agentId };
    const [rows, total] = await Promise.all([
      prisma.agentRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        select: {
          id: true,
          threadId: true,
          goal: true,
          status: true,
          summary: true,
          stepCount: true,
          mode: true,
          startedAt: true,
          finishedAt: true,
        },
      }),
      prisma.agentRun.count({ where }),
    ]);
    return {
      available: true,
      data: rows,
      meta: { page: input.page, limit: input.limit, total, pages: Math.ceil(total / input.limit) },
    };
  } catch (err) {
    if (!tableMissing(err)) logger.warn({ err }, 'listAgentRuns failed');
    return {
      available: false,
      data: [],
      meta: { page: input.page, limit: input.limit, total: 0, pages: 0 },
    };
  }
}

export async function getAgentRun(input: { companyId: string; agentId: string; runId: string }) {
  try {
    const run = await prisma.agentRun.findFirst({
      where: { id: input.runId, companyId: input.companyId, agentId: input.agentId },
    });
    if (!run) return { available: true, data: null };
    const steps = await prisma.agentStep.findMany({
      where: { runId: run.id, companyId: input.companyId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        node: true,
        toolName: true,
        args: true,
        result: true,
        error: true,
        latencyMs: true,
        createdAt: true,
      },
    });
    return { available: true, data: { ...run, steps } };
  } catch (err) {
    if (!tableMissing(err)) logger.warn({ err }, 'getAgentRun failed');
    return { available: false, data: null };
  }
}
