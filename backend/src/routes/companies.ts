import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { requireAuth, resolveCompanyMiddleware, type AuthRequest } from '../middleware/auth';

export const companiesRouter = Router();

/**
 * The caller's own company, resolved from the JWT.
 *
 * Must stay registered before `/companies/:id` — Express matches in order and would
 * otherwise treat "me" as an id.
 */
companiesRouter.get(
  '/companies/me',
  requireAuth,
  resolveCompanyMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', req.companyId!)
        .single();

      if (error) throw error;

      res.json({ success: true, data });
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

      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', req.companyId)
        .single();

      if (error) throw error;

      res.json({ success: true, data });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching company');
      res.status(500).json({ error: 'Failed to fetch company' });
    }
  },
);
