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
      { caseId: 'case-1', maxRevisions: 1 },
      { configurable: { thread_id: 'case-1' } },
    );

    expect(result.status).toBe('BLOCKED');
    expect(result.revisionCount).toBe(1);
    expect(reviews).toBe(2);
    expect(revisions).toBe(1);
  });
});
