import { Router } from 'express';
import { prismaSystem } from '../lib/prisma';
import { logger } from '../lib/logger';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

healthRouter.get('/health/ready', async (_req, res) => {
  try {
    await prismaSystem.company.findFirst({ select: { id: true } });
    res.json({ status: 'ok', database: 'ok', uptime: process.uptime() });
  } catch (err) {
    logger.error({ err }, 'Readiness check failed');
    return res.status(503).json({ status: 'degraded', database: 'unreachable' });
  }
});
