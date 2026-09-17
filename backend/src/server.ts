import 'dotenv/config';
import { initTracing } from './lib/tracing';
// Must run before any traced module does its first work — registers the
// global tracer provider every `tracer.startActiveSpan()` call picks up.
initTracing();

import { initSentry } from './lib/sentry';
initSentry();

import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

import { logger } from './lib/logger';
import { tracingMiddleware } from './lib/tracing-middleware';
import { startWorkers, closeWorkers } from './lib/queues';
import { agentOrchestrator } from './services/agent-orchestrator';
import { generalLimiter } from './middleware/rate-limits';
import { errorHandler } from './middleware/errorHandler';

import { healthRouter } from './routes/health';
import { companiesRouter } from './routes/companies';
import { onboardingRouter } from './routes/onboarding';
import { ingestionRouter } from './routes/ingestion';
import { insightsRouter } from './routes/insights';
import { personasRouter } from './routes/personas';
import { opportunitiesRouter } from './routes/opportunities';
import { campaignsRouter } from './routes/campaigns';
import { analyticsRouter } from './routes/analytics';
import { agentsRouter } from './routes/agents';
import { webhooksRouter } from './routes/webhooks';
import { internalRouter } from './routes/internal';
import { integrationsRouter } from './routes/integrations';
import { billingRouter } from './routes/billing';
import { attachAgentSteer } from './lib/agent-steer';
import { assertRedisReachable } from './lib/redis';

const app = express();

// Render puts exactly one reverse proxy in front of this service, so `req.ip` is
// otherwise the proxy's own address for every request — every rate limiter would
// key on one shared IP. `1` trusts exactly one hop, not `true` (every hop), which
// would let a spoofed X-Forwarded-For bypass limiting entirely.
app.set('trust proxy', 1);

app.use(helmet());

/**
 * Vercel preview deployments get generated hostnames, so previews are matched by
 * pattern. Scoped to this project's own prefix — a bare `/\.vercel\.app$/` would have
 * allowed every Vercel deployment on the internet to call this API with credentials.
 */
const VERCEL_PREVIEW_PATTERN = /^https:\/\/growos-ai[a-z0-9-]*\.vercel\.app$/;

app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL ?? 'http://localhost:3000',
      'http://localhost:3000',
      VERCEL_PREVIEW_PATTERN,
    ],
    credentials: true,
  }),
);
// Stripe signs the raw request bytes, so its webhook must see the body before
// the global JSON parser rewrites it — mounted here, ahead of express.json().
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));
app.use(tracingMiddleware);
app.use('/api', generalLimiter);

// Health checks sit outside /api so they are not rate limited — Render polls the
// liveness endpoint and an external cron polls readiness every few minutes.
app.use('/', healthRouter);

// Every router declares its own full sub-path, so ordering between them does not
// matter; ordering *within* a router does, where a literal path could be shadowed by
// a parameterised one.
app.use('/api', companiesRouter);
app.use('/api', onboardingRouter);
app.use('/api', ingestionRouter);
app.use('/api', insightsRouter);
app.use('/api', personasRouter);
app.use('/api', opportunitiesRouter);
app.use('/api', campaignsRouter);
app.use('/api', analyticsRouter);
app.use('/api', agentsRouter);
app.use('/api', integrationsRouter);
app.use('/api', billingRouter);
app.use('/api', webhooksRouter);
app.use('/api', internalRouter);

// Must be registered after all routes
app.use(errorHandler);

export { app };

if (require.main === module) {
  assertRedisReachable().then(
    () => {
      const PORT = process.env.PORT || 3001;
      const server = http.createServer(app);
      attachAgentSteer(server);
      server.listen(Number(PORT), '0.0.0.0', () => {
        logger.info({ port: PORT }, 'Backend server started');

        // BullMQ workers belong in their own process (npm run dev:worker locally, the
        // "xeno-crm-worker" Render service once enabled) — see docs/V3_PLAN.md Phase
        // 0.2: splitting them out means an API deploy can no longer kill a job
        // mid-flight. That Render service is written but commented out in render.yaml
        // pending a hosting-cost decision (a third always-on free service exceeds the
        // shared 750h/mo allowance), so jobs still run inline here by default — set
        // WORKERS_IN_API_PROCESS=false once the separate service is turned on.
        if (process.env.WORKERS_IN_API_PROCESS !== 'false') {
          startWorkers();
        }

        // Off by default so local behaviour matches production, where the agent loop is
        // driven by cron hitting /api/internal/agents/run-scheduled.
        if (process.env.ENABLE_AGENT_INTERVAL === 'true') {
          const intervalMs = Number(process.env.AGENT_INTERVAL_MS) || 21_600_000; // 6h
          agentOrchestrator.start(intervalMs);
        } else {
          logger.info(
            'Agent interval disabled — expecting scheduled runs via /api/internal/agents/run-scheduled',
          );
        }
      });

      let shuttingDown = false;
      const shutdown = (signal: string) => {
        if (shuttingDown) return;
        shuttingDown = true;
        logger.info({ signal }, 'API: draining connections before exit');
        // Stops accepting new connections; existing requests finish naturally.
        // initTracing()'s own SIGTERM handler flushes queued spans separately.
        const closeJobs =
          process.env.WORKERS_IN_API_PROCESS !== 'false' ? closeWorkers() : Promise.resolve();
        Promise.all([
          closeJobs,
          new Promise<void>((resolve) => server.close(() => resolve())),
        ]).then(() => {
          logger.info('API: drained, exiting');
          process.exit(0);
        });
        // Render sends SIGKILL well after this, but bound the wait anyway so a
        // stuck connection can't hang the process past its deploy window.
        setTimeout(() => process.exit(0), 10_000).unref();
      };
      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    },
    (err) => {
      logger.fatal({ err }, 'Redis is unreachable. Check REDIS_URL.');
      process.exit(1);
    },
  );
}
