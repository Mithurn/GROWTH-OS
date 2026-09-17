import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Stripe from 'stripe';
import { prisma } from '../lib/prisma';
import { processWebhookEvent } from './billing';

function subscriptionEvent(
  type: Stripe.Event['type'],
  overrides: Partial<Stripe.Subscription> = {},
): Stripe.Event {
  return {
    type,
    data: {
      object: {
        id: 'sub_1',
        status: 'active',
        metadata: { companyId: 'co_1' },
        ...overrides,
      } as Stripe.Subscription,
    },
  } as Stripe.Event;
}

describe('processWebhookEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('promotes a company to pro when the subscription is active', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue({ id: 'co_1' } as never);
    vi.mocked(prisma.company.update).mockResolvedValue({} as never);

    await processWebhookEvent(subscriptionEvent('customer.subscription.updated', { status: 'active' }));

    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'co_1' },
        data: expect.objectContaining({ plan: 'pro', subscriptionStatus: 'active' }),
      }),
    );
  });

  it('drops a company back to free when the subscription is past_due', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue({ id: 'co_1' } as never);
    vi.mocked(prisma.company.update).mockResolvedValue({} as never);

    await processWebhookEvent(subscriptionEvent('customer.subscription.updated', { status: 'past_due' }));

    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ plan: 'free', subscriptionStatus: 'past_due' }) }),
    );
  });

  it('drops a company to free when the subscription is deleted', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue({ id: 'co_1' } as never);
    vi.mocked(prisma.company.update).mockResolvedValue({} as never);

    await processWebhookEvent(subscriptionEvent('customer.subscription.deleted', { status: 'canceled' }));

    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ plan: 'free', subscriptionStatus: 'canceled' }) }),
    );
  });

  it('does nothing when no company matches the subscription', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.company.findFirst).mockResolvedValue(null);

    await processWebhookEvent(
      subscriptionEvent('customer.subscription.updated', { id: 'sub_unknown', metadata: {} }),
    );

    expect(prisma.company.update).not.toHaveBeenCalled();
  });

  it('ignores unrelated event types', async () => {
    await processWebhookEvent({ type: 'invoice.paid', data: { object: {} } } as Stripe.Event);
    expect(prisma.company.update).not.toHaveBeenCalled();
  });
});
