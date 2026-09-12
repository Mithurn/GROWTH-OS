import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export const healthRouter = Router();

/**
 * Liveness. Deliberately dependency-free so Render's health check never restarts a
 * healthy process just because Postgres is briefly unreachable.
 */
healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

/**
 * Readiness, and the target for the external keep-alive cron. The request keeps the
 * Render instance warm; the query keeps Supabase from auto-pausing the project after
 * 7 days without database activity.
 */
healthRouter.get('/health/ready', async (_req, res) => {
  const { error } = await supabase.from('companies').select('id').limit(1);
  if (error) {
    logger.error({ err: error }, 'Readiness check failed');
    return res.status(503).json({ status: 'degraded', database: 'unreachable' });
  }
  res.json({ status: 'ok', database: 'ok', uptime: process.uptime() });
});
