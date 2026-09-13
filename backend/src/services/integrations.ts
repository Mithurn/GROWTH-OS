import { prisma } from '../lib/prisma';
import { encryptSecret, loadMasterKey, maskSecret } from '../lib/crypto-secret';
import { logger } from '../lib/logger';

export const INTEGRATION_KINDS = ['llm', 'email', 'whatsapp'] as const;
export type IntegrationKind = (typeof INTEGRATION_KINDS)[number];

const DEFAULTS: Record<IntegrationKind, { provider: string; mode: string }> = {
  llm: { provider: 'openrouter', mode: 'simulator' },
  email: { provider: 'resend', mode: 'simulator' },
  whatsapp: { provider: 'twilio', mode: 'simulator' },
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
  input: { provider?: string; mode?: string; apiKey?: string },
): Promise<PublicIntegration> {
  const mode = input.mode === 'byok' && input.apiKey ? 'byok' : 'simulator';
  let sealed: { ciphertext: string; iv: string; authTag: string; keyVersion: number } | undefined;
  if (mode === 'byok' && input.apiKey) {
    sealed = encryptSecret(input.apiKey, loadMasterKey());
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
    maskedKey: input.apiKey ? maskSecret(input.apiKey) : row.ciphertext ? '••••••••' : null,
    lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
  };
}

export async function verifyIntegration(companyId: string, kind: IntegrationKind): Promise<PublicIntegration> {
  const row = await prisma.integration.findFirst({
    where: { companyId, kind },
  });
  if (!row) {
    return { ...emptyCard(kind), status: 'simulator' };
  }
  if (row.mode === 'simulator' || !row.ciphertext) {
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
  const updated = await prisma.integration.update({
    where: { id: row.id },
    data: { status: 'ok', lastVerifiedAt: new Date() },
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
