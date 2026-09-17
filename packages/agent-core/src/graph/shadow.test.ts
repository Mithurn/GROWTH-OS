import { describe, it, expect } from 'vitest';
import { buildShadowGraph } from './shadow';

describe('buildShadowGraph', () => {
  it('observes without inventing a tenant or a goal', async () => {
    const graph = buildShadowGraph();
    const out = await graph.invoke(
      { companyId: 'co_1', goal: 'win back churned buyers' },
      { configurable: { thread_id: 'run_1' } },
    );

    expect(out.companyId).toBe('co_1');
    expect(out.goal).toBe('win back churned buyers');
    expect(out.summary).toBe('shadow observed company co_1: win back churned buyers');
  });

  it('does not leak state across thread_ids — two tenants, one process', async () => {
    const graph = buildShadowGraph();

    await graph.invoke(
      { companyId: 'co_a', goal: 'goal A' },
      { configurable: { thread_id: 'run_a' } },
    );
    await graph.invoke(
      { companyId: 'co_b', goal: 'goal B' },
      { configurable: { thread_id: 'run_b' } },
    );

    const a = await graph.getState({ configurable: { thread_id: 'run_a' } });
    const b = await graph.getState({ configurable: { thread_id: 'run_b' } });

    expect(a.values.companyId).toBe('co_a');
    expect(a.values.summary).toContain('co_a');
    expect(a.values.summary).not.toContain('co_b');
    expect(b.values.companyId).toBe('co_b');
    expect(b.values.summary).toContain('co_b');
    expect(b.values.summary).not.toContain('co_a');
  });

  it('resumes the same thread from the checkpointer', async () => {
    const graph = buildShadowGraph();
    const config = { configurable: { thread_id: 'run_resume' } };

    await graph.invoke({ companyId: 'co_1', goal: 'first' }, config);
    const afterFirst = await graph.getState(config);
    expect(afterFirst.values.summary).toContain('first');

    await graph.invoke({ companyId: 'co_1', goal: 'second' }, config);
    const afterSecond = await graph.getState(config);
    expect(afterSecond.values.goal).toBe('second');
    expect(afterSecond.values.summary).toContain('second');
  });
});
