export function launchPolicyReason(input: {
  channel: string;
  timezone: string;
  customers: Array<{ email: string | null; phone: string | null; emailMarketingConsent: boolean; smsMarketingConsent: boolean }>;
  allowedChannels: unknown;
  quietHours: { startHour: number; endHour: number };
  potentialRevenue: number;
  maxBudget: unknown;
  now?: Date;
}): string | null {
  if (!['Email', 'WhatsApp', 'SMS'].includes(input.channel)) return 'Unsupported channel';
  if (Array.isArray(input.allowedChannels) && !input.allowedChannels.map(String).some((channel) => channel.toLowerCase() === input.channel.toLowerCase())) {
    return `Channel ${input.channel} is not allowed by the campaign policy`;
  }
  if (typeof input.maxBudget === 'number' && input.potentialRevenue > input.maxBudget) {
    return 'Campaign exceeds the agent budget guardrail';
  }
  if (!input.customers.length) return 'No customers found in opportunity audience';
  let hour: number;
  try {
    hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: input.timezone }).format(input.now));
  } catch {
    return 'Campaign timezone is invalid';
  }
  const { startHour, endHour } = input.quietHours;
  const quiet = startHour > endHour
    ? hour >= startHour || hour < endHour
    : hour >= startHour && hour < endHour;
  if (quiet) return 'Campaign launch is blocked during quiet hours';
  const allowed = input.channel === 'Email'
    ? (customer: (typeof input.customers)[number]) => customer.email && customer.emailMarketingConsent
    : (customer: (typeof input.customers)[number]) => customer.phone && customer.smsMarketingConsent;
  return input.customers.every(allowed) ? null : 'Audience contains a customer without channel consent or contact details';
}
