import { describe, it, expect } from 'vitest';
import { mcpToolsCall, mcpToolsList } from './adapter';
import type { RunContext, ToolHandler } from '../types';

const ctx: RunContext = {
  companyId: 'co_real',
  runId: 'run_1',
  goal: 'g',
  mode: 'shadow',
};

describe('mcp adapter', () => {
  it('lists the same shadow catalog the graph binds — no second schema', () => {
    const listed = mcpToolsList('shadow').map((t: { name: string }) => t.name);
    expect(listed).toContain('growthos_query_metrics');
    expect(listed).toContain('growthos_finish');
    expect(listed).not.toContain('growthos_create_opportunity');
  });

  it('calls through invokeTool so a smuggled companyId is stripped', async () => {
    const handlers: Record<string, ToolHandler> = {
      growthos_query_metrics: async (_args, run) => ({ companyIdEcho: run.companyId }),
    };
    const out = await mcpToolsCall(
      'growthos_query_metrics',
      { companyId: 'co_attacker', response_format: 'concise' },
      ctx,
      handlers,
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.result).toEqual({ companyIdEcho: 'co_real' });
  });
});
