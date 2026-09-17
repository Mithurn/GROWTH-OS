import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Integration suite: real Postgres via Testcontainers, real Prisma migrations, no
 * mocks. Deliberately separate from vitest.config.ts (which mocks Prisma/Redis/queues
 * for fast, Docker-free unit tests) — see docs/PROGRESS.md Phase 0 for why both exist.
 *
 * Requires a running Docker daemon. Run with `npm run test:integration`.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@growthos/domain': path.resolve(__dirname, '../packages/domain/src/index.ts'),
      '@growthos/contracts/config/registry': path.resolve(__dirname, '../packages/contracts/src/config/registry.ts'),
      '@growthos/contracts': path.resolve(__dirname, '../packages/contracts/src/index.ts'),
      '@growthos/agent-core': path.resolve(__dirname, '../packages/agent-core/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/integration/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Containers are heavier than unit tests; running files in sequence avoids
    // starting N Postgres containers at once on a laptop.
    fileParallelism: false,
  },
});
