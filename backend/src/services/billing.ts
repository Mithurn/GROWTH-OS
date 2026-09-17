import Stripe from 'stripe';
import { Prisma } from '../../generated/prisma';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

const UNIQUE_VIOLATION = 'P2002';

export type Plan = 'free' | 'pro';

function getClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured.');
  return new Stripe(key);
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
    configured: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID),
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
 * Stripe Checkout is a hosted page — the backend only needs to create the
 * session and hand back its URL, the frontend just navigates there. No
 * client-side Stripe.js or publishable key needed for this flow.
 */
export async function createCheckoutSession(
  companyId: string,
  email: string,
  returnUrl: string,
): Promise<{ url: string }> {
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) throw new Error('STRIPE_PRICE_ID is not configured.');
  const stripe = getClient();

  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });

  let customerId = company.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: company.companyName,
      email: email || undefined,
      metadata: { companyId },
    });
    customerId = customer.id;
    await prisma.company.update({ where: { id: companyId }, data: { stripeCustomerId: customerId } });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${returnUrl}?billing=success`,
    cancel_url: `${returnUrl}?billing=cancelled`,
    subscription_data: { metadata: { companyId } },
  });

  if (!session.url) throw new Error('Stripe did not return a checkout URL.');
  return { url: session.url };
}

/**
 * Subscription status drives the plan directly — "pro" only while Stripe
 * itself says the subscription is active. A past-due or cancelled
 * subscription drops the tenant straight back to "free" (simulator), not a
 * grace period.
 *
 * Idempotency and ordering both matter here, not just at-least-once delivery:
 * Stripe retries on anything but a 200, and does not guarantee delivery order.
 * `processed_webhook_events.event_id` (shared with the channel-delivery
 * webhook path in services/webhooks.ts) makes a replayed event a no-op; the
 * `company.lastStripeEventAt` check makes a late, stale event — one that
 * arrives after a newer one already applied — a no-op too, so a delayed
 * cancellation event can't un-cancel a subscription Stripe already reinstated.
 */
export async function processWebhookEvent(event: Stripe.Event): Promise<void> {
  if (event.type !== 'customer.subscription.created' &&
      event.type !== 'customer.subscription.updated' &&
      event.type !== 'customer.subscription.deleted') {
    return;
  }

  const subscription = event.data.object as Stripe.Subscription;
  const companyId = subscription.metadata?.companyId;
  const eventCreatedAt = new Date(event.created * 1000);

  const company = companyId
    ? await prisma.company.findUnique({ where: { id: companyId } })
    : await prisma.company.findFirst({ where: { stripeSubscriptionId: subscription.id } });

  if (!company) {
    logger.warn({ subscriptionId: subscription.id }, 'Stripe webhook: no matching company');
    return;
  }

  if (company.lastStripeEventAt && company.lastStripeEventAt >= eventCreatedAt) {
    logger.info(
      { companyId: company.id, event: event.type, eventCreatedAt },
      'Stripe webhook: stale/out-of-order event, already have a newer one applied',
    );
    return;
  }

  const plan: Plan = subscription.status === 'active' ? 'pro' : 'free';

  try {
    await prisma.$transaction([
      // First, so a duplicate delivery aborts the whole transaction before
      // anything is applied — matches the dedup pattern in services/webhooks.ts.
      prisma.processedWebhookEvent.create({
        data: { eventId: event.id, communicationId: null },
      }),
      prisma.company.update({
        where: { id: company.id },
        data: {
          plan,
          subscriptionStatus: subscription.status,
          stripeSubscriptionId: subscription.id,
          planUpdatedAt: new Date(),
          lastStripeEventAt: eventCreatedAt,
        },
      }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === UNIQUE_VIOLATION) {
      logger.info({ eventId: event.id }, 'Stripe webhook: duplicate delivery, already processed');
      return;
    }
    throw err;
  }

  logger.info(
    { companyId: company.id, event: event.type, status: subscription.status, plan },
    'Stripe subscription updated',
  );
}

export function constructWebhookEvent(rawBody: Buffer, signature: string | undefined): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured.');
  if (!signature) throw new Error('Missing Stripe-Signature header.');
  return getClient().webhooks.constructEvent(rawBody, signature, secret);
}
