import { SpanStatusCode, trace } from '@opentelemetry/api';
import { buildGrowthAgent, runGrowthAgent } from '../graph/run';
import { ROLE_SEQUENCE } from './roles';
import type { HarnessOptions, Planner, RunContext, SupervisorRole, ToolHandler, TraceStep } from '../types';

const tracer = trace.getTracer('growthos-agent');

export interface RoleResult {
  role: SupervisorRole;
  status: string;
  summary: string;
  stepCount: number;
}

export interface SupervisorOptions {
  companyId: string;
  agentId?: string;
  goal: string;
  runId: string;
  guardrails?: RunContext['guardrails'];
  planner: Planner;
  handlers: Record<string, ToolHandler>;
  checkpointer?: HarnessOptions['checkpointer'];
  maxStepsPerRole?: number;
  onStep?: (step: TraceStep, ctx: RunContext) => void | Promise<void>;
  onRoleTransition?: (from: SupervisorRole | null, to: SupervisorRole | null, reason: string) => void | Promise<void>;
}

/**
 * The routing decision itself is deterministic code, not another LLM call —
 * "the most expensive mistake in production supervisor loops is a routing
 * loop with no circuit breaker" (LangGraph 2026 production guidance). A
 * fixed pipeline with a skip rule is a real circuit breaker: it cannot loop,
 * because there is no loop edge to take. Each *specialist* underneath is
 * still a full, independently reasoning LLM-driven agent — the "multi" in
 * multi-agent is the specialization and handoff, not the routing mechanism.
 * An LLM-driven router is the natural upgrade once eval coverage shows this
 * fixed sequence actually falls short, not before.
 */
function nextRole(current: SupervisorRole | null, discoveryFoundNothing: boolean): SupervisorRole | null {
  if (current === null) return ROLE_SEQUENCE[0];
  const idx = ROLE_SEQUENCE.indexOf(current);
  if (current === 'discovery' && discoveryFoundNothing) return null;
  return ROLE_SEQUENCE[idx + 1] ?? null;
}

/** A discovery run found nothing worth acting on — every real read tool came back empty or errored. */
function discoveryFoundNothing(steps: TraceStep[]): boolean {
  const reads = steps.filter((s) => s.tool && s.tool !== 'growthos_think' && s.tool !== 'growthos_finish');
  if (reads.length === 0) return true;
  return reads.every((s) => {
    if (s.error) return true;
    const result = s.result as { audience_size?: number; count?: number; data?: unknown[] } | undefined;
    if (typeof result?.audience_size === 'number') return result.audience_size === 0;
    if (typeof result?.count === 'number') return result.count === 0;
    if (Array.isArray(result?.data)) return result.data.length === 0;
    return false;
  });
}

/**
 * Runs Discovery → Strategy → Guardrail as a real supervised sequence: each
 * role is a complete, independently checkpointed LangGraph run
 * (`${runId}:${role}` thread id), scoped to its own tool subset and denied
 * anything outside it (see registry.ts's role enforcement). The next role's
 * goal is built from the previous role's summary, so Strategy actually reads
 * what Discovery found rather than starting blind.
 */
export async function runSupervisedAgent(options: SupervisorOptions): Promise<{
  status: 'finished' | 'stopped';
  summary: string;
  roles: RoleResult[];
}> {
  return tracer.startActiveSpan('supervisor.run', async (span) => {
    span.setAttribute('supervisor.run_id', options.runId);
    span.setAttribute('supervisor.company_id', options.companyId);

    const roles: RoleResult[] = [];
    let role: SupervisorRole | null = ROLE_SEQUENCE[0];
    let priorSummary = '';
    let foundNothing = false;

    try {
      while (role) {
        await options.onRoleTransition?.(roles.length ? roles[roles.length - 1].role : null, role, priorSummary || 'starting');

        const roleGoal = priorSummary
          ? `${options.goal}\n\nHandoff from the previous specialist: ${priorSummary}`
          : options.goal;

        const graph = buildGrowthAgent({
          planner: options.planner,
          handlers: options.handlers,
          mode: 'shadow',
          role,
          maxSteps: options.maxStepsPerRole ?? 6,
          checkpointer: options.checkpointer,
          onStep: options.onStep,
        });

        const out = await runGrowthAgent(graph, {
          companyId: options.companyId,
          agentId: options.agentId,
          goal: roleGoal,
          runId: `${options.runId}:${role}`,
          guardrails: options.guardrails,
        });

        roles.push({ role, status: out.status, summary: out.summary, stepCount: out.stepCount });
        priorSummary = out.summary;
        if (role === 'discovery') foundNothing = discoveryFoundNothing(out.steps);

        role = nextRole(role, foundNothing);
      }

      await options.onRoleTransition?.(roles.length ? roles[roles.length - 1].role : null, null, 'sequence complete');

      const summary = roles.length
        ? roles.map((r) => `${r.role}: ${r.summary}`).join(' → ')
        : 'No specialist produced a result.';

      return { status: 'finished' as const, summary, roles };
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      throw err;
    } finally {
      span.end();
    }
  });
}
