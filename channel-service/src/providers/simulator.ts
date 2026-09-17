import { v4 as uuidv4 } from 'uuid';
import type { ChannelProvider } from './base';
import type { SendRequest, CommunicationStatus } from '../types';
import { SequenceNumbers } from '../types';
import { sendWebhook } from '../webhook';
import { captureTraceCarrier, withTraceCarrier } from '../tracing';

const QUEUED_TO_SENT_DELAY    = parseInt(process.env.QUEUED_TO_SENT_DELAY    || '2000');
const SENT_TO_DELIVERED_DELAY = parseInt(process.env.SENT_TO_DELIVERED_DELAY || '3000');
const DELIVERED_TO_READ_DELAY = parseInt(process.env.DELIVERED_TO_READ_DELAY || '4000');
const READ_TO_CLICKED_DELAY   = parseInt(process.env.READ_TO_CLICKED_DELAY   || '5000');
const FAILURE_RATE            = parseInt(process.env.FAILURE_RATE            || '10');

function makeProviderMessageId(channel: string): string {
  const ts  = Date.now();
  const rnd = Math.random().toString(36).substring(2, 8);
  switch (channel) {
    case 'WhatsApp': return `wa_msg_${ts}_${rnd}`;
    case 'Email':    return `email_msg_${ts}_${rnd}`;
    case 'SMS':      return `sms_msg_${ts}_${rnd}`;
    default:         return `msg_${ts}_${rnd}`;
  }
}

async function fire(
  communicationId: string,
  providerMessageId: string,
  status: CommunicationStatus,
  delay: number,
  carrier: Record<string, string>,
): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, delay));
  console.log(`[Simulator] ${providerMessageId} → ${status}`);
  await withTraceCarrier(carrier, () =>
    sendWebhook({
      eventId: uuidv4(),
      providerMessageId,
      communicationId,
      status,
      timestamp: new Date().toISOString(),
      sequenceNumber: SequenceNumbers[status],
    }),
  );
}

async function runProgression(
  communicationId: string,
  providerMessageId: string,
  carrier: Record<string, string>,
): Promise<void> {
  try {
    await fire(communicationId, providerMessageId, 'SENT', QUEUED_TO_SENT_DELAY, carrier);

    if (Math.random() * 100 < FAILURE_RATE) {
      await fire(communicationId, providerMessageId, 'FAILED', SENT_TO_DELIVERED_DELAY, carrier);
      return;
    }

    await fire(communicationId, providerMessageId, 'DELIVERED', SENT_TO_DELIVERED_DELAY, carrier);

    if (Math.random() < 0.6) {
      await fire(communicationId, providerMessageId, 'READ', DELIVERED_TO_READ_DELAY, carrier);

      if (Math.random() < 0.2) {
        await fire(communicationId, providerMessageId, 'CLICKED', READ_TO_CLICKED_DELAY, carrier);
      }
    }
  } catch (err) {
    console.error(`[Simulator] Error in progression for ${providerMessageId}:`, err);
  }
}

export class SimulatorProvider implements ChannelProvider {
  async send(request: SendRequest): Promise<string> {
    const providerMessageId = makeProviderMessageId(request.channel);
    const carrier = captureTraceCarrier();
    console.log(`[Simulator] ✓ Queued ${providerMessageId} → ${request.recipient} via ${request.channel}`);
    runProgression(request.communicationId, providerMessageId, carrier).catch((err) => {
      console.error('[Simulator] Unhandled error:', err);
    });
    return providerMessageId;
  }
}
