import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import {
  requireAuth,
  resolveCompanyMiddleware,
  requireCompanyOwnership,
  type AuthRequest,
} from '../middleware/auth';
import { llmLimiter } from '../middleware/rate-limits';
import { validateBody } from '../middleware/validate';
import {
  generateOpportunities,
  getOpportunityCustomers,
  getOpportunityDashboard,
  createOpportunityFromGoal,
  refineOpportunity,
} from '../services/opportunities';
import {
  GenerateOpportunitiesSchema,
  RefineOpportunitySchema,
  CreateOpportunityFromGoalSchema,
} from '../lib/schemas';

export const opportunitiesRouter = Router();

opportunitiesRouter.post(
  '/opportunities/generate',
  requireAuth,
  resolveCompanyMiddleware,
  llmLimiter,
  validateBody(GenerateOpportunitiesSchema),
  async (req: AuthRequest, res) => {
    try {
      const { model } = req.body ?? {};
      const report = await generateOpportunities(supabase, { companyId: req.companyId!, model });
      res.json({ success: true, data: report });
    } catch (error) {
      logger.error({ err: error }, 'Error generating opportunities');
      res.status(500).json({ error: 'Failed to generate opportunities' });
    }
  },
);

opportunitiesRouter.get(
  '/opportunities',
  requireAuth,
  resolveCompanyMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const report = await getOpportunityDashboard(supabase, req.companyId!);
      res.json({ success: true, data: report });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching opportunities');
      res.status(500).json({ error: 'Failed to fetch opportunities' });
    }
  },
);

/**
 * Registered before `/opportunities/:opportunityId` would otherwise shadow it. The
 * conflict is only theoretical today — the wildcard is a GET and this is a POST — but
 * keeping the literal path first means adding a GET later can't silently break it.
 */
opportunitiesRouter.post(
  '/opportunities/create-from-goal',
  requireAuth,
  resolveCompanyMiddleware,
  llmLimiter,
  validateBody(CreateOpportunityFromGoalSchema),
  async (req: AuthRequest, res) => {
    try {
      const { goal, model } = req.body;

      const opportunity = await createOpportunityFromGoal(supabase, goal.trim(), {
        companyId: req.companyId!,
        model,
      });
      res.json({ success: true, data: opportunity });
    } catch (error) {
      logger.error({ err: error }, 'Error creating opportunity from goal');
      res.status(500).json({
        error: 'Failed to create opportunity from goal',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

opportunitiesRouter.get(
  '/opportunities/:opportunityId',
  requireAuth,
  resolveCompanyMiddleware,
  requireCompanyOwnership('opportunities', 'opportunityId'),
  async (req: AuthRequest, res) => {
    try {
      const opportunityId = req.params['opportunityId'] as string;
      const result = await getOpportunityCustomers(supabase, opportunityId);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching opportunity details');
      res.status(500).json({ error: 'Failed to fetch opportunity details' });
    }
  },
);

opportunitiesRouter.post(
  '/opportunities/:id/refine',
  requireAuth,
  resolveCompanyMiddleware,
  requireCompanyOwnership('opportunities'),
  validateBody(RefineOpportunitySchema),
  async (req: AuthRequest, res) => {
    try {
      const id = req.params['id'] as string;
      const { modifier } = req.body;

      const opportunity = await refineOpportunity(supabase, id, modifier.trim());
      res.json({ success: true, data: opportunity });
    } catch (error) {
      logger.error({ err: error }, 'Error refining opportunity');
      res.status(500).json({
        error: 'Failed to refine opportunity',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  },
);
