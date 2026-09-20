import type { z } from 'zod';

export type ToolKind = 'read' | 'mutating' | 'external' | 'control';
export type PermissionMode = 'shadow' | 'live';
export type RunStatus = 'running' | 'finished' | 'stopped';

export type SupervisorRole = 'strategy' | 'risk_reviewer';

export interface RunContext {
  companyId: string;
  runId: string;
  agentId?: string;
  goal: string;
  guardrails?: { max_budget?: number; frequency_cap?: number; channels?: string[] };
  mode: PermissionMode;
  /**
   * Set only inside a supervisor-orchestrated run. When present, `invokeTool`
   * enforces it as a second, narrower deny boundary on top of `mode` — a
   * role cannot call a tool outside its own scope even if it hallucinates
   * the name, the same deny-first guarantee `mode` already gives shadow vs
   * live. Absent for the original single-planner graph, which is unchanged.
   */
  role?: SupervisorRole;
}

export interface ToolSpec<TArgs = unknown> {
  name: string;
  kind: ToolKind;
  description: string;
  inputSchema: z.ZodType<TArgs>;
}

export interface ToolCall {
  name: string;
  args: unknown;
}

export interface TraceStep {
  node: 'planner' | 'tools' | 'route';
  tool?: string;
  args?: unknown;
  result?: unknown;
  error?: string;
  latencyMs: number;
}

export type Plan =
  | { type: 'calls'; calls: ToolCall[] }
  | { type: 'finish'; summary: string }
  | { type: 'idle' };

export interface Planner {
  plan(input: {
    goal: string;
    steps: TraceStep[];
    tools: Array<{ name: string; description: string }>;
    companyId?: string;
    runId?: string;
    mode?: PermissionMode;
    role?: SupervisorRole;
  }): Promise<Plan>;
}

export type ToolHandler = (args: unknown, ctx: RunContext) => Promise<unknown>;

export type PreToolUse = (
  call: ToolCall,
  ctx: RunContext,
) => Promise<{ allow: true } | { allow: false; reason: string }>;

export interface HarnessOptions {
  planner: Planner;
  handlers: Record<string, ToolHandler>;
  mode?: PermissionMode;
  maxSteps?: number;
  /** DESIGN.md §5 stop condition 3. Default 45s so a stuck planner cannot hold a cron tick. */
  maxWallMs?: number;
  preToolUse?: PreToolUse;
  onStep?: (step: TraceStep, ctx: RunContext) => void | Promise<void>;
  /**
   * Defaults to an in-process `MemorySaver`, lost on restart. Pass a
   * `PostgresSaver` (see `createPostgresCheckpointer`) for a run that must
   * survive a process restart — required once a node actually calls
   * LangGraph's `interrupt()` and waits on a human.
   */
  checkpointer?: import('@langchain/langgraph-checkpoint').BaseCheckpointSaver;
  /** Set only by the supervisor. Narrows both the offered and the enforced tool set — see RunContext.role. */
  role?: SupervisorRole;
}
