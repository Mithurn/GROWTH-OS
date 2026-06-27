import { Resend } from 'resend';
import type { ChannelProvider } from './base';
import type { SendRequest } from '../types';

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'campaigns@xeno.grow';

export class ResendProvider implements ChannelProvider {
  private client: Resend;

  constructor() {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is required');
    this.client = new Resend(process.env.RESEND_API_KEY);
  }

  async send(request: SendRequest): Promise<string> {
    const { data, error } = await this.client.emails.send({
      from: FROM_EMAIL,
      to:   request.recipient,
      subject: 'A message for you',
      text: request.content,
    });

    if (error || !data) {
      throw new Error(`Resend error: ${error?.message ?? 'unknown'}`);
    }

    console.log(`[Resend] ✓ Sent ${data.id} → ${request.recipient}`);
    return data.id;
  }
}
