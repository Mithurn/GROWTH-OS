import crypto from 'crypto';
import Razorpay from 'razorpay';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export type Plan = 'free' | 'pro';

function getClient(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured.');
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export interface BillingStatus {
  plan: Plan;
  subscriptionStatus: string | null;
  configured: boolean;
}

export async function getBillingStatus(companyId: string): Promise<BillingStatus> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { plan: true, subscriptionStatus: true },
  });
  return {
    plan: (company?.plan as Plan) ?? 'free',
    subscriptionStatus: company?.subscriptionStatus ?? null,
    configured: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_PLAN_ID),
  };
}

/** Only what launchCampaign needs: is this tenant funded to use the platform's own send keys? */
export async function isPaidAndActive(companyId: string): Promise<boolean> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { plan: true, subscriptionStatus: true },
  });
  return company?.plan === 'pro' && company?.subscriptionStatus === 'active';
}

/**
 * Creates (or reuses) a Razorpay customer for this company, then creates a
 * subscription against RAZORPAY_PLAN_ID. The frontend opens Razorpay Checkout
 * with the returned subscription id; activation lands via the webhook, not
 * this response, since the actual charge happens asynchronously in Checkout.
 */
export async function createCheckoutSubscription(
  companyId: string,
  email: string,
): Promise<{ subscriptionId: string; keyId: string }> {
  const planId = process.env.RAZORPAY_PLAN_ID;
  if (!planId) throw new Error('RAZORPAY_PLAN_ID is not configured.');
  const razorpay = getClient();

  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });

  let customerId = company.razorpayCustomerId ?? undefined;
  if (!customerId) {
    const customer = await razorpay.customers.create({
      name: company.companyName,
      email,
      fail_existing: 0,
    } as never);
    customerId = customer.id;
    await prisma.company.update({ where: { id: companyId }, data: { razorpayCustomerId: customerId } });
  }

  const subscription = await razorpay.subscriptions.create({
    plan_id: planId,
    customer_notify: 1,
    total_count: 120, // 10 years of monthly cycles — Razorpay requires a count, not "forever"
    notes: { companyId },
  } as never);

  await prisma.company.update({
    where: { id: companyId },
    data: { razorpaySubscriptionId: subscription.id, subscriptionStatus: subscription.status },
  });

  return { subscriptionId: subscription.id, keyId: process.env.RAZORPAY_KEY_ID! };
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured.');
  if (typeof signature !== 'string' || signature.length === 0) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = Buffer.from(signature, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');

  if (provided.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(provided, expectedBuf);
}

interface RazorpaySubscriptionEvent {
  event: string;
  payload?: {
    subscription?: {
      entity: {
        id: string;
        status: string;
        notes?: { companyId?: string };
      };
    };
  };
}

/**
 * Subscription status drives the plan directly — "pro" only while Razorpay
 * itself says the subscription is active. A halted or cancelled subscription
 * drops the tenant straight back to "free" (simulator), not a grace period.
 */
export async function processWebhookEvent(body: RazorpaySubscriptionEvent): Promise<void> {
  const entity = body.payload?.subscription?.entity;
  if (!entity) {
    logger.warn({ event: body.event }, 'Razorpay webhook: no subscription entity, ignoring');
    return;
  }

  const companyId = entity.notes?.companyId;
  const company = companyId
    ? await prisma.company.findUnique({ where: { id: companyId } })
    : await prisma.company.findFirst({ where: { razorpaySubscriptionId: entity.id } });

  if (!company) {
    logger.warn({ subscriptionId: entity.id }, 'Razorpay webhook: no matching company');
    return;
  }

  const plan: Plan = entity.status === 'active' ? 'pro' : 'free';

  await prisma.company.update({
    where: { id: company.id },
    data: {
      plan,
      subscriptionStatus: entity.status,
      razorpaySubscriptionId: entity.id,
      planUpdatedAt: new Date(),
    },
  });

  logger.info({ companyId: company.id, event: body.event, status: entity.status, plan }, 'Razorpay subscription updated');
}
