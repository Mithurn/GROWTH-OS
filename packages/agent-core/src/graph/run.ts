import { END, MemorySaver, START, StateGraph, Annotation } from '@langchain/langgraph';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import type { HarnessOptions, Plan, RunContext, TraceStep, ToolSpec } from '../types';
import { catalogFor, invokeTool } from '../tools/registry';

const tracer = trace.getTracer('growthos-agent');

async function withNodeSpan<T>(
  name: string,
  attrs: Record<string, string | number>,
  fn: () => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    for (const [k, v] of Object.entries(attrs)) span.setAttribute(k, v);
    try {
      return await fn();
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      throw err;
    } finally {
      span.end();
    }
  });
}

const AgentState = Annotation.Root({
  companyId: Annotation<string>,
  goal: Annotation<string>,
  runId: Annotation<string>,
  agentId: Annotation<string>,
  // JSON string so the reducer stays a replace, not a merge of objects.
  guardrailsJson: Annotation<string>,
  startedAtMs: Annotation<number>,
  steps: Annotation<TraceStep[]>({
    reducer: (prev: TraceStep[], next: TraceStep[]) => prev.concat(next),
    default: () => [],
  }),
  pending: Annotation<Plan>({
    reducer: (_prev: Plan, next: Plan) => next,
    default: () => ({ type: 'idle' }) as Plan,
  }),
  stepCount: Annotation<number>({
    reducer: (_prev: number, next: number) => next,
    default: () => 0,
  }),
  idleStreak: Annotation<number>({
    reducer: (_prev: number, next: number) => next,
    default: () => 0,
  }),
  status: Annotation<string>({
    reducer: (_prev: string, next: string) => next,
    default: () => 'running',
  }),
  summary: Annotation<string>({
    reducer: (_prev: string, next: string) => next,
    default: () => '',
  }),
});

export type HarnessState = typeof AgentState.State;

const DEFAULT_MAX_STEPS = 8;
const DEFAULT_MAX_WALL_MS = 45_000;

function wallClockExceeded(state: HarnessState, maxWallMs: number): boolean {
  return Date.now() - state.startedAtMs > maxWallMs;
}

