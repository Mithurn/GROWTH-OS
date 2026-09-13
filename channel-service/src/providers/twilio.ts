import twilio from 'twilio';
import type { ChannelProvider } from './base';
import type { SendRequest } from '../types';
import { resolveProviderEnv, type ProviderCredentials } from './credentials';

export class TwilioSmsProvider implements ChannelProvider {
  private client: ReturnType<typeof twilio>;
  private from: string;
  private statusCallback: string;

  constructor(credentials?: ProviderCredentials) {
    const env = resolveProviderEnv(credentials);
    if (!env.twilioAccountSid || !env.twilioAuthToken) {
      throw new Error('Twilio account credentials are required');
    }
    if (!env.twilioPhoneNumber) throw new Error('Twilio phone number is required');
    if (!env.channelServiceUrl) throw new Error('CHANNEL_SERVICE_URL is required');
    this.client = twilio(env.twilioAccountSid, env.twilioAuthToken);
    this.from = env.twilioPhoneNumber;
    this.statusCallback = `${env.channelServiceUrl}/webhooks/twilio`;
  }

  async send(request: SendRequest): Promise<string> {
    const msg = await this.client.messages.create({
      body:           request.content,
      from:           this.from,
      to:             request.recipient,
      statusCallback: this.statusCallback,
    });
    console.log(`[Twilio SMS] ✓ Sent ${msg.sid} → ${request.recipient}`);
    return msg.sid;
  }
}

export class TwilioWhatsAppProvider implements ChannelProvider {
  private client: ReturnType<typeof twilio>;
  private from: string;
  private statusCallback: string;

  constructor(credentials?: ProviderCredentials) {
    const env = resolveProviderEnv(credentials);
    if (!env.twilioAccountSid || !env.twilioAuthToken) {
      throw new Error('Twilio account credentials are required');
    }
    if (!env.twilioWhatsappNumber) throw new Error('Twilio WhatsApp number is required');
    if (!env.channelServiceUrl) throw new Error('CHANNEL_SERVICE_URL is required');
    this.client = twilio(env.twilioAccountSid, env.twilioAuthToken);
    this.from = `whatsapp:${env.twilioWhatsappNumber}`;
    this.statusCallback = `${env.channelServiceUrl}/webhooks/twilio`;
  }

  async send(request: SendRequest): Promise<string> {
    const to = request.recipient.startsWith('whatsapp:')
      ? request.recipient
      : `whatsapp:${request.recipient}`;

    const msg = await this.client.messages.create({
      body:           request.content,
      from:           this.from,
      to,
      statusCallback: this.statusCallback,
    });
    console.log(`[Twilio WhatsApp] ✓ Sent ${msg.sid} → ${request.recipient}`);
    return msg.sid;
  }
}
