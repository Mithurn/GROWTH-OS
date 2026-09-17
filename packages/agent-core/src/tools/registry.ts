import { SHADOW_KINDS, TOOL_CATALOG } from './catalog';
import { ROLE_TOOLS } from '../supervisor/roles';
import type { PermissionMode, RunContext, SupervisorRole, ToolCall, ToolHandler, ToolSpec } from '../types';

export class ToolDeniedError extends Error {
  readonly code = 'tool_denied';
  constructor(
    public readonly tool: string,
    message: string,
  ) {
    super(message);
    this.name = 'ToolDeniedError';
  }
}

export function catalogFor(mode: PermissionMode, role?: SupervisorRole): ToolSpec[] {
  const byMode = mode === 'shadow' ? TOOL_CATALOG.filter((t) => SHADOW_KINDS.includes(t.kind)) : TOOL_CATALOG;
  if (!role) return byMode;
  const allowed = new Set(ROLE_TOOLS[role]);
  return byMode.filter((t) => allowed.has(t.name));
}

/**
 * Factor 8 / Claude permission pipeline, deny-first:
 * 1. unknown name → deny
 * 2. kind not in this mode → deny
 * 3. strip companyId if the model smuggled it
 * 4. Zod-parse; compact error on failure
 * 5. inject companyId from RunContext
 * 6. handler
 */
export async function invokeTool(
  call: ToolCall,
  ctx: RunContext,
  handlers: Record<string, ToolHandler>,
): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  const spec = catalogFor(ctx.mode, ctx.role).find((t) => t.name === call.name);
  if (!spec) {
    const known = catalogFor(ctx.mode, ctx.role)
      .map((t) => t.name)
      .join(', ');
    const scope = ctx.role ? `In ${ctx.mode} mode, as the ${ctx.role} specialist,` : `In ${ctx.mode} mode`;
    return {
      ok: false,
      error: `Unknown or unbound tool "${call.name}". ${scope} you may call: ${known}. Mutating tools are not bound.`,
    };
  }

  const raw =
    call.args && typeof call.args === 'object' && !Array.isArray(call.args)
      ? { ...(call.args as Record<string, unknown>) }
      : {};
  if ('companyId' in raw || 'company_id' in raw) {
    delete raw.companyId;
    delete raw.company_id;
  }

  const parsed = spec.inputSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join('.') || 'args';
    return {
      ok: false,
      error: `Invalid ${spec.name}.${path}: ${issue?.message ?? 'failed validation'}. Fix the arguments and retry; do not invent ids.`,
    };
  }

  const handler = handlers[spec.name];
  if (!handler) {
    return {
      ok: false,
      error: `${spec.name} is bound but has no handler in this process. This is a server bug, not something you can fix by retrying with different args.`,
    };
  }

  try {
    const result = await handler(parsed.data, ctx);
    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: `${spec.name} failed: ${message}. If this mentions a missing row, copy the id from a prior tool result.`,
    };
  }
}

export function stripCompanyIdFromArgs(args: unknown): unknown {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return args;
  const copy = { ...(args as Record<string, unknown>) };
  delete copy.companyId;
  delete copy.company_id;
  return copy;
}
