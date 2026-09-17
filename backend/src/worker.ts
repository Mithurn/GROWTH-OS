import 'dotenv/config';
import { initTracing } from './lib/tracing';
// Same ordering requirement as server.ts: must run before any traced module
// does its first work.
initTracing();

import { initSentry } from './lib/sentry';
initSentry();

import { logger } from './lib/logger';
import { startWorkers, closeWorkers } from './lib/queues';
import { assertRedisReachable } from './lib/redis';
import { assertConfigDefaultsSeeded } from './lib/config';
import { prisma } from './lib/prisma';

/**
 * BullMQ workers, split out of the API process (see docs/V3_PLAN.md Phase 0.2).
 * Running them inside server.ts meant every deploy killed whatever job was
 * mid-flight — including a send already in progress — because the same
 * process serving HTTP requests was also the one holding the job. This is a
 * separate Render service so a deploy of one never interrupts the other.
 */
async function main(): Promise<void> {
  await assertRedisReachable();
  await assertConfigDefaultsSeeded();
  await startWorkers();
  logger.info('Worker process started');
}

main().catch((err) => {
  logger.fatal({ err }, 'Worker process failed to start');
  process.exit(1);
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Worker: draining in-flight jobs before exit');
  try {
    await closeWorkers();
    await prisma.$disconnect();
  } catch (err) {
    logger.error({ err }, 'Worker: error during shutdown');
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
