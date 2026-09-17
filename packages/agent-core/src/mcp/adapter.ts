import { catalogFor, invokeTool } from '../tools/registry';
import type { PermissionMode, RunContext, ToolHandler, ToolSpec } from '../types';

/**
 * One registry, two surfaces (ARCHITECTURE_V2 §3.4). MCP list/call is the
 * same Zod catalog the graph binds. Transport (Streamable HTTP) can wrap
 * these two functions later without a second schema.
 */
export function mcpToolsList(mode: PermissionMode = 'shadow') {
  return catalogFor(mode).map((t: ToolSpec) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: {
      readOnlyHint: t.kind === 'read' || t.kind === 'control',
      destructiveHint: t.kind === 'mutating' || t.kind === 'external',
    },
  }));
}

export async function mcpToolsCall(
  name: string,
  args: unknown,
  ctx: RunContext,
  handlers: Record<string, ToolHandler>,
) {
  return invokeTool({ name, args }, ctx, handlers);
}
