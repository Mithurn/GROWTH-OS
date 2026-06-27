import type { Channel } from '../types';
import type { ChannelProvider } from './base';
import { SimulatorProvider } from './simulator';
import { ResendProvider } from './resend';
import { TwilioSmsProvider, TwilioWhatsAppProvider } from './twilio';

const simulator = new SimulatorProvider();

export function getProvider(channel: Channel): ChannelProvider {
  switch (channel) {
    case 'Email':
      return process.env.RESEND_API_KEY ? new ResendProvider() : simulator;

    case 'SMS':
      return process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER
        ? new TwilioSmsProvider()
        : simulator;

    case 'WhatsApp':
      return process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_NUMBER
        ? new TwilioWhatsAppProvider()
        : simulator;

    default:
      return simulator;
  }
}
