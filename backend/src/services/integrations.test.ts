import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../lib/prisma';
import { getVerifiedCredentials, upsertIntegration } from './integrations';

describe('upsertIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTEGRATION_MASTER_KEY = 'a'.repeat(64);
  });

  it('falls back to simulator when a Twilio field is missing', async () => {
    vi.mocked(prisma.integration.upsert).mockResolvedValue({
      provider: 'twilio',
      mode: 'simulator',
      ciphertext: null,
      status: 'simulator',
      lastVerifiedAt: null,
    } as never);

    const result = await upsertIntegration('co_1', 'whatsapp', {
      mode: 'byok',
      credentials: { accountSid: 'AC123', authToken: 'secret' }, // missing whatsappNumber
    });

    expect(result.mode).toBe('simulator');
    expect(prisma.integration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ mode: 'simulator', ciphertext: undefined }),
      }),
    );
  });

  it('stores byok mode once every required Twilio field is present', async () => {
    vi.mocked(prisma.integration.upsert).mockResolvedValue({
      provider: 'twilio',
      mode: 'byok',
      ciphertext: 'sealed',
      status: 'unverified',
      lastVerifiedAt: null,
    } as never);

    const result = await upsertIntegration('co_1', 'whatsapp', {
      mode: 'byok',
      credentials: { accountSid: 'AC123', authToken: 'secret', whatsappNumber: '+14155238886' },
    });

    expect(result.mode).toBe('byok');
    expect(prisma.integration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ mode: 'byok', ciphertext: expect.any(String) }),
      }),
    );
  });
});

describe('getVerifiedCredentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTEGRATION_MASTER_KEY = 'a'.repeat(64);
  });

  it('returns null for an unverified integration', async () => {
    vi.mocked(prisma.integration.findFirst).mockResolvedValue({
      mode: 'byok',
      status: 'unverified',
      ciphertext: 'x',
      iv: 'x',
      authTag: 'x',
      keyVersion: 1,
    } as never);

    expect(await getVerifiedCredentials('co_1', 'email')).toBeNull();
  });

  it('returns null when there is no integration row at all', async () => {
    vi.mocked(prisma.integration.findFirst).mockResolvedValue(null);
    expect(await getVerifiedCredentials('co_1', 'email')).toBeNull();
  });
});
