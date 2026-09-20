import { Router } from 'express';
import { logger } from '../lib/logger';
import { requireAuth, resolveCompanyMiddleware, type AuthRequest } from '../middleware/auth';
import { llmLimiter } from '../middleware/rate-limits';
import { validateBody } from '../middleware/validate';
import {
  generatePersonas,
  getPersonaCustomers,
  getPersonaDistribution,
} from '../services/personas';
import { GeneratePersonasSchema } from '@growthos/contracts';

export const personasRouter = Router();

personasRouter.post(
  '/personas/generate',
  requireAuth,
  resolveCompanyMiddleware,
  llmLimiter,
  validateBody(GeneratePersonasSchema),
  async (req: AuthRequest, res) => {
    try {
      const { model } = req.body ?? {};
      const report = await generatePersonas({ companyId: req.companyId!, model });
      res.json({ success: true, data: report });
    } catch (error) {
      logger.error({ err: error }, 'Error generating personas');
      res.status(500).json({ error: 'Failed to generate personas' });
    }
  },
);

personasRouter.get(
  '/personas',
  requireAuth,
  resolveCompanyMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const distribution = await getPersonaDistribution(req.companyId!);
      res.json({ success: true, data: distribution });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching personas');
      res.status(500).json({ error: 'Failed to fetch personas' });
    }
  },
);

personasRouter.get(
  '/personas/:personaName',
  requireAuth,
  resolveCompanyMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const personaName = decodeURIComponent(req.params['personaName'] as string);
      const result = await getPersonaCustomers(personaName, req.companyId!);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching persona customers');
      res.status(500).json({ error: 'Failed to fetch persona customers' });
    }
  },
);
