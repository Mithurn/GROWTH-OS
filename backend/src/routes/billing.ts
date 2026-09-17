import { Router } from 'express';
import { logger } from '../lib/logger';
import { requireAuth, resolveCompanyMiddleware, type AuthRequest } from '../middleware/auth';
import {
  createCheckoutSubscription,
  getBillingStatus,
  processWebhookEvent,
  verifyWebhookSignature,
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
      const data = await createCheckoutSubscription(req.companyId!, req.userEmail ?? '');
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
 * Razorpay signs the *raw* request bytes — a re-stringified body will not
 * match, so this route is mounted with express.raw() ahead of the global
 * express.json() in server.ts, unlike every other route.
 */
billingRouter.post('/webhooks/razorpay', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string | undefined;
    const rawBody = req.body as Buffer;

    if (!verifyWebhookSignature(rawBody, signature)) {
      logger.warn('Razorpay webhook invalid signature received');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    await processWebhookEvent(event);

    res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, 'Razorpay webhook processing error');
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});
