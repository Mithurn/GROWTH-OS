import { Resend } from 'resend';
import type { ChannelProvider } from './base';
import type { SendRequest } from '../types';
import { resolveProviderEnv, type ProviderCredentials } from './credentials';

export class ResendProvider implements ChannelProvider {
  private client: Resend;
  private fromEmail: string;

  constructor(credentials?: ProviderCredentials) {
    const env = resolveProviderEnv(credentials);
    if (!env.resendApiKey) throw new Error('Resend API key is required');
    this.client = new Resend(env.resendApiKey);
    this.fromEmail = env.resendFromEmail;
  }

  async send(request: SendRequest): Promise<string> {
    const { data, error } = await this.client.emails.send(
      {
        from: this.fromEmail,
        to: request.recipient,
        subject: 'A message for you',
        text: request.content,
      },
      { idempotencyKey: request.communicationId },
    );

    if (error || !data) {
      throw new Error(`Resend error: ${error?.message ?? 'unknown'}`);
    }

    console.log(`[Resend] ✓ Sent ${data.id} → ${request.recipient}`);
    return data.id;
  }
}
