import type { QueuedMessage, SendRequest, CommunicationStatus } from './types';
import { SequenceNumbers } from './types';
import { getProvider } from './providers';

// providerMessageId → message entry
// Real providers (Resend, Twilio) use this to look up communicationId when
// a delivery webhook arrives from the external service.
export const messageRegistry = new Map<string, QueuedMessage>();

export async function queueMessage(request: SendRequest): Promise<string> {
  const provider = getProvider(request.channel);
  const providerMessageId = await provider.send(request);

  messageRegistry.set(providerMessageId, {
    communicationId: request.communicationId,
    providerMessageId,
    channel:   request.channel,
    recipient: request.recipient,
    content:   request.content,
    status:    'QUEUED',
    sequenceNumber: SequenceNumbers.QUEUED,
    createdAt:    new Date(),
    lastUpdatedAt: new Date(),
  });

  return providerMessageId;
}

export function updateRegistryStatus(providerMessageId: string, status: CommunicationStatus): void {
  const msg = messageRegistry.get(providerMessageId);
  if (!msg) return;
  msg.status = status;
  msg.sequenceNumber = SequenceNumbers[status];
  msg.lastUpdatedAt = new Date();
}

export function getMessageStatus(providerMessageId: string): QueuedMessage | undefined {
  return messageRegistry.get(providerMessageId);
}

export function getAllMessages(): QueuedMessage[] {
  return Array.from(messageRegistry.values());
}
