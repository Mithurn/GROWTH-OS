import 'dotenv/config';
import { PrismaClient } from '../../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { tenantScopeExtension } from './tenant-scope';

// Create connection pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Create adapter
const adapter = new PrismaPg(pool);

function buildBaseClient(): PrismaClient {
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

function buildExtendedClient(base: PrismaClient) {
  // Structural tenant-isolation guard (docs/V3_PLAN.md Phase 2) — see
  // lib/tenant-scope.ts. Every consumer of `prisma` gets it automatically.
  return base.$extends(tenantScopeExtension);
}

type ExtendedPrismaClient = ReturnType<typeof buildExtendedClient>;

// Singleton instances, both sharing one connection pool/adapter.
const globalForPrisma = global as unknown as { prisma: ExtendedPrismaClient; prismaSystem: PrismaClient };

/**
 * Unguarded base client — same connection as `prisma` below, no tenant-scope
 * extension. For the small, deliberate set of system-wide sweeps that run
 * across every tenant by design (the agent orchestrator's poll of all active
 * agents, resuming every interrupted ingestion session after a spin-down): a
 * real cross-tenant query, not a missed filter. Reach for `prisma` first; use
 * this only where the query is genuinely meant to span every company, and say
 * so in a comment at the call site.
 */
export const prismaSystem = globalForPrisma.prismaSystem || buildBaseClient();

export const prisma = globalForPrisma.prisma || buildExtendedClient(prismaSystem);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSystem = prismaSystem;
}
