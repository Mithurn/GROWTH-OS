import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // esbuild (the real render.yaml build) reads tsconfig.json's `paths` natively;
  // Vite/Vitest does not, so the same alias is declared here explicitly rather than
  // pulling in a vite-tsconfig-paths dependency for one entry.
  resolve: {
    alias: {
      '@growthos/domain': path.resolve(__dirname, '../packages/domain/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    // packages/domain is pure (no I/O, no Prisma/Supabase) and deliberately has no
    // node_modules of its own — it runs through the backend's already-installed
    // vitest rather than a second npm install. See docs/ARCHITECTURE_V2.md §12.
    // Integration tests (real Postgres via Testcontainers) run through
    // vitest.integration.config.ts instead — they need Docker and take longer, so they
    // are not part of the default `npm test` / CI-per-push run. See `npm run
    // test:integration` and docs/PROGRESS.md Phase 0.
    include: ['src/**/*.test.ts', '../packages/domain/src/**/*.test.ts'],
    exclude: ['src/__tests__/integration/**', 'node_modules/**'],
    env: {
      NODE_ENV: 'test',
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      WEBHOOK_SECRET: 'test-webhook-secret',
      FRONTEND_URL: 'http://localhost:3000',
      LOG_LEVEL: 'silent',
      OPENROUTER_API_KEY: 'test-openrouter-key',
      INTERNAL_API_SECRET: 'test-internal-secret',
    },
    setupFiles: ['./src/__tests__/setup.ts'],
  },
});
