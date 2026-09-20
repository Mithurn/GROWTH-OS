import { prisma } from '../lib/prisma';

const FRAUD_TERMS = /\b(password|otp|one[- ]time password|bank account|wire transfer|gift card|crypto(?:currency)?)\b/i;

export function campaignRiskReasons(message: string): string[] {
  const reasons: string[] = [];
  if (FRAUD_TERMS.test(message)) reasons.push('Message contains a credential, payment, or gift-card fraud term');
  for (const match of message.matchAll(/\b(\d{1,3})\s*%/g)) {
    if (Number(match[1]) > 50) reasons.push('Message offers a discount above the 50% safety threshold');
  }
  return reasons;
}

export async function reviewCampaignRisk(input: {
  companyId: string;
  campaignId: string;
  message: string;
}): Promise<{ verdict: 'ALLOW' | 'BLOCK'; reasons: string[] }> {
  const reasons = campaignRiskReasons(input.message);
  const verdict = reasons.length ? 'BLOCK' : 'ALLOW';
  await prisma.$transaction([
    prisma.campaignRiskReview.upsert({
      where: { campaignId: input.campaignId },
      create: { companyId: input.companyId, campaignId: input.campaignId, verdict, reasons },
      update: { verdict, reasons, reviewedAt: new Date() },
    }),
    prisma.campaignAuditEvent.create({
      data: { companyId: input.companyId, campaignId: input.campaignId, eventType: 'RISK_REVIEWED', metadata: { verdict, reasons } },
    }),
  ]);
  return { verdict, reasons };
}
