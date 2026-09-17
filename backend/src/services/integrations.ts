import { prisma } from '../lib/prisma';
import { decryptSecret, encryptSecret, loadMasterKey, maskSecret } from '../lib/crypto-secret';
import { logger } from '../lib/logger';

export const INTEGRATION_KINDS = ['llm', 'email', 'whatsapp'] as const;
export type IntegrationKind = (typeof INTEGRATION_KINDS)[number];

const DEFAULTS: Record<IntegrationKind, { provider: string; mode: string }> = {
  llm: { provider: 'openrouter', mode: 'simulator' },
  email: { provider: 'resend', mode: 'simulator' },
  whatsapp: { provider: 'twilio', mode: 'simulator' },
};

/**
 * Real sends need more than one secret per provider (Twilio is account SID +
 * auth token + a number), so credentials are stored as one encrypted JSON
 * blob, not a bare string. `maskField` names which field is safe to show a
 * masked tail of in the UI.
 */
const CREDENTIAL_FIELDS: Record<IntegrationKind, { required: string[]; maskField: string }> = {
  llm: { required: ['apiKey'], maskField: 'apiKey' },
  email: { required: ['apiKey'], maskField: 'apiKey' },
  whatsapp: { required: ['accountSid', 'authToken', 'whatsappNumber'], maskField: 'authToken' },
};

export interface PublicIntegration {
  kind: IntegrationKind;
  provider: string;
  mode: string;
  status: string;
  maskedKey: string | null;
  lastVerifiedAt: string | null;
}

function emptyCard(kind: IntegrationKind): PublicIntegration {
  const d = DEFAULTS[kind];
  return {
    kind,
    provider: d.provider,
    mode: d.mode,
    status: 'unconfigured',
    maskedKey: null,
    lastVerifiedAt: null,
  };
}

export async function listIntegrations(companyId: string): Promise<{
  available: boolean;
  data: PublicIntegration[];
}> {
  try {
    const rows = await prisma.integration.findMany({
      where: { companyId },
    });
    const byKind = new Map(rows.map((r) => [r.kind, r]));
    return {
      available: true,
      data: INTEGRATION_KINDS.map((kind) => {
        const row = byKind.get(kind);
        if (!row) return emptyCard(kind);
        return {
          kind,
          provider: row.provider,
          mode: row.mode,
          status: row.status,
          maskedKey: row.ciphertext ? '••••••••' : null,
          lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
        };
      }),
    };
  } catch (err) {
    logger.warn({ err, companyId }, 'integrations table missing — returning simulator defaults');
    return { available: false, data: INTEGRATION_KINDS.map(emptyCard) };
  }
}

export async function upsertIntegration(
  companyId: string,
  kind: IntegrationKind,
  input: { provider?: string; mode?: string; credentials?: Record<string, string> },
): Promise<PublicIntegration> {
  const fields = CREDENTIAL_FIELDS[kind];
  const hasAllRequired =
    input.mode === 'byok' &&
    !!input.credentials &&
    fields.required.every((field) => (input.credentials?.[field] ?? '').trim().length > 0);
  const mode = hasAllRequired ? 'byok' : 'simulator';

  let sealed: { ciphertext: string; iv: string; authTag: string; keyVersion: number } | undefined;
  if (mode === 'byok' && input.credentials) {
    sealed = encryptSecret(JSON.stringify(input.credentials), loadMasterKey());
  }

  const row = await prisma.integration.upsert({
    where: { companyId_kind: { companyId, kind } },
    create: {
      companyId,
      kind,
      provider: input.provider ?? DEFAULTS[kind].provider,
      mode,
      ciphertext: sealed?.ciphertext,
      iv: sealed?.iv,
      authTag: sealed?.authTag,
      keyVersion: sealed?.keyVersion ?? 1,
      status: mode === 'simulator' ? 'simulator' : 'unverified',
    },
    update: {
      provider: input.provider ?? undefined,
      mode,
      ciphertext: sealed?.ciphertext,
      iv: sealed?.iv,
      authTag: sealed?.authTag,
      keyVersion: sealed?.keyVersion,
      status: mode === 'simulator' ? 'simulator' : 'unverified',
    },
  });

  return {
    kind,
    provider: row.provider,
    mode: row.mode,
    status: row.status,
    maskedKey:
      mode === 'byok' && input.credentials
        ? maskSecret(input.credentials[fields.maskField] ?? '')
        : row.ciphertext
          ? '••••••••'
          : null,
    lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
  };
}

