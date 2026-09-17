import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { StateGraph, START, END, Annotation, interrupt, Command } from '@langchain/langgraph';
import { createPostgresCheckpointer } from '@growthos/agent-core';

/**
 * Proves the actual thing "durable agent" claims: a graph that genuinely
 * suspends on `interrupt()` can be resumed — with the right answer, not just
 * "something happens" — from a *different* checkpointer instance pointed at
 * the same database. That's the honest stand-in for "survives a Render
 * restart": the process that resumes is not the process that started.
 *
 * Deliberately not the real GrowthOS agent graph — nothing in the shadow
 * flow calls `interrupt()` yet (see docs/PROGRESS.md), so there is nothing
 * in the real graph to suspend. This proves the checkpointer mechanism
 * itself, ahead of Phase 4 wiring it into a graph that actually pauses.
 */

const State = Annotation.Root({
  amount: Annotation<number>,
  approved: Annotation<boolean>({ reducer: (_p, n) => n, default: () => false }),
});

function buildApprovalGraph(checkpointer: Awaited<ReturnType<typeof createPostgresCheckpointer>>) {
  const requestApproval = (state: typeof State.State) => {
    const approved = interrupt({ question: `Approve spend of ${state.amount}?` });
    return { approved: Boolean(approved) };
  };

  return new StateGraph(State)
    .addNode('requestApproval', requestApproval)
    .addEdge(START, 'requestApproval')
    .addEdge('requestApproval', END)
    .compile({ checkpointer });
}

let container: StartedPostgreSqlContainer;

describe('agent checkpoint durability (real interrupt + real resume)', () => {
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

  it('suspends on interrupt, then resumes correctly from a brand-new checkpointer instance', async () => {
    const connectionUri = container.getConnectionUri();
    const threadId = 'approval-thread-1';
    const config = { configurable: { thread_id: threadId } };

    // "Process A" starts the run.
    const checkpointerA = await createPostgresCheckpointer(connectionUri);
    try {
      const graphA = buildApprovalGraph(checkpointerA);
      const firstResult = (await graphA.invoke({ amount: 5000 }, config)) as typeof State.State & {
        __interrupt__?: unknown[];
      };

      // LangGraph's own way to say "stopped, waiting on a human" — the graph
      // never reached `approved: true` because interrupt() paused it.
      expect(firstResult.__interrupt__).toBeDefined();
      expect(firstResult.approved).toBe(false);
    } finally {
      await checkpointerA.end();
    }

    // "Process B" — an entirely new checkpointer and graph object, exactly
    // what a fresh Render instance would construct after a restart, pointed
    // at the same Postgres. No in-memory state is shared with Process A.
    const checkpointerB = await createPostgresCheckpointer(connectionUri);
    try {
      const graphB = buildApprovalGraph(checkpointerB);
      const resumed = await graphB.invoke(new Command({ resume: true }), config);

      expect(resumed.approved).toBe(true);
      expect(resumed.amount).toBe(5000);
    } finally {
      await checkpointerB.end();
    }
  }, 30_000);

  it('a thread with no prior checkpoint has no state to resume', async () => {
    const checkpointer = await createPostgresCheckpointer(container.getConnectionUri());
    try {
      const state = await checkpointer.getTuple({ configurable: { thread_id: 'never-started' } });
      expect(state).toBeUndefined();
    } finally {
      await checkpointer.end();
    }
  });
});
