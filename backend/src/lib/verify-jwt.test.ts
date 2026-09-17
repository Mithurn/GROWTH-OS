import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SignJWT } from 'jose';
import { verifySupabaseToken } from './verify-jwt';

/**
 * Exercises the HS256 path with real signatures — this is the path a
 * project on Supabase's legacy JWT secret (the default until the 2024
 * asymmetric-signing-keys feature) actually uses. The JWKS/asymmetric path
 * is exercised indirectly (in production, against Supabase's real endpoint)
 * rather than here, since testing it would mean mocking network fetch for a
 * key-rotation flow `jose`'s `createRemoteJWKSet` already owns.
 */
describe('verifySupabaseToken — HS256 (legacy Supabase JWT secret)', () => {
  const secret = 'test-supabase-jwt-secret-at-least-32-bytes-long';
  const key = new TextEncoder().encode(secret);

  beforeEach(() => {
    process.env.SUPABASE_JWT_SECRET = secret;
  });

  afterEach(() => {
    delete process.env.SUPABASE_JWT_SECRET;
  });

  async function sign(claims: Record<string, unknown>, opts?: { expired?: boolean }) {
    return new SignJWT({ email: 'user@example.com', ...claims })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject((claims.sub as string) ?? 'user_1')
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime(opts?.expired ? '-1h' : '1h')
      .sign(key);
  }

  // Runs first, deliberately, before any other test in this block primes the
  // module-level HMAC key cache (lib/verify-jwt.ts's `hmacKey`) with a valid
  // secret — this test would otherwise pass on a stale cached key instead of
  // the current (unset) env var.
  it('fails closed when SUPABASE_JWT_SECRET is unset for an HS256 token', async () => {
    delete process.env.SUPABASE_JWT_SECRET;
    const token = await sign({ sub: 'user_1' });
    expect(await verifySupabaseToken(token)).toBeNull();
  });

  it('accepts a validly signed, unexpired token and returns the user id/email', async () => {
    const token = await sign({ sub: 'user_abc' });
    const user = await verifySupabaseToken(token);
    expect(user).toEqual({ id: 'user_abc', email: 'user@example.com' });
  });

  it('rejects a token signed with the wrong secret', async () => {
    const wrongKey = new TextEncoder().encode('a-completely-different-secret-value');
    const token = await new SignJWT({ email: 'x@example.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user_1')
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .sign(wrongKey);

    expect(await verifySupabaseToken(token)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const token = await sign({ sub: 'user_1' }, { expired: true });
    expect(await verifySupabaseToken(token)).toBeNull();
  });

  it('rejects a token with the wrong audience', async () => {
    const token = await new SignJWT({ email: 'x@example.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user_1')
      .setAudience('storage') // not "authenticated"
      .setExpirationTime('1h')
      .sign(key);

    expect(await verifySupabaseToken(token)).toBeNull();
  });

  it('rejects a malformed token outright, not by throwing', async () => {
    expect(await verifySupabaseToken('not-a-jwt')).toBeNull();
  });
});
