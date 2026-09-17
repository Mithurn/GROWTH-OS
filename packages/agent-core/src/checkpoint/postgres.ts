import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

/**
 * LangGraph's own checkpoint tables, owned by the LangGraph library, not
 * Prisma — `setup()` creates and migrates them itself. Deliberately separate
 * from `agent_runs`/`agent_steps`: those answer "what happened" for the Run
 * Trace UI; this answers "how to resume exactly where a suspended run left
 * off," which only LangGraph's own serialization format can do correctly.
 *
 * Call `setup()` once at process boot, not per-request — it runs its own
 * internal migrations and is not safe to race across concurrent callers.
 */
export async function createPostgresCheckpointer(connectionString: string): Promise<PostgresSaver> {
  const saver = PostgresSaver.fromConnString(connectionString);
  await saver.setup();
  return saver;
}
