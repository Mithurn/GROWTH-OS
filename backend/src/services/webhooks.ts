import crypto from 'crypto';
import type { Prisma } from '../../generated/prisma';
import { prisma } from '../lib/prisma';
import { isDuplicateWebhook } from '../lib/redis';
import { logger } from '../lib/logger';
import { emitActivity } from '../lib/activity-emitter';

const WEBHOOK_SECRET: string = (() => {
  if (!process.env.WEBHOOK_SECRET) throw new Error('WEBHOOK_SECRET env var is required');
  return process.env.WEBHOOK_SECRET;
})();

export interface WebhookEvent {
  eventId: string;
  providerMessageId: string;
  communicationId: string;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'CLICKED' | 'CONVERTED' | 'FAILED';
  timestamp: string;
  sequenceNumber: number;
}

// Strict forward-only state machine. FAILED is a terminal error state handled separately.
// Rule: incoming status position must be strictly greater than current status position.
const STATE_ORDER: Record<string, number> = {
  QUEUED:    1,
  SENT:      2,
  DELIVERED: 3,
  READ:      4,
  CLICKED:   5,
  CONVERTED: 6,
};

// FAILED is only valid from pre-success states (before READ).
// Once a message is READ/CLICKED/CONVERTED it cannot regress to FAILED.
const FAILED_ALLOWED_FROM = new Set(['QUEUED', 'SENT', 'DELIVERED']);
const TERMINAL_STATUSES = ['DELIVERED', 'READ', 'CLICKED', 'CONVERTED', 'FAILED'];

async function finishCampaignFromDelivery(campaignId: string, companyId: string): Promise<void> {
  const [total, pending, failed] = await Promise.all([
    prisma.communication.count({ where: { campaignId } }),
    prisma.communication.count({ where: { campaignId, status: { notIn: TERMINAL_STATUSES } } }),
    prisma.communication.count({ where: { campaignId, status: 'FAILED' } }),
  ]);
  if (total === 0 || pending > 0) return;
  const status = failed === 0 ? 'Completed' : failed === total ? 'Failed' : 'Partial';
  const updated = await prisma.campaign.updateMany({
    where: { id: campaignId, companyId, status: { in: ['Dispatching', 'Launched'] } },
    data: { status, completedAt: new Date() },
  });
  if (updated.count) {
    await prisma.campaignAuditEvent.create({
      data: { companyId, campaignId, eventType: 'DELIVERY_COMPLETED', metadata: { status, total, failed } },
    });
    try {
      const { embedCampaignOutcome } = await import('./campaign-embeddings');
      await embedCampaignOutcome(campaignId);
    } catch (err) {
      logger.warn({ err, campaignId }, 'Campaign outcome embedding failed after delivery completion');
    }
  }
}

