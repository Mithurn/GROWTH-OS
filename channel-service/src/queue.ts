import { v4 as uuidv4 } from 'uuid';
import type { QueuedMessage, CommunicationStatus, SendRequest } from './types';
import { SequenceNumbers } from './types';
import { sendWebhook } from './webhook';

// In-memory storage
const messageQueue = new Map<string, QueuedMessage>();

// Configuration
const QUEUED_TO_SENT_DELAY = parseInt(process.env.QUEUED_TO_SENT_DELAY || '2000');
const SENT_TO_DELIVERED_DELAY = parseInt(process.env.SENT_TO_DELIVERED_DELAY || '3000');
const DELIVERED_TO_READ_DELAY = parseInt(process.env.DELIVERED_TO_READ_DELAY || '4000');
const READ_TO_CLICKED_DELAY = parseInt(process.env.READ_TO_CLICKED_DELAY || '5000');
const FAILURE_RATE = parseInt(process.env.FAILURE_RATE || '10');

function generateProviderMessageId(channel: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);

  switch (channel) {
    case 'WhatsApp':
      return `wa_msg_${timestamp}_${random}`;
    case 'Email':
      return `email_msg_${timestamp}_${random}`;
    case 'SMS':
      return `sms_msg_${timestamp}_${random}`;
    default:
      return `msg_${timestamp}_${random}`;
  }
}

function shouldFail(): boolean {
  return Math.random() * 100 < FAILURE_RATE;
}

async function transitionToStatus(
  message: QueuedMessage,
  newStatus: CommunicationStatus,
  delay: number
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delay));

  // Update message state
  message.status = newStatus;
  message.sequenceNumber = SequenceNumbers[newStatus];
  message.lastUpdatedAt = new Date();

  console.log(
    `[Queue] ${message.providerMessageId} → ${newStatus} (seq ${message.sequenceNumber})`
  );

  // Send webhook
  await sendWebhook({
    eventId: uuidv4(),
    providerMessageId: message.providerMessageId,
    communicationId: message.communicationId,
    status: newStatus,
    timestamp: new Date().toISOString(),
    sequenceNumber: message.sequenceNumber,
  });
}

async function processMessage(message: QueuedMessage): Promise<void> {
  try {
    // QUEUED → SENT
    await transitionToStatus(message, 'SENT', QUEUED_TO_SENT_DELAY);

    // SENT → DELIVERED or FAILED
    if (shouldFail()) {
      await transitionToStatus(message, 'FAILED', SENT_TO_DELIVERED_DELAY);
      return; // Stop processing
    }

    await transitionToStatus(message, 'DELIVERED', SENT_TO_DELIVERED_DELAY);

    // DELIVERED → READ (60% chance)
    if (Math.random() < 0.6) {
      await transitionToStatus(message, 'READ', DELIVERED_TO_READ_DELAY);

      // READ → CLICKED (20% chance)
      if (Math.random() < 0.2) {
        await transitionToStatus(message, 'CLICKED', READ_TO_CLICKED_DELAY);
      }
    }
  } catch (error) {
    console.error(`[Queue] Error processing ${message.providerMessageId}:`, error);
  }
}

export function queueMessage(request: SendRequest): string {
  const providerMessageId = generateProviderMessageId(request.channel);

  const message: QueuedMessage = {
    communicationId: request.communicationId,
    providerMessageId,
    recipient: request.recipient,
    channel: request.channel,
    content: request.content,
    status: 'QUEUED',
    sequenceNumber: SequenceNumbers.QUEUED,
    createdAt: new Date(),
    lastUpdatedAt: new Date(),
  };

  messageQueue.set(providerMessageId, message);

  console.log(
    `[Queue] ✓ Queued ${providerMessageId} for ${request.recipient} via ${request.channel}`
  );

  // Start async processing (fire and forget)
  processMessage(message).catch((error) => {
    console.error('[Queue] Unhandled processing error:', error);
  });

  return providerMessageId;
}

export function getMessageStatus(providerMessageId: string): QueuedMessage | undefined {
  return messageQueue.get(providerMessageId);
}

export function getAllMessages(): QueuedMessage[] {
  return Array.from(messageQueue.values());
}
