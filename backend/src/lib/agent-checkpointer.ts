import { createPostgresCheckpointer } from '@growthos/agent-core';
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import { MemorySaver } from '@langchain/langgraph';
import { logger } from './logger';

let cached: Promise<BaseCheckpointSaver> | null = null;
let durableCached: Promise<BaseCheckpointSaver> | null = null;

export async function getDurableAgentCheckpointer(): Promise<BaseCheckpointSaver> {
  if (!durableCached) {
    durableCached = (async () => {
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error('DATABASE_URL is required for durable agent checkpoints');
      const saver = await createPostgresCheckpointer(url);
      logger.info('Agent checkpoints: PostgresSaver ready');
      return saver;
    })();
  }
  return durableCached;
}

/** Shadow runs may fall back to memory; campaign approval uses the durable accessor above. */
export async function getAgentCheckpointer(): Promise<BaseCheckpointSaver> {
  if (!cached) {
    cached = (async () => {
      const url = process.env.DATABASE_URL;
      if (!url) {
        logger.warn('DATABASE_URL unset — agent checkpoints use in-memory MemorySaver, lost on restart');
        return new MemorySaver();
      }
      try {
        return await getDurableAgentCheckpointer();
      } catch (err) {
        logger.warn({ err }, 'PostgresSaver setup failed — falling back to in-memory MemorySaver');
        return new MemorySaver();
      }
    })();
  }
  return cached;
}

export async function closeAgentCheckpointer(): Promise<void> {
  const saver = durableCached ? await durableCached : null;
  if (saver && 'end' in saver && typeof saver.end === 'function') {
    await saver.end();
  }
  cached = null;
  durableCached = null;
}

/** Test-only: force a fresh checkpointer on the next call. */
export function resetAgentCheckpointerForTests(): void {
  cached = null;
  durableCached = null;
}
