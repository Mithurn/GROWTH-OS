import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prisma } from '../../lib/prisma';
import { assertPlatformBudget, estimateOpenRouterCost } from '../cost-ledger';

describe('assertPlatformBudget', () => {
  const prev = process.env.PLATFORM_MONTHLY_CAP_USD;

  beforeEach(() => {
    vi.mocked(prisma.costLedger.aggregate).mockReset();
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.PLATFORM_MONTHLY_CAP_USD;
    else process.env.PLATFORM_MONTHLY_CAP_USD = prev;
  });

  it('never caps BYOK', async () => {
    const out = await assertPlatformBudget('co_1', 'byok');
    expect(out.allowed).toBe(true);
    expect(prisma.costLedger.aggregate).not.toHaveBeenCalled();
  });

  it('allows platform spend when no cap is configured — meter, do not surprise-block', async () => {
    delete process.env.PLATFORM_MONTHLY_CAP_USD;
    const out = await assertPlatformBudget('co_1', 'platform');
    expect(out.allowed).toBe(true);
  });

  it('blocks the platform key when the cap is explicitly zero', async () => {
    process.env.PLATFORM_MONTHLY_CAP_USD = '0';
    const out = await assertPlatformBudget('co_1', 'platform');
    expect(out.allowed).toBe(false);
    expect(out.reason).toMatch(/capped at \$0/i);
  });

  it('estimates USD from token counts without inventing a vendor invoice', () => {
    expect(estimateOpenRouterCost(1_000_000, 0)).toBe(0.3);
    expect(estimateOpenRouterCost(0, 1_000_000)).toBe(2.5);
  });
});
