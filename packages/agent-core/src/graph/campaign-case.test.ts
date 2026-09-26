import { describe, expect, it } from 'vitest';
import { MemorySaver } from '@langchain/langgraph';
import { buildCampaignCaseGraph } from './campaign-case';

describe('campaign case graph', () => {
  it('revises once, then fails closed when objections remain', async () => {
    let reviews = 0;
    let revisions = 0;
    const graph = buildCampaignCaseGraph({
      scout: async () => ({ source: 'tenant-history' }),
      strategist: async () => ({ draft: 'draft-v1' }),
      reviewer: async () => {
        reviews += 1;
        return { blocked: false, needsRevision: true, report: { unsupported_claims: [`claim-${reviews}`] } };
      },
      revise: async () => {
        revisions += 1;
        return { draft: 'draft-v2' };
      },
    }, new MemorySaver());

    const result = await graph.invoke(
      { caseId: 'case-1', maxRevisions: 1, deadlineAt: Date.now() + 60_000 },
      { configurable: { thread_id: 'case-1' } },
    );

    expect(result.status).toBe('BLOCKED');
    expect(result.revisionCount).toBe(1);
    expect(reviews).toBe(2);
    expect(revisions).toBe(1);
  });

  it('fails closed when the wall-clock budget is already exhausted, even under the revision-count budget', async () => {
    let revisions = 0;
    const graph = buildCampaignCaseGraph({
      scout: async () => ({ source: 'tenant-history' }),
      strategist: async () => ({ draft: 'draft-v1' }),
      reviewer: async () => ({ blocked: false, needsRevision: true, report: { unsupported_claims: ['claim-1'] } }),
      revise: async () => {
        revisions += 1;
        return { draft: 'draft-v2' };
      },
    }, new MemorySaver());

    const result = await graph.invoke(
      { caseId: 'case-2', maxRevisions: 2, deadlineAt: Date.now() - 1 },
      { configurable: { thread_id: 'case-2' } },
    );

    expect(result.status).toBe('BLOCKED');
    expect(revisions).toBe(0);
  });
});