export function buildGrowthAgent(options: HarnessOptions) {
  const mode = options.mode ?? 'shadow';
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  const maxWallMs = options.maxWallMs ?? DEFAULT_MAX_WALL_MS;
  const tools = catalogFor(mode, options.role);

  const stopForWall = async (state: HarnessState): Promise<Partial<HarnessState>> => {
    const step: TraceStep = {
      node: 'planner',
      error: `wall-clock slice (${maxWallMs}ms) exceeded`,
      latencyMs: 0,
    };
    await options.onStep?.(step, ctxOf(state, mode, options.role));
    return {
      status: 'stopped',
      summary: state.summary || 'Stopped: wall-clock slice exceeded.',
      steps: [step],
    };
  };

  const plannerNode = async (state: HarnessState) => {
    if (wallClockExceeded(state, maxWallMs)) return stopForWall(state);
    const started = Date.now();
    const plan = await options.planner.plan({
      goal: state.goal,
      steps: state.steps,
      tools: tools.map((t: ToolSpec) => ({ name: t.name, description: t.description })),
      companyId: state.companyId,
      runId: state.runId,
    });
    if (wallClockExceeded(state, maxWallMs)) return stopForWall(state);
    const latencyMs = Date.now() - started;

    if (plan.type === 'finish') {
      const step: TraceStep = { node: 'planner', tool: 'growthos_finish', args: { summary: plan.summary }, latencyMs };
      await options.onStep?.(step, ctxOf(state, mode, options.role));
      return {
        pending: plan,
        status: 'finished',
        summary: plan.summary,
        steps: [step],
        idleStreak: 0,
      };
    }

    if (plan.type === 'idle' || (plan.type === 'calls' && plan.calls.length === 0)) {
      const idleStreak = state.idleStreak + 1;
      const stopped = idleStreak >= 2;
      const step: TraceStep = {
        node: 'planner',
        error: stopped ? 'planner returned no tool calls twice — stopping rather than spinning' : 'planner returned no tool calls',
        latencyMs,
      };
      await options.onStep?.(step, ctxOf(state, mode, options.role));
      return {
        pending: { type: 'idle' } as Plan,
        idleStreak,
        status: stopped ? 'stopped' : state.status,
        summary: stopped ? state.summary || 'Stopped: planner produced no actions.' : state.summary,
        steps: [step],
      };
    }

    const step: TraceStep = { node: 'planner', args: plan, latencyMs };
    await options.onStep?.(step, ctxOf(state, mode, options.role));
    return { pending: plan, steps: [step], idleStreak: 0 };
  };

  const toolsNode = async (state: HarnessState) => {
    if (wallClockExceeded(state, maxWallMs)) return stopForWall(state);
    const plan = state.pending;
    if (plan.type !== 'calls') return {};

    const ctx = ctxOf(state, mode, options.role);
    const newSteps: TraceStep[] = [];
    let stepCount = state.stepCount;
    let summary = state.summary;
    let status = state.status;

    for (const call of plan.calls) {
      if (stepCount >= maxSteps) {
        status = 'stopped';
        summary = summary || `Stopped: step budget (${maxSteps}) exhausted.`;
        newSteps.push({
          node: 'tools',
          error: `step budget ${maxSteps} exhausted`,
          latencyMs: 0,
        });
        break;
      }

      if (options.preToolUse) {
        const gate = await options.preToolUse(call, ctx);
        if (!gate.allow) {
          const step: TraceStep = {
            node: 'tools',
            tool: call.name,
            args: call.args,
            error: gate.reason,
            latencyMs: 0,
          };
          newSteps.push(step);
          await options.onStep?.(step, ctx);
          continue;
        }
      }

      const started = Date.now();
      const outcome = await invokeTool(call, ctx, options.handlers);
      const latencyMs = Date.now() - started;
      stepCount += 1;

      if (call.name === 'growthos_finish' && outcome.ok) {
        const finished = (call.args as { summary?: string })?.summary ?? '';
        status = 'finished';
        summary = finished;
      }
      if (outcome.ok && isInterrupt(outcome.result)) {
        status = 'stopped';
        const note = (outcome.result as { note?: string }).note;
        summary = note || 'Waiting for human approval.';
      }
      if (call.name === 'growthos_think' && outcome.ok) {
        // think does not count against the interesting-work budget the same
        // way — still increments stepCount so a think-loop cannot run forever.
      }

      const step: TraceStep = {
        node: 'tools',
        tool: call.name,
        args: call.args,
        result: outcome.ok ? outcome.result : undefined,
        error: outcome.ok ? undefined : outcome.error,
        latencyMs,
      };
      newSteps.push(step);
      await options.onStep?.(step, ctx);
    }

    return {
      steps: newSteps,
      stepCount,
      status,
      summary,
      pending: { type: 'idle' } as Plan,
    };
  };

  const route = (state: HarnessState): 'tools' | 'planner' | typeof END => {
    if (state.status === 'finished' || state.status === 'stopped') return END;
    if (state.stepCount >= maxSteps) return END;
    if (state.pending.type === 'calls') return 'tools';
    if (state.pending.type === 'finish') return END;
    // One idle is a confused turn; two idles is a stop (set in the planner node).
    if (state.pending.type === 'idle' && state.status === 'running') return 'planner';
    return END;
  };

  const afterTools = (state: HarnessState): 'planner' | typeof END => {
    if (state.status === 'finished' || state.status === 'stopped') return END;
    if (state.stepCount >= maxSteps) return END;
    return 'planner';
  };

  return new StateGraph(AgentState)
    .addNode('planner', (state) =>
      withNodeSpan(
        'langgraph.planner',
        { 'langgraph.run_id': state.runId, 'langgraph.company_id': state.companyId },
        () => plannerNode(state),
      ),
    )
    .addNode('tools', (state) =>
      withNodeSpan(
        'langgraph.tools',
        {
          'langgraph.run_id': state.runId,
          'langgraph.company_id': state.companyId,
          'langgraph.tools':
            state.pending.type === 'calls' ? state.pending.calls.map((c) => c.name).join(',') : '',
        },
        () => toolsNode(state),
      ),
    )
    .addEdge(START, 'planner')
    .addConditionalEdges('planner', route, { tools: 'tools', planner: 'planner', [END]: END })
    .addConditionalEdges('tools', afterTools, { planner: 'planner', [END]: END })
    .compile({ checkpointer: options.checkpointer ?? new MemorySaver() });
}

function isInterrupt(result: unknown): boolean {
  return Boolean(result && typeof result === 'object' && (result as { interrupt?: boolean }).interrupt);
}

function ctxOf(state: HarnessState, mode: HarnessOptions['mode'], role: HarnessOptions['role']): RunContext {
  let guardrails: RunContext['guardrails'];
  if (state.guardrailsJson) {
    try {
      guardrails = JSON.parse(state.guardrailsJson) as RunContext['guardrails'];
    } catch {
      guardrails = undefined;
    }
  }
  return {
    companyId: state.companyId,
    runId: state.runId,
    agentId: state.agentId || undefined,
    goal: state.goal,
    guardrails,
    mode: mode ?? 'shadow',
    role,
  };
}

export async function runGrowthAgent(
  graph: ReturnType<typeof buildGrowthAgent>,
  input: {
    companyId: string;
    goal: string;
    runId: string;
    agentId?: string;
    guardrails?: RunContext['guardrails'];
  },
) {
  return withNodeSpan(
    'langgraph.run',
    { 'langgraph.run_id': input.runId, 'langgraph.company_id': input.companyId },
    () =>
      graph.invoke(
        {
          companyId: input.companyId,
          goal: input.goal,
          runId: input.runId,
          agentId: input.agentId ?? '',
          guardrailsJson: JSON.stringify(input.guardrails ?? {}),
          startedAtMs: Date.now(),
        },
        { configurable: { thread_id: input.runId }, recursionLimit: 32 },
      ),
  );
}
