import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { processWebhookEvent, verifyWebhookSignature } from './billing';

const SECRET = 'test-razorpay-webhook-secret';

function sign(body: string): string {
  return crypto.createHmac('sha256', SECRET).update(body).digest('hex');
}

describe('verifyWebhookSignature', () => {
  beforeEach(() => {
    process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
  });

  it('accepts a correctly signed body', () => {
    const body = Buffer.from(JSON.stringify({ event: 'subscription.activated' }));
    expect(verifyWebhookSignature(body, sign(body.toString()))).toBe(true);
  });

  it('rejects a tampered body', () => {
    const original = Buffer.from(JSON.stringify({ event: 'subscription.activated' }));
    const signature = sign(original.toString());
    const tampered = Buffer.from(JSON.stringify({ event: 'subscription.cancelled' }));
    expect(verifyWebhookSignature(tampered, signature)).toBe(false);
  });

  it('rejects a missing signature without throwing', () => {
    const body = Buffer.from('{}');
    expect(verifyWebhookSignature(body, undefined)).toBe(false);
  });

  it('rejects a wrong-length signature without throwing', () => {
    const body = Buffer.from('{}');
    expect(verifyWebhookSignature(body, 'short')).toBe(false);
  });
});

describe('processWebhookEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('promotes a company to pro when the subscription is active', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue({ id: 'co_1' } as never);
    vi.mocked(prisma.company.update).mockResolvedValue({} as never);

    await processWebhookEvent({
      event: 'subscription.activated',
      payload: {
        subscription: {
          entity: { id: 'sub_1', status: 'active', notes: { companyId: 'co_1' } },
        },
      },
    });

    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'co_1' },
        data: expect.objectContaining({ plan: 'pro', subscriptionStatus: 'active' }),
      }),
    );
  });

  it('drops a company back to free when the subscription is halted', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue({ id: 'co_1' } as never);
    vi.mocked(prisma.company.update).mockResolvedValue({} as never);

    await processWebhookEvent({
      event: 'subscription.halted',
      payload: {
        subscription: {
          entity: { id: 'sub_1', status: 'halted', notes: { companyId: 'co_1' } },
        },
      },
    });

    expect(prisma.company.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ plan: 'free', subscriptionStatus: 'halted' }) }),
    );
  });

  it('does nothing when no company matches the subscription', async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.company.findFirst).mockResolvedValue(null);

    await processWebhookEvent({
      event: 'subscription.activated',
      payload: { subscription: { entity: { id: 'sub_unknown', status: 'active' } } },
    });

    expect(prisma.company.update).not.toHaveBeenCalled();
  });

  it('does not throw on an event with no payload at all', async () => {
    await expect(processWebhookEvent({ event: 'ping' })).resolves.toBeUndefined();
    expect(prisma.company.update).not.toHaveBeenCalled();
  });
});
