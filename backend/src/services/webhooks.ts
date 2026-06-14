import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'xeno-webhook-secret-dev';

export interface WebhookEvent {
  eventId: string;
  providerMessageId: string;
  communicationId: string;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'CLICKED' | 'FAILED';
  timestamp: string;
  sequenceNumber: number;
}

const SequenceNumbers: Record<string, number> = {
  QUEUED: 1,
  SENT: 2,
  DELIVERED: 3,
  READ: 4,
  CLICKED: 5,
  FAILED: 3,
};

const TimestampFields: Record<string, string> = {
  SENT: 'sent_at',
  DELIVERED: 'delivered_at',
  READ: 'read_at',
  CLICKED: 'clicked_at',
  FAILED: 'failed_at',
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

  // Get latest event sequence number for this communication
  const { data: latestEvent } = await supabase
    .from('communication_events')
    .select('sequence_number')
    .eq('communication_id', event.communicationId)
    .order('sequence_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const currentSequence = latestEvent?.sequence_number ?? 0;

  // Enforce sequence number ordering
  if (event.sequenceNumber <= currentSequence) {
    console.warn(
      `[Webhook] Out-of-order event ${event.eventId}: seq ${event.sequenceNumber} <= current ${currentSequence}`
    );
    // Still mark as processed to prevent retries
    await supabase
      .from('processed_webhook_events')
      .insert({
        id: crypto.randomUUID(),
        event_id: event.eventId,
        communication_id: event.communicationId,
      });

    return {
      success: true,
      message: `Event ignored (sequence ${event.sequenceNumber} <= current ${currentSequence})`,
    };
  }

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
