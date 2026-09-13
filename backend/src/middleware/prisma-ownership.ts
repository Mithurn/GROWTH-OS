import type { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import type { AuthRequest } from './auth';

/**
 * Agents (and their runs) live in Prisma. Checking ownership through the
 * Supabase JS client looks at a different database in local env, so a real
 * row 404s. Same companyId check as requireCompanyOwnership — different store.
 */
export function requireOwnedAgent(paramName = 'id') {
  return async function (req: AuthRequest, res: Response, next: NextFunction) {
    const id = req.params[paramName];
    if (!id) return res.status(400).json({ error: `Missing ${paramName}` });

    const agent = await prisma.agent.findUnique({
      where: { id },
      select: { companyId: true },
    });

    if (!agent || agent.companyId !== req.companyId) {
      return res.status(404).json({ error: 'Not found' });
    }

    next();
  };
}

export function requireOwnedOpportunity(paramName = 'id') {
  return async function (req: AuthRequest, res: Response, next: NextFunction) {
    const id = req.params[paramName];
    if (!id) return res.status(400).json({ error: `Missing ${paramName}` });

    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
      select: { companyId: true },
    });

    if (!opportunity || opportunity.companyId !== req.companyId) {
      return res.status(404).json({ error: 'Not found' });
    }

    next();
  };
}
