import { Router } from 'express';
import { logger } from '../lib/logger';
import { requireAuth, resolveCompanyMiddleware, type AuthRequest } from '../middleware/auth';
import {
  constructWebhookEvent,
  createCheckoutSession,
  getBillingStatus,
  processWebhookEvent,
} from '../services/billing';

export const billingRouter = Router();

billingRouter.get(
  '/billing/status',
  requireAuth,
  resolveCompanyMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const status = await getBillingStatus(req.companyId!);
      res.json({ success: true, data: status });
    } catch (error) {
      logger.error({ err: error }, 'Error fetching billing status');
      res.status(500).json({ error: 'Failed to fetch billing status' });
    }
  },
);

billingRouter.post(
  '/billing/checkout',
  requireAuth,
  resolveCompanyMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const returnUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/settings`;
      const data = await createCheckoutSession(req.companyId!, req.userEmail ?? '', returnUrl);
      res.json({ success: true, data });
    } catch (error) {
      logger.error({ err: error }, 'Error creating billing checkout');
      const message = error instanceof Error && error.message.includes('not configured')
        ? 'Billing is not configured on this deployment yet'
        : 'Failed to start checkout';
      res.status(500).json({ error: message });
    }
  },
);

/**
 * Stripe signs the *raw* request bytes — a re-stringified body will not
 * match, so this route is mounted with express.raw() ahead of the global
 * express.json() in server.ts, unlike every other route.
 */
billingRouter.post('/webhooks/stripe', async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'] as string | undefined;
    const event = constructWebhookEvent(req.body as Buffer, signature);
    await processWebhookEvent(event);
    res.json({ success: true });
  } catch (error) {
    logger.warn({ err: error }, 'Stripe webhook rejected or failed to process');
    res.status(400).json({ error: 'Invalid webhook' });
  }
});
