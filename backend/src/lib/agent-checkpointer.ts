import { createPostgresCheckpointer } from '@growthos/agent-core';
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import { MemorySaver } from '@langchain/langgraph';
import { logger } from './logger';

let cached: Promise<BaseCheckpointSaver> | null = null;

/**
 * Shared LangGraph checkpointer for the whole process. `setup()` runs its own
 * internal migrations against DATABASE_URL and must only run once per boot,
 * not once per agent tick — hence the module-level cache.
 *
 * Fail-soft, unlike Redis: nothing suspends a graph mid-run yet (shadow mode
 * has no real `interrupt()` in use), so a MemorySaver fallback loses nothing
 * observable today. Once Phase 4 arms real interrupts, a failure here should
 * become a hard boot failure the same way Redis is — not yet.
 */
export async function getAgentCheckpointer(): Promise<BaseCheckpointSaver> {
  if (!cached) {
    cached = (async () => {
      const url = process.env.DATABASE_URL;
      if (!url) {
        logger.warn('DATABASE_URL unset — agent checkpoints use in-memory MemorySaver, lost on restart');
        return new MemorySaver();
      }
      try {
        const saver = await createPostgresCheckpointer(url);
        logger.info('Agent checkpoints: PostgresSaver ready');
        return saver;
      } catch (err) {
        logger.warn({ err }, 'PostgresSaver setup failed — falling back to in-memory MemorySaver');
        return new MemorySaver();
      }
    })();
  }
  return cached;
}

/** Test-only: force a fresh checkpointer on the next call. */
export function resetAgentCheckpointerForTests(): void {
  cached = null;
}
