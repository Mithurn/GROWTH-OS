import { Router } from 'express';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { requireAuth, resolveCompanyMiddleware, type AuthRequest } from '../middleware/auth';

export const companiesRouter = Router();

function companyJson(row: {
  id: string;
  companyName: string;
  industry: string | null;
  userId: string | null;
  onboardingProfile: unknown;
  onboardingCompletedAt: Date | null;
  plan: string;
  currency: string;
  locale: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    company_name: row.companyName,
    industry: row.industry,
    user_id: row.userId,
    onboarding_profile: row.onboardingProfile,
    onboarding_completed_at: row.onboardingCompletedAt,
    plan: row.plan,
    currency: row.currency,
    locale: row.locale,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

companiesRouter.get(
  '/companies/me',
  requireAuth,
  resolveCompanyMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const row = await prisma.company.findUnique({ where: { id: req.companyId! } });
      if (!row) return res.status(404).json({ error: 'Not found' });
      res.json({ success: true, data: companyJson(row) });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching own company');
      res.status(500).json({ error: 'Failed to fetch company' });
    }
  },
);

companiesRouter.get(
  '/companies/:id',
  requireAuth,
  resolveCompanyMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const id = req.params['id'] as string;
      if (id !== req.companyId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      const row = await prisma.company.findUnique({ where: { id: req.companyId } });
      if (!row) return res.status(404).json({ error: 'Not found' });
      res.json({ success: true, data: companyJson(row) });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching company');
      res.status(500).json({ error: 'Failed to fetch company' });
    }
  },
);
