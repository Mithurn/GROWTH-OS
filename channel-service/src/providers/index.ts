import type { Channel } from '../types';
import type { ChannelProvider } from './base';
import { SimulatorProvider } from './simulator';
import { ResendProvider } from './resend';
import { TwilioSmsProvider, TwilioWhatsAppProvider } from './twilio';
import { resolveProviderEnv, type ProviderCredentials } from './credentials';

const simulator = new SimulatorProvider();

/**
 * Provider is chosen from the per-request credentials first, then process.env,
 * then the simulator. Simulator stays the default so a tenant with no keys
 * still exercises the FSM.
 */
export function getProvider(channel: Channel, credentials?: ProviderCredentials): ChannelProvider {
  const env = resolveProviderEnv(credentials);

  switch (channel) {
    case 'Email':
      return env.resendApiKey ? new ResendProvider(credentials) : simulator;

    case 'SMS':
      return env.twilioAccountSid && env.twilioAuthToken && env.twilioPhoneNumber
        ? new TwilioSmsProvider(credentials)
        : simulator;

    case 'WhatsApp':
      return env.twilioAccountSid && env.twilioAuthToken && env.twilioWhatsappNumber
        ? new TwilioWhatsAppProvider(credentials)
        : simulator;

    default:
      return simulator;
  }
}
