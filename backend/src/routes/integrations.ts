import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../lib/logger';
import { requireAuth, resolveCompanyMiddleware, type AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  INTEGRATION_KINDS,
  listIntegrations,
  upsertIntegration,
  verifyIntegration,
  type IntegrationKind,
} from '../services/integrations';

export const integrationsRouter = Router();

const UpsertIntegrationSchema = z.object({
  provider: z.string().min(1).max(40).optional(),
  mode: z.enum(['simulator', 'byok']).optional(),
  apiKey: z.string().min(4).max(200).optional(),
});

function parseKind(raw: string | undefined): IntegrationKind | null {
  if (!raw) return null;
  return (INTEGRATION_KINDS as readonly string[]).includes(raw) ? (raw as IntegrationKind) : null;
}

integrationsRouter.get(
  '/integrations',
  requireAuth,
  resolveCompanyMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const result = await listIntegrations(req.companyId!);
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error({ err: error }, 'Error listing integrations');
      res.status(500).json({ error: 'Failed to list integrations' });
    }
  },
);

integrationsRouter.put(
  '/integrations/:kind',
  requireAuth,
  resolveCompanyMiddleware,
  validateBody(UpsertIntegrationSchema),
  async (req: AuthRequest, res) => {
    const kind = parseKind(typeof req.params['kind'] === 'string' ? req.params['kind'] : undefined);
    if (!kind) return res.status(400).json({ error: 'Unknown integration kind' });
    try {
      const data = await upsertIntegration(req.companyId!, kind, req.body);
      res.json({ success: true, data });
    } catch (error) {
      logger.error({ err: error }, 'Error saving integration');
      const message = error instanceof Error && error.message.includes('INTEGRATION_MASTER_KEY')
        ? 'Integration secrets are not configured on this process'
        : 'Failed to save integration';
      res.status(500).json({ error: message });
    }
  },
);

integrationsRouter.post(
  '/integrations/:kind/verify',
  requireAuth,
  resolveCompanyMiddleware,
  async (req: AuthRequest, res) => {
    const kind = parseKind(typeof req.params['kind'] === 'string' ? req.params['kind'] : undefined);
    if (!kind) return res.status(400).json({ error: 'Unknown integration kind' });
    try {
      const data = await verifyIntegration(req.companyId!, kind);
      res.json({ success: true, data });
    } catch (error) {
      logger.error({ err: error }, 'Error verifying integration');
      res.status(500).json({ error: 'Failed to verify integration' });
    }
  },
);
