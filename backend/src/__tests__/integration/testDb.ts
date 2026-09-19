import { execSync } from 'child_process';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '../../../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { installTenantRls } from '../../lib/tenant-context';

/**
 * Real Postgres in a real container, real migrations applied via `prisma migrate
 * deploy`, a real PrismaClient talking to it. Deliberately not the mocked `prisma`
 * from `../setup.ts` — the whole point of this harness is to test what the mocked
 * suite cannot: actual constraint enforcement, actual concurrent writes, actual
 * cross-tenant isolation at the database layer. See docs/ARCHITECTURE_V2.md §12 and
 * docs/PROGRESS.md Phase 0.
 *
 * One container is shared across the whole integration run (started once in a
 * `beforeAll` at the top of the test file, stopped in `afterAll`) — starting a fresh
 * container per test would be correct but slow; tests instead clean up their own rows
 * between cases.
 */

export interface TestDb {
  container: StartedPostgreSqlContainer;
  prisma: PrismaClient;
  rlsPrisma: PrismaClient;
  stop: () => Promise<void>;
}

export async function startTestDb(): Promise<TestDb> {
  const container = await new PostgreSqlContainer('pgvector/pgvector:pg16')
    .withDatabase('growthos_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  const connectionUri = container.getConnectionUri();

  // `prisma migrate deploy` shells out rather than using the Prisma Client's own
  // migration API — this is the same command render.yaml's preDeployCommand runs in
  // production, so the integration suite is exercising the actual deploy path, not a
  // parallel one that could drift from it.
  try {
    execSync('npx prisma migrate deploy --schema=prisma/schema.prisma', {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: connectionUri, DIRECT_URL: connectionUri },
      stdio: 'pipe',
    });
  } catch (err) {
    await container.stop();
    throw err;
  }

  const pool = new Pool({ connectionString: connectionUri });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  const rlsPool = new Pool({ connectionString: connectionUri });
  installTenantRls(rlsPool);
  const rlsPrisma = new PrismaClient({ adapter: new PrismaPg(rlsPool) });

  return {
    container,
    prisma,
    rlsPrisma,
    stop: async () => {
      await rlsPrisma.$disconnect();
      await prisma.$disconnect();
      await rlsPool.end();
      await pool.end();
      await container.stop();
    },
  };
}
