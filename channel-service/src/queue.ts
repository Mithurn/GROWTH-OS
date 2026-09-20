import type { QueuedMessage, SendRequest, CommunicationStatus } from './types';
import { SequenceNumbers } from './types';
import { getProvider } from './providers';
import { captureTraceCarrier } from './tracing';

// providerMessageId → message entry
// Real providers (Resend, Twilio) use this to look up communicationId when
// a delivery webhook arrives from the external service.
export const messageRegistry = new Map<string, QueuedMessage>();
const providerByCommunication = new Map<string, string>();
const pendingByCommunication = new Map<string, Promise<string>>();

export async function queueMessage(request: SendRequest): Promise<string> {
  const existing = providerByCommunication.get(request.communicationId);
  if (existing) return existing;
  const pending = pendingByCommunication.get(request.communicationId);
  if (pending) return pending;

  const operation = (async () => {
    const provider = getProvider(request.channel, request.credentials);
    const providerMessageId = await provider.send(request);
    providerByCommunication.set(request.communicationId, providerMessageId);
    messageRegistry.set(providerMessageId, {
      communicationId: request.communicationId,
      providerMessageId,
      channel: request.channel,
      recipient: request.recipient,
      content: request.content,
      status: 'QUEUED',
      sequenceNumber: SequenceNumbers.QUEUED,
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      traceCarrier: captureTraceCarrier(),
    });
    return providerMessageId;
  })();
  pendingByCommunication.set(request.communicationId, operation);
  try {
    return await operation;
  } finally {
    pendingByCommunication.delete(request.communicationId);
  }
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
