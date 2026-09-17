export interface ProviderCredentials {
  resendApiKey?: string;
  resendFromEmail?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
  twilioWhatsappNumber?: string;
  channelServiceUrl?: string;
}

export function resolveProviderEnv(credentials?: ProviderCredentials) {
  return {
    resendApiKey: credentials?.resendApiKey ?? process.env.RESEND_API_KEY,
    resendFromEmail: credentials?.resendFromEmail ?? process.env.RESEND_FROM_EMAIL ?? 'campaigns@xeno.grow',
    twilioAccountSid: credentials?.twilioAccountSid ?? process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: credentials?.twilioAuthToken ?? process.env.TWILIO_AUTH_TOKEN,
    twilioPhoneNumber: credentials?.twilioPhoneNumber ?? process.env.TWILIO_PHONE_NUMBER,
    twilioWhatsappNumber: credentials?.twilioWhatsappNumber ?? process.env.TWILIO_WHATSAPP_NUMBER,
    channelServiceUrl: credentials?.channelServiceUrl ?? process.env.CHANNEL_SERVICE_URL,
  };
}
