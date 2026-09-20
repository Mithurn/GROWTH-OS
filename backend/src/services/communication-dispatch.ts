import { prisma } from '../lib/prisma';
import { checkAndIncrFrequencyCap } from '../lib/redis';
import { injectTraceHeaders } from '../lib/trace-context';
import { getVerifiedCredentials, type IntegrationKind } from './integrations';
import { isPaidAndActive } from './billing';

type Channel = 'WhatsApp' | 'Email' | 'SMS';

async function resolveSendCredentials(
  companyId: string,
  channel: Channel,
): Promise<Record<string, string> | undefined> {
  const kind: IntegrationKind = channel === 'Email' ? 'email' : 'whatsapp';
  const byok = await getVerifiedCredentials(companyId, kind);
  if (byok) {
    return kind === 'email'
      ? { resendApiKey: byok.apiKey, resendFromEmail: byok.fromEmail ?? '' }
      : {
          twilioAccountSid: byok.accountSid,
          twilioAuthToken: byok.authToken,
          twilioPhoneNumber: byok.whatsappNumber,
          twilioWhatsappNumber: byok.whatsappNumber,
        };
  }

  if (!(await isPaidAndActive(companyId))) return undefined;
  if (kind === 'email' && process.env.PLATFORM_RESEND_API_KEY) {
    return {
      resendApiKey: process.env.PLATFORM_RESEND_API_KEY,
      resendFromEmail: process.env.PLATFORM_RESEND_FROM_EMAIL ?? '',
    };
  }
  if (
    kind === 'whatsapp' &&
    process.env.PLATFORM_TWILIO_ACCOUNT_SID &&
    process.env.PLATFORM_TWILIO_AUTH_TOKEN &&
    process.env.PLATFORM_TWILIO_WHATSAPP_NUMBER
  ) {
    return {
      twilioAccountSid: process.env.PLATFORM_TWILIO_ACCOUNT_SID,
      twilioAuthToken: process.env.PLATFORM_TWILIO_AUTH_TOKEN,
      twilioPhoneNumber: process.env.PLATFORM_TWILIO_WHATSAPP_NUMBER,
      twilioWhatsappNumber: process.env.PLATFORM_TWILIO_WHATSAPP_NUMBER,
    };
  }
  return undefined;
}

async function finishCampaignIfDispatched(campaignId: string, companyId: string): Promise<void> {
  const [pending, total, failed] = await Promise.all([
    prisma.communication.count({
      where: { campaign: { id: campaignId, companyId }, status: 'QUEUED', providerMessageId: null },
    }),
    prisma.communication.count({ where: { campaign: { id: campaignId, companyId } } }),
    prisma.communication.count({ where: { campaign: { id: campaignId, companyId }, status: 'FAILED' } }),
  ]);
  if (pending > 0 || total === 0) return;
  await prisma.campaign.updateMany({
    where: { id: campaignId, companyId, status: 'Dispatching' },
    data: { status: failed === total ? 'Failed' : 'Launched', launchedAt: new Date() },
  });
}

async function failCommunication(
  communicationId: string,
  campaignId: string,
  companyId: string,
  reason: string,
): Promise<void> {
  await prisma.$transaction([
    prisma.communication.update({
      where: { id: communicationId },
      data: { status: 'FAILED', failureReason: reason, failedAt: new Date() },
    }),
    prisma.communicationEvent.create({
      data: { communicationId, eventType: 'FAILED', sequenceNumber: 3, errorMessage: reason },
    }),
  ]);
  await finishCampaignIfDispatched(campaignId, companyId);
}

export async function dispatchCommunication(communicationId: string): Promise<void> {
  const communication = await prisma.communication.findUnique({
    where: { id: communicationId },
    include: {
      customer: { select: { email: true, phone: true } },
      campaign: { select: { id: true, companyId: true } },
    },
  });
  if (!communication) return;
  if (communication.status !== 'QUEUED' || communication.providerMessageId) {
    await finishCampaignIfDispatched(communication.campaignId, communication.campaign.companyId);
    return;
  }

  const channel = communication.channel as Channel;
  if (!['WhatsApp', 'Email', 'SMS'].includes(channel)) {
    await failCommunication(communication.id, communication.campaignId, communication.campaign.companyId, `Unsupported channel: ${communication.channel}`);
    return;
  }
  const recipient = channel === 'Email' ? communication.customer.email : communication.customer.phone;
  if (!recipient) {
    await failCommunication(communication.id, communication.campaignId, communication.campaign.companyId, 'Recipient contact is missing');
    return;
  }
  if (await checkAndIncrFrequencyCap(communication.customerId, communication.id)) {
    await failCommunication(communication.id, communication.campaignId, communication.campaign.companyId, 'Suppressed: frequency cap exceeded (2 messages/day)');
    return;
  }

  const credentials = await resolveSendCredentials(communication.campaign.companyId, channel);
  const baseUrl = process.env.CHANNEL_SERVICE_URL || 'http://localhost:5001';
  const response = await fetch(`${baseUrl}/send`, {
    method: 'POST',
    headers: injectTraceHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      communicationId: communication.id,
      recipient,
      channel,
      content: communication.message,
      credentials,
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!response.ok) throw new Error(`Channel service responded with ${response.status}`);
  const result = await response.json() as { providerMessageId?: string };
  if (!result.providerMessageId) throw new Error('Channel service omitted providerMessageId');

  await prisma.communication.update({
    where: { id: communication.id },
    data: { providerMessageId: result.providerMessageId },
  });
  await finishCampaignIfDispatched(communication.campaignId, communication.campaign.companyId);
}

export async function markCommunicationDispatchFailed(
  communicationId: string,
  reason: string,
): Promise<void> {
  const communication = await prisma.communication.findUnique({
    where: { id: communicationId },
    select: { id: true, campaignId: true, campaign: { select: { companyId: true } } },
  });
  if (!communication) return;
  await failCommunication(
    communication.id,
    communication.campaignId,
    communication.campaign.companyId,
    `Channel service error after retries: ${reason}`,
  );
}
