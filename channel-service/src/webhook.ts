import crypto from 'crypto';
import type { WebhookEvent } from './types';

const CRM_WEBHOOK_URL = process.env.CRM_WEBHOOK_URL || 'http://localhost:3001/api/webhooks/channel-status';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
if (!WEBHOOK_SECRET) throw new Error('WEBHOOK_SECRET env var is required');
const RETRY_DELAYS = [
  parseInt(process.env.RETRY_DELAY_1 || '15000'),
  parseInt(process.env.RETRY_DELAY_2 || '30000'),
  parseInt(process.env.RETRY_DELAY_3 || '60000'),
];

function generateSignature(payload: string): string {
  return crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
}

async function sendWebhookWithRetry(event: WebhookEvent, retryCount = 0): Promise<boolean> {
  const payload = JSON.stringify(event);
  const signature = generateSignature(payload);

  try {
    console.log(`[Webhook] Sending ${event.status} for ${event.providerMessageId} (attempt ${retryCount + 1})`);

    const response = await fetch(CRM_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': signature,
      },
      body: payload,
    });

    if (response.ok) {
      console.log(`[Webhook] ✓ ${event.status} delivered for ${event.providerMessageId}`);
      return true;
    }

    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  } catch (error) {
    console.error(`[Webhook] ✗ Failed to send ${event.status} for ${event.providerMessageId}:`, error);

    // Retry logic
    if (retryCount < RETRY_DELAYS.length) {
      const delay = RETRY_DELAYS[retryCount];
      console.log(`[Webhook] Retrying in ${delay}ms (attempt ${retryCount + 2}/${RETRY_DELAYS.length + 1})`);

      await new Promise((resolve) => setTimeout(resolve, delay));
      return sendWebhookWithRetry(event, retryCount + 1);
    }

    console.error(`[Webhook] ✗ Max retries exceeded for ${event.providerMessageId}, giving up`);
    return false;
  }
}

export async function sendWebhook(event: WebhookEvent): Promise<void> {
  // Fire and forget - don't block the queue processor
  sendWebhookWithRetry(event).catch((error) => {
    console.error('[Webhook] Unhandled error:', error);
  });
}