/**
 * Decrypted credentials for a tenant's BYOK integration, only once it has
 * actually been verified against the real provider — never for `unverified`
 * or `simulator`. Callers treat `null` as "use the simulator", never as
 * "use the platform's own key" — there is no platform key for real sends.
 */
export async function getVerifiedCredentials(
  companyId: string,
  kind: IntegrationKind,
): Promise<Record<string, string> | null> {
  try {
    const row = await prisma.integration.findFirst({ where: { companyId, kind } });
    if (!row || row.mode !== 'byok' || row.status !== 'ok' || !row.ciphertext || !row.iv || !row.authTag) {
      return null;
    }
    const json = decryptSecret(
      { ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag, keyVersion: row.keyVersion },
      loadMasterKey(),
    );
    return JSON.parse(json) as Record<string, string>;
  } catch (err) {
    logger.warn({ err, companyId, kind }, 'Failed to load verified BYOK credentials — using the simulator');
    return null;
  }
}

/** Calls the real provider's API so "verified" means the key actually works, not just that one was saved. */
async function testProviderCredentials(
  kind: IntegrationKind,
  credentials: Record<string, string>,
): Promise<{ ok: boolean; reason?: string }> {
  try {
    if (kind === 'email') {
      const res = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${credentials.apiKey}` },
      });
      return res.ok ? { ok: true } : { ok: false, reason: `Resend rejected the key (${res.status})` };
    }
    if (kind === 'whatsapp') {
      const auth = Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString('base64');
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}.json`,
        { headers: { Authorization: `Basic ${auth}` } },
      );
      return res.ok ? { ok: true } : { ok: false, reason: `Twilio rejected the credentials (${res.status})` };
    }
    if (kind === 'llm') {
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${credentials.apiKey}` },
      });
      return res.ok ? { ok: true } : { ok: false, reason: `OpenRouter rejected the key (${res.status})` };
    }
    return { ok: false, reason: 'Unknown integration kind' };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'Could not reach the provider' };
  }
}

export async function verifyIntegration(companyId: string, kind: IntegrationKind): Promise<PublicIntegration> {
  const row = await prisma.integration.findFirst({
    where: { companyId, kind },
  });
  if (!row) {
    return { ...emptyCard(kind), status: 'simulator' };
  }
  if (row.mode === 'simulator' || !row.ciphertext || !row.iv || !row.authTag) {
    const updated = await prisma.integration.update({
      where: { id: row.id },
      data: { status: 'simulator', lastVerifiedAt: new Date() },
    });
    return {
      kind,
      provider: updated.provider,
      mode: updated.mode,
      status: updated.status,
      maskedKey: null,
      lastVerifiedAt: updated.lastVerifiedAt?.toISOString() ?? null,
    };
  }

  let credentials: Record<string, string>;
  try {
    const json = decryptSecret(
      { ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag, keyVersion: row.keyVersion },
      loadMasterKey(),
    );
    credentials = JSON.parse(json) as Record<string, string>;
  } catch (err) {
    logger.warn({ err, companyId, kind }, 'Could not decrypt saved credentials to verify them');
    const updated = await prisma.integration.update({
      where: { id: row.id },
      data: { status: 'error' },
    });
    return {
      kind,
      provider: updated.provider,
      mode: updated.mode,
      status: updated.status,
      maskedKey: '••••••••',
      lastVerifiedAt: updated.lastVerifiedAt?.toISOString() ?? null,
    };
  }

  const result = await testProviderCredentials(kind, credentials);
  if (!result.ok) {
    logger.info({ companyId, kind, reason: result.reason }, 'BYOK verification failed against the real provider');
  }
  const updated = await prisma.integration.update({
    where: { id: row.id },
    data: { status: result.ok ? 'ok' : 'error', lastVerifiedAt: new Date() },
  });

  return {
    kind,
    provider: updated.provider,
    mode: updated.mode,
    status: updated.status,
    maskedKey: '••••••••',
    lastVerifiedAt: updated.lastVerifiedAt?.toISOString() ?? null,
  };
}
