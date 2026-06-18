import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isDuplicateWebhook } from '../lib/redis';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'growthOS-webhook-secret-dev';

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

const TimestampFields: Record<string, string> = {
  SENT:      'sent_at',
  DELIVERED: 'delivered_at',
  READ:      'read_at',
  CLICKED:   'clicked_at',
  CONVERTED: 'converted_at',
  FAILED:    'failed_at',
};

export function verifySignature(payload: string, signature: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function processWebhook(
  supabase: SupabaseClient,
  event: WebhookEvent
): Promise<{ success: boolean; message: string }> {
  // Redis fast-path dedup: reject duplicates before hitting the DB
  const isDup = await isDuplicateWebhook(event.providerMessageId, event.status);
  if (isDup) {
    return { success: true, message: 'Event already processed (Redis dedup)' };
  }

  // Check idempotency
  const { data: existing, error: checkError } = await supabase
    .from('processed_webhook_events')
    .select('id')
    .eq('event_id', event.eventId)
    .maybeSingle();

  if (checkError) {
    throw new Error(`Failed to check event idempotency: ${checkError.message}`);
  }

  if (existing) {
    return { success: true, message: 'Event already processed (idempotent)' };
  }

  // Get current communication state
  const { data: comm, error: commError } = await supabase
    .from('communications')
    .select('id, status, provider_message_id')
    .eq('id', event.communicationId)
    .maybeSingle();

  if (commError) {
    throw new Error(`Failed to load communication: ${commError.message}`);
  }

  if (!comm) {
    throw new Error(`Communication ${event.communicationId} not found`);
  }

  // ── State machine enforcement ─────────────────────────────────────────────────
  // Enforce transitions based on DB state, not on what the caller asserts.
  // This guards against late callbacks, retried webhooks, and out-of-order DLRs.
  const currentPos = STATE_ORDER[comm.status] ?? 0;

  if (event.status === 'FAILED') {
    if (!FAILED_ALLOWED_FROM.has(comm.status)) {
      console.warn(
        `[Webhook] Rejected FAILED callback for ${event.communicationId}: current state is ${comm.status} (already succeeded)`
      );
      await supabase.from('processed_webhook_events').insert({
        id: crypto.randomUUID(),
        event_id: event.eventId,
        communication_id: event.communicationId,
      });
      return { success: true, message: `Rejected: cannot fail a communication in state ${comm.status}` };
    }
  } else {
    const incomingPos = STATE_ORDER[event.status] ?? 0;
    if (incomingPos <= currentPos) {
      console.warn(
        `[Webhook] Rejected out-of-order transition for ${event.communicationId}: ${comm.status}(${currentPos}) → ${event.status}(${incomingPos})`
      );
      await supabase.from('processed_webhook_events').insert({
        id: crypto.randomUUID(),
        event_id: event.eventId,
        communication_id: event.communicationId,
      });
      return { success: true, message: `Rejected: ${comm.status} → ${event.status} is not a valid forward transition` };
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  // Update communication status and timestamp
  const updates: any = {
    status: event.status,
  };

  if (TimestampFields[event.status]) {
    updates[TimestampFields[event.status]] = event.timestamp;
  }

  if (event.providerMessageId && !comm.provider_message_id) {
    updates.provider_message_id = event.providerMessageId;
  }

  const { error: updateError } = await supabase
    .from('communications')
    .update(updates)
    .eq('id', event.communicationId);

  if (updateError) {
    throw new Error(`Failed to update communication: ${updateError.message}`);
  }

  // Create communication event
  const { error: eventError } = await supabase
    .from('communication_events')
    .insert({
      id: crypto.randomUUID(),
      communication_id: event.communicationId,
      event_type: event.status,
      event_timestamp: event.timestamp,
      sequence_number: event.sequenceNumber,
      provider_message_id: event.providerMessageId,
      provider_event_id: event.eventId,
    });

  if (eventError) {
    throw new Error(`Failed to create communication event: ${eventError.message}`);
  }

  // Mark webhook event as processed
  const { error: processedError } = await supabase
    .from('processed_webhook_events')
    .insert({
      id: crypto.randomUUID(),
      event_id: event.eventId,
      communication_id: event.communicationId,
    });

  if (processedError) {
    throw new Error(`Failed to mark event as processed: ${processedError.message}`);
  }

  console.log(
    `[Webhook] ✓ Processed ${event.status} for ${event.communicationId} (seq ${event.sequenceNumber})`
  );

  return {
    success: true,
    message: `Event processed: ${event.status}`,
  };
}
