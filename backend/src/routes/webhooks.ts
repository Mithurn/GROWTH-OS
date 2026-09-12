import { Router } from 'express';
import { logger } from '../lib/logger';
import { webhookLimiter } from '../middleware/rate-limits';
import { verifySignature, processWebhook, type WebhookEvent } from '../services/webhooks';

export const webhooksRouter = Router();

/**
 * Delivery status callbacks from the channel service.
 *
 * Authenticated by HMAC over the raw payload rather than a JWT — the caller is another
 * service, not a user. `processWebhook` handles idempotency by event id and rejects
 * out-of-order sequence numbers, because a provider can retry and reorder freely.
 */
webhooksRouter.post('/webhooks/channel-status', webhookLimiter, async (req, res) => {
  try {
    const signature = req.headers['x-signature'] as string;

    if (!signature) {
      return res.status(401).json({ error: 'Missing X-Signature header' });
    }

    const payload = JSON.stringify(req.body);
    if (!verifySignature(payload, signature)) {
      logger.warn('Webhook invalid signature received');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body as WebhookEvent;
    const result = await processWebhook(event);

    res.json(result);
  } catch (error) {
    logger.error({ err: error }, 'Webhook processing error');
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});