export function verifySignature(payload: string, signature: string): boolean {
  if (typeof signature !== 'string' || signature.length === 0) return false;

  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  const provided = Buffer.from(signature, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');

  // timingSafeEqual throws on length mismatch, which would surface a malformed
  // signature as a 500 instead of a 401. Compare lengths first — a length mismatch
  // is already a definitive rejection and leaks nothing about the expected digest.
  if (provided.length !== expectedBuf.length) return false;

  return crypto.timingSafeEqual(provided, expectedBuf);
}

/**
 * Timestamp field to stamp per status. Typed against the Prisma model so a
 * misspelled field is a compile error rather than a timestamp that silently
 * never gets written.
 */
const TimestampFields = {
  SENT:      'sentAt',
  DELIVERED: 'deliveredAt',
  READ:      'readAt',
  CLICKED:   'clickedAt',
  CONVERTED: 'convertedAt',
  FAILED:    'failedAt',
} as const satisfies Record<string, keyof Prisma.CommunicationUpdateInput>;

/** Prisma's unique-constraint violation. */
const UNIQUE_VIOLATION = 'P2002';

/**
 * Apply a provider delivery callback to a communication.
 *
 * Runs on Prisma rather than the Supabase client because the three writes it makes
 * (advance the communication, append the event, record the event id as processed)
 * have to land together. Previously they were three independent requests: if the
 * event insert failed after the status update had committed, the provider's retry
 * would be rejected by the state machine as out-of-order, marked processed, and the
 * event row lost for good — silently undercounting campaign analytics.
 *
 * Dedup relies on the unique index on `processed_webhook_events.event_id` instead of
 * a read-then-write check, so two concurrent deliveries of the same event can't both
 * pass the check and double-apply.
 */
export async function processWebhook(
  event: WebhookEvent
): Promise<{ success: boolean; message: string }> {
  // Redis fast-path dedup: reject duplicates before hitting the DB
  const isDup = await isDuplicateWebhook(event.providerMessageId, event.status);
  if (isDup) {
    return { success: true, message: 'Event already processed (Redis dedup)' };
  }

  const comm = await prisma.communication.findUnique({
    where: { id: event.communicationId },
    select: {
      id: true,
      status: true,
      providerMessageId: true,
      campaignId: true,
      campaign: { select: { companyId: true, agentId: true } },
    },
  });

  if (!comm) {
    throw new Error(`Communication ${event.communicationId} not found`);
  }

  // ── State machine enforcement ─────────────────────────────────────────────────
  // Enforce transitions based on DB state, not on what the caller asserts.
  // This guards against late callbacks, retried webhooks, and out-of-order DLRs.
  const rejection = rejectionReason(comm.status, event.status);

  if (rejection) {
    logger.warn(
      { communicationId: event.communicationId, from: comm.status, to: event.status },
      'Webhook: rejected transition',
    );
    // Still recorded as processed so the provider stops retrying a callback we will
    // never apply.
    await markProcessed(event);
    return { success: true, message: rejection };
  }
  // ─────────────────────────────────────────────────────────────────────────────

  const updates: Prisma.CommunicationUpdateInput = { status: event.status };

  const timestampField = TimestampFields[event.status as keyof typeof TimestampFields];
  if (timestampField) {
    updates[timestampField] = new Date(event.timestamp);
  }

  if (event.providerMessageId && !comm.providerMessageId) {
    updates.providerMessageId = event.providerMessageId;
  }

  try {
    await prisma.$transaction([
      // First, so a duplicate aborts the whole transaction before anything is applied.
      prisma.processedWebhookEvent.create({
        data: { eventId: event.eventId, communicationId: event.communicationId },
      }),
      prisma.communication.update({
        where: { id: event.communicationId },
        data: updates,
      }),
      prisma.communicationEvent.create({
        data: {
          communicationId: event.communicationId,
          eventType: event.status,
          eventTimestamp: new Date(event.timestamp),
          sequenceNumber: event.sequenceNumber,
          providerMessageId: event.providerMessageId,
          providerEventId: event.eventId,
        },
      }),
      prisma.campaignAuditEvent.create({
        data: {
          companyId: comm.campaign.companyId,
          campaignId: comm.campaignId,
          eventType: 'PROVIDER_CALLBACK',
          metadata: { communicationId: comm.id, status: event.status, providerEventId: event.eventId },
        },
      }),
    ]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: true, message: 'Event already processed (idempotent)' };
    }
    throw error;
  }

  logger.info(
    { status: event.status, communicationId: event.communicationId, seq: event.sequenceNumber },
    'Webhook processed',
  );

  if (comm.campaign?.companyId) {
    emitActivity({
      id: `delivery:${event.eventId}`,
      companyId: comm.campaign.companyId,
      agentId: comm.campaign.agentId ?? '',
      actionType: 'campaign_delivery',
      description: event.status,
      details: {
        campaignId: comm.campaignId,
        communicationId: comm.id,
        status: event.status,
      },
      createdAt: new Date(),
    });
  }
  await finishCampaignFromDelivery(comm.campaignId, comm.campaign.companyId);

  return {
    success: true,
    message: `Event processed: ${event.status}`,
  };
}

/**
 * Why this callback cannot be applied to a communication in `currentStatus`,
 * or null if it can.
 */
function rejectionReason(currentStatus: string, incomingStatus: string): string | null {
  if (incomingStatus === 'FAILED') {
    return FAILED_ALLOWED_FROM.has(currentStatus)
      ? null
      : `Rejected: cannot fail a communication in state ${currentStatus}`;
  }

  const currentPos = STATE_ORDER[currentStatus] ?? 0;
  const incomingPos = STATE_ORDER[incomingStatus] ?? 0;

  return incomingPos > currentPos
    ? null
    : `Rejected: ${currentStatus} → ${incomingStatus} is not a valid forward transition`;
}

async function markProcessed(event: WebhookEvent): Promise<void> {
  try {
    await prisma.processedWebhookEvent.create({
      data: { eventId: event.eventId, communicationId: event.communicationId },
    });
  } catch (error) {
    // A concurrent delivery already recorded it, which is the outcome we wanted.
    if (!isUniqueViolation(error)) throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === UNIQUE_VIOLATION
  );
}
