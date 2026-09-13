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

// Prevent BullMQ / Redis connections in tests
vi.mock('../lib/queues', () => ({
  startWorkers: vi.fn(),
  enqueueIngestion: vi.fn().mockResolvedValue(undefined),
  enqueuePersonaGeneration: vi.fn().mockResolvedValue(undefined),
  ingestionQueue: { add: vi.fn() },
}));

// Prevent Prisma from connecting
vi.mock('../lib/prisma', () => ({
  prisma: {
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
      create: vi.fn(),
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
  },
}));

// Prevent AgentOrchestrator from starting
vi.mock('../services/agent-orchestrator', () => ({
  agentOrchestrator: {
    start: vi.fn(),
    runAgentOnce: vi.fn().mockResolvedValue(undefined),
    runAllAgents: vi.fn().mockResolvedValue({ ran: true, agentsProcessed: 0 }),
  },
}));
