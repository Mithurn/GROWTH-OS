import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import 'dotenv/config';

import { logger } from './lib/logger';
import { startWorkers } from './lib/queues';
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

const app = express();

app.use((_req, res, next) => {
  res.setHeader('x-request-id', `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  next();
});
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
app.use(express.json());
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));
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
app.use('/api', webhooksRouter);
app.use('/api', internalRouter);

// Must be registered after all routes
app.use(errorHandler);

export { app };

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(Number(PORT), '0.0.0.0', () => {
    logger.info({ port: PORT }, 'Backend server started');
    startWorkers();

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
}
