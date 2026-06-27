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
  ingestionQueue: { add: vi.fn() },
}));

// Prevent Prisma from connecting
vi.mock('../lib/prisma', () => ({
  prisma: {
    agent: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      update: vi.fn(),
    },
    agentAction: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

// Prevent AgentOrchestrator from starting
vi.mock('../services/agent-orchestrator', () => ({
  agentOrchestrator: {
    start: vi.fn(),
    runAgentOnce: vi.fn().mockResolvedValue(undefined),
  },
}));
