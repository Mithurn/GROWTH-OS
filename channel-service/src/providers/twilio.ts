import twilio from 'twilio';
import type { ChannelProvider } from './base';
import type { SendRequest } from '../types';

export class TwilioSmsProvider implements ChannelProvider {
  private client: ReturnType<typeof twilio>;
  private from: string;
  private statusCallback: string;

  constructor() {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required');
    }
    if (!process.env.TWILIO_PHONE_NUMBER) throw new Error('TWILIO_PHONE_NUMBER is required');
    if (!process.env.CHANNEL_SERVICE_URL) throw new Error('CHANNEL_SERVICE_URL is required');
    this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    this.from = process.env.TWILIO_PHONE_NUMBER;
    this.statusCallback = `${process.env.CHANNEL_SERVICE_URL}/webhooks/twilio`;
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

  constructor() {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required');
    }
    if (!process.env.TWILIO_WHATSAPP_NUMBER) throw new Error('TWILIO_WHATSAPP_NUMBER is required');
    if (!process.env.CHANNEL_SERVICE_URL) throw new Error('CHANNEL_SERVICE_URL is required');
    this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    this.from = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;
    this.statusCallback = `${process.env.CHANNEL_SERVICE_URL}/webhooks/twilio`;
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
