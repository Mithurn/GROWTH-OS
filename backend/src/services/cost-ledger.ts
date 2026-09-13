import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export interface CostEntry {
  companyId: string;
  runId?: string;
  provider: string;
  model?: string;
  tokensIn: number;
  tokensOut: number;
  estimatedCost: number;
  source: 'platform' | 'byok';
}

/**
 * Fail-soft write. The table may not exist until
 * 20260913170000_integrations_and_cost_ledger is applied.
 */
export async function recordCost(entry: CostEntry): Promise<void> {
  try {
    await prisma.costLedger.create({
      data: {
        companyId: entry.companyId,
        runId: entry.runId,
        provider: entry.provider,
        model: entry.model,
        tokensIn: entry.tokensIn,
        tokensOut: entry.tokensOut,
        estimatedCost: entry.estimatedCost,
        source: entry.source,
      },
    });
  } catch (err) {
    logger.warn({ err, companyId: entry.companyId }, 'cost_ledger write skipped');
  }
}

/**
 * USD estimate from OpenRouter token counts. Rates are conservative
 * published-ballpark figures, overridable per million tokens.
 * Tokens are the source of truth; this number is for the cap, not invoicing.
 */
export function estimateOpenRouterCost(tokensIn: number, tokensOut: number): number {
  const inRate = Number(process.env.OPENROUTER_USD_PER_MTOK_IN ?? '0.30');
  const outRate = Number(process.env.OPENROUTER_USD_PER_MTOK_OUT ?? '2.50');
  const usd = (tokensIn * inRate + tokensOut * outRate) / 1_000_000;
  return Math.round(usd * 1_000_000) / 1_000_000;
}

/**
 * Platform-key monthly cap. BYOK is metered but never blocked here.
 * Unset cap → allow and still record (today's production behaviour).
 * Explicit `0` → no platform spend. Missing table → allow.
 */
export async function assertPlatformBudget(
  companyId: string,
  source: 'platform' | 'byok',
): Promise<{ allowed: boolean; reason?: string; spent: number }> {
  if (source === 'byok') return { allowed: true, spent: 0 };
  const raw = process.env.PLATFORM_MONTHLY_CAP_USD;
  if (raw === undefined || raw === '') {
    return { allowed: true, spent: 0 };
  }
  const cap = Number(raw);
  if (!Number.isFinite(cap) || cap <= 0) {
    return { allowed: false, reason: 'Platform key is capped at $0. Connect BYOK or raise PLATFORM_MONTHLY_CAP_USD.', spent: 0 };
  }
  try {
    const start = new Date();
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);
    const agg = await prisma.costLedger.aggregate({
      where: { companyId, source: 'platform', createdAt: { gte: start } },
      _sum: { estimatedCost: true },
    });
    const spent = Number(agg._sum.estimatedCost ?? 0);
    if (spent >= cap) {
      return { allowed: false, reason: 'Platform monthly cap exhausted. Connect your own key.', spent };
    }
    return { allowed: true, spent };
  } catch (err) {
    logger.warn({ err, companyId }, 'cost_ledger read skipped — allowing until the table exists');
    return { allowed: true, spent: 0 };
  }
}
