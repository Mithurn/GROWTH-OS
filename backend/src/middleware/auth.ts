import { timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { trace } from '@opentelemetry/api';
import { supabase } from '../lib/supabase';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  companyId?: string;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.userId = user.id;
  req.userEmail = user.email;
  next();
}

// Resolves companyId from the profiles table using the authenticated userId.
// Must run after requireAuth. Returns 403 if the user has no company yet.
export async function resolveCompanyMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const { data } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', req.userId!)
    .maybeSingle();

  if (!data?.company_id) {
    return res.status(403).json({
      error: 'No company found for this user. Please complete onboarding first.',
    });
  }

  req.companyId = data.company_id;
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttribute('company.id', data.company_id);
    span.setAttribute('langfuse.user.id', data.company_id);
  }
  next();
}

/**
 * Guard for machine-to-machine routes driven by an external scheduler.
 *
 * There is no user behind these calls, so a Supabase JWT is the wrong credential.
 * Compares a shared secret in constant time. If `INTERNAL_API_SECRET` is unset the
 * route is refused outright rather than left open.
 */
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

// Soft auth — attaches userId if token present, continues either way
export async function softAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) req.userId = user.id;
  }
  next();
}

/** Tables that expose a route parameter holding a row id, keyed to their company column. */
const OWNED_TABLES = {
  campaigns: 'company_id',
  opportunities: 'company_id',
  agents: 'company_id',
  ingestion_sessions: 'company_id',
} as const;

type OwnedTable = keyof typeof OWNED_TABLES;

/**
 * Assert that the row named by `req.params[paramName]` belongs to the caller's company.
 *
 * Every backend query runs with the Supabase service role, which bypasses RLS
 * entirely, so row ownership has to be checked here. Without this, `requireAuth`
 * alone lets any signed-in user read, approve, or launch another tenant's records
 * just by knowing an id.
 *
 * Must run after `requireAuth` and `resolveCompanyMiddleware`.
 */
export function requireCompanyOwnership(table: OwnedTable, paramName = 'id') {
  const companyColumn = OWNED_TABLES[table];

  return async function (req: AuthRequest, res: Response, next: NextFunction) {
    const id = req.params[paramName];
    if (!id) return res.status(400).json({ error: `Missing ${paramName}` });

    const { data, error } = await supabase
      .from(table)
      .select(companyColumn)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: 'Failed to verify resource ownership' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Not found' });
    }

    // 404 rather than 403 on a tenant mismatch — a 403 would confirm the id exists.
    if ((data as Record<string, string>)[companyColumn] !== req.companyId) {
      return res.status(404).json({ error: 'Not found' });
    }

    next();
  };
}
