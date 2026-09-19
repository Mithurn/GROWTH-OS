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
  generateCampaign,
  saveCampaign,
  launchCampaign,
  getCampaigns,
  getCampaignById,
  refineCampaignMessage,
} from '../services/campaigns';
import { getCampaignAnalytics } from '../services/analytics';
import { subscribeTenantStream } from '../lib/tenant-stream';
import {
  GenerateCampaignSchema,
  SaveCampaignSchema,
  RefineCampaignSchema,
  ApproveCampaignSchema,
  RejectCampaignSchema,
} from '@growthos/contracts';
import { CampaignTransitionError, decideCampaign } from '../services/campaign-approval';
import { ensureCampaignApprovalWorkflow } from '../services/campaign-approval-workflow';

export const campaignsRouter = Router();

/** Returns an unsaved draft. `POST /campaigns` is what persists it. */
campaignsRouter.post(
  '/campaigns/generate',
  requireAuth,
  resolveCompanyMiddleware,
  llmLimiter,
  validateBody(GenerateCampaignSchema),
  async (req: AuthRequest, res) => {
    try {
      const { opportunityId, model } = req.body;
      const result = await generateCampaign(supabase, {
        opportunityId,
        companyId: req.companyId!,
        model,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ err: error }, 'Error generating campaign');
      res.status(500).json({ error: 'Failed to generate campaign' });
    }
  },
);

/** Idempotent per opportunity — returns the existing row instead of inserting a second. */
campaignsRouter.post(
  '/campaigns',
  requireAuth,
  resolveCompanyMiddleware,
  validateBody(SaveCampaignSchema),
  async (req: AuthRequest, res) => {
    try {
      const { opportunityId, campaign } = req.body ?? {};

      const result = await saveCampaign(supabase, opportunityId, campaign, req.companyId!);
      if (result.status === 'Draft') {
        await ensureCampaignApprovalWorkflow({ campaignId: result.id, companyId: req.companyId! });
      }
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ err: error }, 'Error saving campaign');
      res
        .status(500)
        .json({ error: error instanceof Error ? error.message : 'Failed to save campaign' });
    }
  },
);

campaignsRouter.get(
  '/campaigns',
  requireAuth,
  resolveCompanyMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string) || 20));
      const { data, total } = await getCampaigns(supabase, req.companyId!, { page, limit });
      res.json({
        success: true,
        data,
        meta: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching campaigns');
      res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
  },
);

campaignsRouter.get(
  '/campaigns/:id',
  requireAuth,
  resolveCompanyMiddleware,
  requireCompanyOwnership('campaigns'),
  async (req: AuthRequest, res) => {
    try {
      const id = req.params['id'] as string;
      const campaign = await getCampaignById(supabase, id);
      res.json({ success: true, data: campaign });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching campaign');
      res.status(500).json({ error: 'Failed to fetch campaign' });
    }
  },
);

/** Snapshot. Live updates go through GET /campaigns/:id/events (SSE). */
campaignsRouter.get(
  '/campaigns/:id/analytics',
  requireAuth,
  resolveCompanyMiddleware,
  requireCompanyOwnership('campaigns'),
  async (req: AuthRequest, res) => {
    try {
      const id = req.params['id'] as string;
      const analytics = await getCampaignAnalytics(supabase, id);
      res.json({ success: true, data: analytics });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching campaign analytics');
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to fetch campaign analytics',
      });
    }
  },
);

campaignsRouter.get(
  '/campaigns/:id/events',
  requireAuth,
  resolveCompanyMiddleware,
  requireCompanyOwnership('campaigns'),
  async (req: AuthRequest, res) => {
    const id = req.params['id'] as string;
    const lastEventId = req.header('last-event-id') ?? undefined;
    const unsubscribe = await subscribeTenantStream(res, req.companyId!, {
      lastEventId,
      filter: (event) =>
        event.actionType === 'campaign_delivery' && event.payload['campaignId'] === id,
    });
    req.on('close', unsubscribe);
  },
);

campaignsRouter.post(
  '/campaigns/:id/refine',
  requireAuth,
  resolveCompanyMiddleware,
  requireCompanyOwnership('campaigns'),
  validateBody(RefineCampaignSchema),
  async (req: AuthRequest, res) => {
    try {
      const id = req.params['id'] as string;
      const { modifier, channel } = req.body;

      const result = await refineCampaignMessage(supabase, id, modifier, channel ?? undefined);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ err: error }, 'Error refining campaign message');
      res.status(500).json({
        error: 'Failed to refine campaign message',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  },
);

campaignsRouter.post(
  '/campaigns/:id/approve',
  requireAuth,
  resolveCompanyMiddleware,
  requireCompanyOwnership('campaigns'),
  validateBody(ApproveCampaignSchema),
  async (req: AuthRequest, res) => {
    try {
      const id = req.params['id'] as string;
      const campaign = await decideCampaign({
        campaignId: id,
        companyId: req.companyId!,
        actorId: req.userId!,
        decision: 'approved',
        reason: req.body.reason,
      });
      res.json({ success: true, data: campaign });
    } catch (error) {
      logger.error({ err: error }, 'Error approving campaign');
      res.status(error instanceof CampaignTransitionError ? 409 : 500).json({
        error: error instanceof Error ? error.message : 'Failed to approve campaign',
      });
    }
  },
);

campaignsRouter.post(
  '/campaigns/:id/reject',
  requireAuth,
  resolveCompanyMiddleware,
  requireCompanyOwnership('campaigns'),
  validateBody(RejectCampaignSchema),
  async (req: AuthRequest, res) => {
    try {
      const id = req.params['id'] as string;
      const campaign = await decideCampaign({
        campaignId: id,
        companyId: req.companyId!,
        actorId: req.userId!,
        decision: 'rejected',
        reason: req.body.reason,
      });
      res.json({ success: true, data: campaign });
    } catch (error) {
      logger.error({ err: error }, 'Error rejecting campaign');
      res.status(error instanceof CampaignTransitionError ? 409 : 500).json({
        error: error instanceof Error ? error.message : 'Failed to reject campaign',
      });
    }
  },
);

/** Warms the channel service, then fans out one send per audience member. */
campaignsRouter.post(
  '/campaigns/:id/launch',
  requireAuth,
  resolveCompanyMiddleware,
  requireCompanyOwnership('campaigns'),
  async (req: AuthRequest, res) => {
    try {
      const id = req.params['id'] as string;
      const result = await launchCampaign(supabase, id);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error({ err: error }, 'Error launching campaign');
      res
        .status(500)
        .json({ error: error instanceof Error ? error.message : 'Failed to launch campaign' });
    }
  },
);
