import { timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { trace } from '@opentelemetry/api';
import { prisma } from '../lib/prisma';
import { runWithTenant } from '../lib/tenant-context';
import { verifySupabaseToken } from '../lib/verify-jwt';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  companyId?: string;
  role?: string;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = await verifySupabaseToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.userId = user.id;
  req.userEmail = user.email;
  next();
}

export async function resolveCompanyMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const profile = await prisma.profile.findUnique({
    where: { id: req.userId! },
    select: { companyId: true, role: true },
  });

  if (!profile?.companyId) {
    return res.status(403).json({
      error: 'No company found for this user. Please complete onboarding first.',
    });
  }

  req.companyId = profile.companyId;
  req.role = profile.role;
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttribute('company.id', profile.companyId);
    span.setAttribute('langfuse.user.id', profile.companyId);
  }
  runWithTenant(profile.companyId, () => next());
}

export function requireOwner(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.role !== 'owner') return res.status(403).json({ error: 'Owner access required' });
  next();
}

export function requireInternalSecret(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.INTERNAL_API_SECRET;
  if (!expected) {
    return res.status(503).json({ error: 'Internal endpoints are not configured' });
  }

  const provided = req.headers['x-internal-secret'];
  if (typeof provided !== 'string') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

export async function softAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const user = await verifySupabaseToken(token);
    if (user) req.userId = user.id;
  }
  next();
}

type OwnedTable = 'campaigns' | 'opportunities' | 'agents' | 'ingestion_sessions';

export function requireCompanyOwnership(table: OwnedTable, paramName = 'id') {
  return async function (req: AuthRequest, res: Response, next: NextFunction) {
    const raw = req.params[paramName];
    const id = Array.isArray(raw) ? raw[0] : raw;
    if (!id) return res.status(400).json({ error: `Missing ${paramName}` });

    const row =
      table === 'campaigns'
        ? await prisma.campaign.findUnique({ where: { id }, select: { companyId: true } })
        : table === 'opportunities'
          ? await prisma.opportunity.findUnique({ where: { id }, select: { companyId: true } })
          : table === 'agents'
            ? await prisma.agent.findUnique({ where: { id }, select: { companyId: true } })
            : await prisma.ingestionSession.findUnique({ where: { id }, select: { companyId: true } });

    if (!row || row.companyId !== req.companyId) {
      return res.status(404).json({ error: 'Not found' });
    }

    next();
  };
}
