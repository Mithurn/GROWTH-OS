export type Channel = 'WhatsApp' | 'Email' | 'SMS';

export type CommunicationStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'CLICKED' | 'FAILED';

export interface SendRequest {
  communicationId: string;
  recipient: string;
  channel: Channel;
  content: string;
}

export interface QueuedMessage {
  communicationId: string;
  providerMessageId: string;
  recipient: string;
  channel: Channel;
  content: string;
  status: CommunicationStatus;
  sequenceNumber: number;
  createdAt: Date;
  lastUpdatedAt: Date;
}

export interface WebhookEvent {
  eventId: string;
  providerMessageId: string;
  communicationId: string;
  status: CommunicationStatus;
  timestamp: string;
  sequenceNumber: number;
}

export const SequenceNumbers: Record<CommunicationStatus, number> = {
  QUEUED: 1,
  SENT: 2,
  DELIVERED: 3,
  READ: 4,
  CLICKED: 5,
  FAILED: 3,
};
