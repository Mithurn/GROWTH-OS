import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Command } from '@langchain/langgraph';
import {
  buildCampaignApprovalGraph,
  campaignApprovalThreadId,
  createPostgresCheckpointer,
} from '@growthos/agent-core';

let container: StartedPostgreSqlContainer;

describe('campaign approval checkpoint durability', () => {
  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('checkpoint_test')
      .withUsername('test')
      .withPassword('test')
      .start();
  }, 60_000);

  afterAll(async () => {
    await container?.stop();
  });

  it('resumes the product approval graph from a new process', async () => {
    const connectionUri = container.getConnectionUri();
    const campaignId = 'campaign_1';
    const config = {
      configurable: { thread_id: campaignApprovalThreadId(campaignId) },
    };

    const checkpointerA = await createPostgresCheckpointer(connectionUri);
    try {
      const graphA = buildCampaignApprovalGraph(checkpointerA);
      const firstResult = (await graphA.invoke({
        companyId: 'company_1',
        campaignId,
      }, config)) as { decision: string; __interrupt__?: unknown[] };

      expect(firstResult.__interrupt__).toHaveLength(1);
      expect(firstResult.decision).toBe('pending');
    } finally {
      await checkpointerA.end();
    }

    const checkpointerB = await createPostgresCheckpointer(connectionUri);
    try {
      const graphB = buildCampaignApprovalGraph(checkpointerB);
      const resumed = await graphB.invoke(new Command({
        resume: { decision: 'approved', actorId: 'user_1', reason: 'Reviewed' },
      }), config);

      expect(resumed).toMatchObject({
        companyId: 'company_1',
        campaignId,
        decision: 'approved',
        actorId: 'user_1',
        reason: 'Reviewed',
      });
    } finally {
      await checkpointerB.end();
    }
  }, 30_000);

  it('a thread with no prior checkpoint has no state to resume', async () => {
    const checkpointer = await createPostgresCheckpointer(container.getConnectionUri());
    try {
      const state = await checkpointer.getTuple({
        configurable: { thread_id: 'never-started' },
      });
      expect(state).toBeUndefined();
    } finally {
      await checkpointer.end();
    }
  });
});
