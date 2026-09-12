import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
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
