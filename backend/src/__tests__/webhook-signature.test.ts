import crypto from 'crypto';
import { describe, it, expect } from 'vitest';
import { verifySignature } from '../services/webhooks';

// Matches vitest.config.ts env
const SECRET = 'test-webhook-secret';

function sign(payload: string, secret = SECRET): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

describe('verifySignature', () => {
  const payload = JSON.stringify({
    eventId: 'evt_1',
    providerMessageId: 'pm_1',
    communicationId: 'comm_1',
    status: 'DELIVERED',
    timestamp: '2026-01-01T00:00:00.000Z',
    sequenceNumber: 3,
  });

  it('accepts a signature produced with the shared secret', () => {
    expect(verifySignature(payload, sign(payload))).toBe(true);
  });

  it('rejects a signature produced with a different secret', () => {
    expect(verifySignature(payload, sign(payload, 'wrong-secret'))).toBe(false);
  });

  it('rejects a valid signature for a different payload', () => {
    expect(verifySignature(payload, sign('{"tampered":true}'))).toBe(false);
  });

  // Regression: timingSafeEqual throws on a length mismatch, which surfaced a
  // malformed signature as a 500 instead of a 401.
  it('returns false rather than throwing when the signature is too short', () => {
    expect(() => verifySignature(payload, 'abc123')).not.toThrow();
    expect(verifySignature(payload, 'abc123')).toBe(false);
  });

  it('returns false rather than throwing when the signature is too long', () => {
    const tooLong = sign(payload) + 'deadbeef';
    expect(() => verifySignature(payload, tooLong)).not.toThrow();
    expect(verifySignature(payload, tooLong)).toBe(false);
  });

  it('returns false for an empty or missing signature', () => {
    expect(verifySignature(payload, '')).toBe(false);
    expect(verifySignature(payload, undefined as unknown as string)).toBe(false);
  });
});
