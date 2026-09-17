import { createRemoteJWKSet, jwtVerify, decodeProtectedHeader } from 'jose';
import type { JWTPayload } from 'jose';

/**
 * Local verification of a Supabase Auth access token — replaces
 * `supabase.auth.getUser(token)` (a network round-trip to Supabase on every
 * single request) with a signature check against a key cached in-process.
 * See docs/V3_PLAN.md Phase 2.
 *
 * Supabase projects sign access tokens one of two ways, and this project's
 * choice isn't observable from the code alone, so both are supported,
 * selected per-token from its own header rather than a fixed assumption:
 *
 * - Newer projects (asymmetric signing keys enabled): ES256/RS256, verified
 *   against Supabase's own JWKS endpoint, fetched once and cached.
 * - Legacy projects (the default until Supabase's 2024 signing-keys feature):
 *   HS256, verified against the project's JWT secret
 *   (Project Settings -> API -> JWT Secret), a symmetric key with no JWKS
 *   endpoint to fetch from — this is very likely what an older project like
 *   this one is still on.
 *
 * `SUPABASE_JWT_SECRET` must be set for the HS256 path. If unset and a token
 * turns out to need it, verification fails loudly (not silently open) so the
 * gap is obvious in the logs rather than discovered as a security hole.
 */

function supabaseJwksUrl(): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured.');
  return `${base.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!jwks) jwks = createRemoteJWKSet(new URL(supabaseJwksUrl()));
  return jwks;
}

let hmacKey: Uint8Array | null = null;
function getHmacKey(): Uint8Array {
  if (hmacKey) return hmacKey;
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error(
      'Token is HS256-signed but SUPABASE_JWT_SECRET is not configured — cannot verify locally.',
    );
  }
  hmacKey = new TextEncoder().encode(secret);
  return hmacKey;
}

export interface VerifiedUser {
  id: string;
  email?: string;
}

/**
 * Verifies signature, expiry, and audience. Returns the user id (and email
 * if present), or null on any failure. Callers treat null as a 401.
 */
export async function verifySupabaseToken(token: string): Promise<VerifiedUser | null> {
  try {
    const { alg } = decodeProtectedHeader(token);
    // Supabase issues Auth tokens with this fixed audience; verifying it isn't
    // just a signature check away from accepting a token minted for a
    // different Supabase product (e.g. Storage) on the same project.
    const options = { audience: 'authenticated' };

    let payload: JWTPayload;
    if (alg === 'HS256') {
      ({ payload } = await jwtVerify(token, getHmacKey(), options));
    } else {
      ({ payload } = await jwtVerify(token, getJwks(), options));
    }

    if (!payload.sub) return null;
    return { id: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined };
  } catch {
    return null;
  }
}
