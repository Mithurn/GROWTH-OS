import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import {
  buildGrowthAgent,
  observeScriptPlanner,
  runGrowthAgent,
  runSupervisedAgent,
  type Planner,
  type RunContext,
  type ToolHandler,
  type TraceStep,
} from '@growthos/agent-core';
import { buildToolHandlers } from './agent-tool-handlers';
import { openRouterConfig } from '../config/openrouter';
import { openRouterPlanner } from './agent-planner';
import { emitActivity } from '../lib/activity-emitter';
import { getAgentCheckpointer } from '../lib/agent-checkpointer';
import { getConfig } from '../lib/config';

function resolvePlanner(override?: Planner): Planner {
  if (override) return override;
  const forceScript = process.env.SHADOW_PLANNER === 'scripted';
  if (forceScript || !openRouterConfig.configured) {
    logger.warn(
      { reason: forceScript ? 'SHADOW_PLANNER=scripted' : 'OPENROUTER_API_KEY unset' },
      'shadow: using observeScriptPlanner — live LLM is not in this process',
    );
    return observeScriptPlanner();
  }
  return openRouterPlanner();
}

export interface ShadowObserveInput {
  companyId: string;
  agentId: string;
  goal: string;
  guardrails?: { max_budget?: number; frequency_cap?: number; channels?: string[] };
}

/**
 * Fail-soft shadow run beside the existing orchestrator tick.
 * Persistence is best-effort: the migration may not be applied yet.
 * A throw here must never fail the real enqueue path.
 *
 * `planner` / `handlers` are injectable so tests can run the persist path
 * offline (Zeno's mock provider). Production omits them.
 */
export async function runShadowObserve(
  input: ShadowObserveInput,
  deps?: {
    planner?: Planner;
    handlers?: Record<string, ToolHandler>;
    checkpointer?: import('@langchain/langgraph-checkpoint').BaseCheckpointSaver;
  },
): Promise<{ runId: string; status: string; summary: string; stepCount: number }> {
  const runId = randomUUID();
  let persistedRunId: string | null = null;

  try {
    const created = await prisma.agentRun.create({
      data: {
        companyId: input.companyId,
        agentId: input.agentId,
        threadId: runId,
        goal: input.goal,
        status: 'running',
        mode: 'shadow',
      },
    });
    persistedRunId = created.id;
  } catch (err) {
    logger.warn(
      { err, runId },
      'shadow: agent_runs table missing or unwritable — running without persist. Apply 20260913033000_agent_runs_and_steps when ready.',
    );
  }

  // A supervised run's steps come from four separate sub-runs (one per
  // role) — prefixing `node` with the role keeps every step in one
  // `agent_steps` timeline under the single top-level `runId`, so the Run
  // Trace UI needs no schema change to render either path.
  const onStep = async (step: TraceStep, ctx?: RunContext) => {
    const node = ctx?.role ? `${ctx.role}.${step.node}` : step.node;
    if (persistedRunId) {
      try {
        await prisma.agentStep.create({
          data: {
            runId: persistedRunId,
            companyId: input.companyId,
            node,
            toolName: step.tool,
            args: jsonOrUndefined(step.args),
            result: jsonOrUndefined(step.result),
            error: step.error,
            latencyMs: step.latencyMs,
          },
        });
      } catch (err) {
        logger.warn({ err, runId }, 'shadow: failed to persist a step');
      }
    }
    emitActivity({
      id: `${runId}:${node}:${step.tool ?? 'step'}`,
      companyId: input.companyId,
      agentId: input.agentId,
      actionType: 'agent_step',
      description: step.tool ?? node,
      details: { runId, error: step.error, latencyMs: step.latencyMs, node },
      createdAt: new Date(),
    });
  };

  const planner = resolvePlanner(deps?.planner);
  const handlers = deps?.handlers ?? buildToolHandlers();
  const checkpointer = deps?.checkpointer ?? (await getAgentCheckpointer());

  const useSupervisor = process.env.SHADOW_SUPERVISOR === '1';
  const out = useSupervisor
    ? await runSupervisedAgent({
        companyId: input.companyId,
        agentId: input.agentId,
        goal: input.goal,
        runId,
        guardrails: input.guardrails,
        planner,
        handlers,
        checkpointer,
        maxStepsPerRole: await getConfig(input.companyId, 'agent.max_steps_per_role'),
        onStep,
      }).then((r) => ({ ...r, stepCount: r.roles.reduce((sum, role) => sum + role.stepCount, 0) }))
    : await runGrowthAgent(
        buildGrowthAgent({
          planner,
          handlers,
          mode: 'shadow',
          maxSteps: await getConfig(input.companyId, 'agent.max_steps_single'),
          onStep,
          checkpointer,
        }),
        { companyId: input.companyId, agentId: input.agentId, goal: input.goal, runId, guardrails: input.guardrails },
      );

  if (persistedRunId) {
    try {
      await prisma.agentRun.update({
        where: { id: persistedRunId },
        data: {
          status: out.status,
          summary: out.summary,
          stepCount: out.stepCount,
          finishedAt: new Date(),
        },
      });
    } catch (err) {
      logger.warn({ err, runId }, 'shadow: failed to finalize agent_run');
    }
  }

  logger.info(
    { runId, status: out.status, steps: out.stepCount, summary: out.summary.slice(0, 160) },
    'shadow run complete',
  );

  return {
    runId,
    status: out.status,
    summary: out.summary,
    stepCount: out.stepCount,
  };
}

function jsonOrUndefined(value: unknown): object | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'object') return value as object;
  return { value };
}
