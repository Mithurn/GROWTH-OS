/**
 * Pure RFM (recency/frequency/monetary) scoring.
 *
 * Extracted byte-for-byte from `backend/src/services/customer-metrics.ts` — the numbers
 * this produces must never change from what's already live without a deliberate,
 * reviewed decision, because they feed both the dashboard and the agent's segment
 * predicates. Zero I/O, zero dependencies on Prisma/Supabase/Express: this is what
 * `packages/domain` means by "pure" (see docs/ARCHITECTURE_V2.md §12).
 */

export type PurchaseFrequency = 'High' | 'Medium' | 'Low';

const DAY_MS = 24 * 60 * 60 * 1000;

export function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function roundToTwo(value: number): number {
  return Math.round(value * 100) / 100;
}

export function daysSince(date: Date | null, now: Date): number | null {
  if (!date) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS));
}

export function determinePurchaseFrequency(
  totalOrders: number,
  daysSinceLastOrder: number | null,
): PurchaseFrequency {
  if (totalOrders <= 0) {
    return 'Low';
  }
  if (totalOrders >= 8 && (daysSinceLastOrder === null || daysSinceLastOrder <= 45)) {
    return 'High';
  }
  if (totalOrders >= 3 && (daysSinceLastOrder === null || daysSinceLastOrder <= 120)) {
    return 'Medium';
  }
  return 'Low';
}

export function calculateEngagementScore(
  totalOrders: number,
  totalSpent: number,
  daysSinceLastOrder: number | null,
): number {
  const recencyScore =
    daysSinceLastOrder === null
      ? 0
      : Math.max(0, 100 - Math.min(daysSinceLastOrder, 365) * (100 / 365));

  const frequencyScore = Math.min(totalOrders * 12, 100);

  const monetaryScore =
    totalSpent <= 0 ? 0 : Math.min((Math.log10(totalSpent + 1) / 4) * 100, 100);

  return roundToTwo(recencyScore * 0.45 + frequencyScore * 0.35 + monetaryScore * 0.2);
}

export interface CustomerAggregate {
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: Date | null;
}

export interface RfmResult {
  totalOrders: number;
  totalSpent: number;
  avgOrderValue: number;
  lastOrderDate: Date | null;
  daysSinceLastOrder: number | null;
  purchaseFrequency: PurchaseFrequency;
  engagementScore: number;
}

/**
 * The single entry point services should call. Takes an aggregate (already summed
 * from order rows) and a reference "now", returns every derived RFM field.
 */
export function computeRfm(aggregate: CustomerAggregate | undefined, now: Date): RfmResult {
  const totalOrders = aggregate?.totalOrders ?? 0;
  const totalSpent = roundToTwo(aggregate?.totalSpent ?? 0);
  const lastOrderDate = aggregate?.lastOrderDate ?? null;
  const daysSinceLastOrder = daysSince(lastOrderDate, now);
  const avgOrderValue = totalOrders > 0 ? roundToTwo(totalSpent / totalOrders) : 0;
  const purchaseFrequency = determinePurchaseFrequency(totalOrders, daysSinceLastOrder);
  const engagementScore = calculateEngagementScore(totalOrders, totalSpent, daysSinceLastOrder);

  return {
    totalOrders,
    totalSpent,
    avgOrderValue,
    lastOrderDate,
    daysSinceLastOrder,
    purchaseFrequency,
    engagementScore,
  };
}
