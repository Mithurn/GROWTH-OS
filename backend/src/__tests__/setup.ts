import { vi } from 'vitest';

// Suppress pino output during tests
vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

// pino-http requires a full pino instance — replace with no-op middleware in tests
vi.mock('pino-http', () => ({
  default: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
}));

// Config resolution (lib/config.ts) reads Redis and Prisma — replaced with the
// registry's own schema defaults so unit tests get the same values that used to
// be hardcoded literals, without a real DB/Redis round-trip. Any test that wants
// a specific override mocks this module locally.
vi.mock('../lib/config', async () => {
  const { schemaDefault } = await vi.importActual<typeof import('@growthos/contracts/config/registry')>(
    '@growthos/contracts/config/registry',
  );
  return {
    getConfig: vi.fn((_companyId: string | null, key: Parameters<typeof schemaDefault>[0]) =>
      Promise.resolve(schemaDefault(key)),
    ),
    setCompanyConfig: vi.fn().mockResolvedValue(undefined),
    setPlanConfig: vi.fn().mockResolvedValue(undefined),
    assertConfigDefaultsSeeded: vi.fn().mockResolvedValue(undefined),
  };
});

// Prevent BullMQ / Redis connections in tests
vi.mock('../lib/queues', () => ({
  startWorkers: vi.fn(),
  closeWorkers: vi.fn().mockResolvedValue(undefined),
  enqueueIngestion: vi.fn().mockResolvedValue(undefined),
  enqueuePersonaGeneration: vi.fn().mockResolvedValue(undefined),
  ingestionQueue: { add: vi.fn() },
}));

// Rate limiting is backed by Redis (rate-limit-redis) so limits hold across
// instances — see docs/V3_PLAN.md Phase 0.1. No route test exercises limiting
// behaviour itself, so the limiters are replaced with pass-through middleware
// rather than standing up a real Redis connection for every unit test.
vi.mock('../middleware/rate-limits', () => {
  const passthrough = (_req: unknown, _res: unknown, next: () => void) => next();
  return {
    generalLimiter: passthrough,
    llmLimiter: passthrough,
    uploadLimiter: passthrough,
    webhookLimiter: passthrough,
  };
});

// Prevent Prisma from connecting. `prismaSystem` (lib/prisma.ts's unguarded
// client for the few deliberate cross-tenant sweeps) shares the same mock —
// nothing here applies the real tenant-scope guard either way, so there is
// no behavioural difference to model in a unit test.
vi.mock('../lib/prisma', () => {
  const mockPrisma = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(0),
    agent: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      update: vi.fn(),
    },
    agentAction: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    ingestionSession: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'sess_test' }),
      update: vi.fn(),
    },
    company: {
      findUnique: vi.fn().mockResolvedValue(null),
      findUniqueOrThrow: vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
    profile: {
      findUnique: vi.fn().mockResolvedValue({ companyId: 'co_test' }),
    },
    customer: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    customerAttributes: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    persona: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    customerMetrics: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _avg: {} }),
    },
    opportunity: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    opportunityCustomer: {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    campaign: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
    },
    integration: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    costLedger: {
      create: vi.fn(),
      aggregate: vi.fn().mockResolvedValue({ _sum: {} }),
    },
    agentRun: {
      create: vi.fn().mockRejectedValue(new Error('agent_runs table missing')),
      update: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
    },
    agentStep: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    communication: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    },
    communicationEvent: {
      create: vi.fn(),
    },
    processedWebhookEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn().mockResolvedValue([]),
  };
  return { prisma: mockPrisma, prismaSystem: mockPrisma };
});

// Prevent AgentOrchestrator from starting
vi.mock('../services/agent-orchestrator', () => ({
  agentOrchestrator: {
    start: vi.fn(),
    runAgentOnce: vi.fn().mockResolvedValue(undefined),
    runAllAgents: vi.fn().mockResolvedValue({ ran: true, agentsProcessed: 0 }),
  },
}));
