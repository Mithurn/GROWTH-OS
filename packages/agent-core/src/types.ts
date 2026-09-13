import type { z } from 'zod';

export type ToolKind = 'read' | 'mutating' | 'external' | 'control';
export type PermissionMode = 'shadow' | 'live';
export type RunStatus = 'running' | 'finished' | 'stopped';

export interface RunContext {
  companyId: string;
  runId: string;
  agentId?: string;
  goal: string;
  guardrails?: { max_budget?: number; frequency_cap?: number; channels?: string[] };
  mode: PermissionMode;
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
}
