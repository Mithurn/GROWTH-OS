/**
 * Pure RFM (recency/frequency/monetary) scoring.
 *
 * Extracted byte-for-byte from `backend/src/services/customer-metrics.ts` — the numbers
 * this produces must never change from what's already live without a deliberate,
 * reviewed decision, because they feed both the dashboard and the agent's segment
 * predicates. Zero I/O, zero dependencies on Prisma/Supabase/Express: this is what
 * `packages/domain` means by "pure" (see docs/ARCHITECTURE_V2.md §12).
 *
 * Every threshold below is an optional parameter defaulting to the value that
 * was previously hardcoded — callers resolve the real value from config
 * (backend/src/lib/config.ts, rfm.* keys) and pass it in, keeping this file
 * free of I/O while keeping the thresholds themselves out of source. See
 * docs/V3_PLAN.md Phase 1.3 and Phase 4.3 (real quantile RFM eventually
 * retires these thresholds entirely rather than reusing them).
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

export interface FrequencyThresholds {
  highMinOrders: number;
  highMaxDays: number;
  mediumMinOrders: number;
  mediumMaxDays: number;
}

export const DEFAULT_FREQUENCY_THRESHOLDS: FrequencyThresholds = {
  highMinOrders: 8,
  highMaxDays: 45,
  mediumMinOrders: 3,
  mediumMaxDays: 120,
};

export function determinePurchaseFrequency(
  totalOrders: number,
  daysSinceLastOrder: number | null,
  thresholds: FrequencyThresholds = DEFAULT_FREQUENCY_THRESHOLDS,
): PurchaseFrequency {
  if (totalOrders <= 0) {
    return 'Low';
  }
  if (
    totalOrders >= thresholds.highMinOrders &&
    (daysSinceLastOrder === null || daysSinceLastOrder <= thresholds.highMaxDays)
  ) {
    return 'High';
  }
  if (
    totalOrders >= thresholds.mediumMinOrders &&
    (daysSinceLastOrder === null || daysSinceLastOrder <= thresholds.mediumMaxDays)
  ) {
    return 'Medium';
  }
  return 'Low';
}

export interface EngagementScoreParams {
  recencyWindowDays: number;
  frequencyPointsPerOrder: number;
  monetaryLogDivisor: number;
  weightRecency: number;
  weightFrequency: number;
  weightMonetary: number;
}

export const DEFAULT_ENGAGEMENT_SCORE_PARAMS: EngagementScoreParams = {
  recencyWindowDays: 365,
  frequencyPointsPerOrder: 12,
  monetaryLogDivisor: 4,
  weightRecency: 0.45,
  weightFrequency: 0.35,
  weightMonetary: 0.2,
};

export function calculateEngagementScore(
  totalOrders: number,
  totalSpent: number,
  daysSinceLastOrder: number | null,
  params: EngagementScoreParams = DEFAULT_ENGAGEMENT_SCORE_PARAMS,
): number {
  const recencyScore =
    daysSinceLastOrder === null
      ? 0
      : Math.max(0, 100 - Math.min(daysSinceLastOrder, params.recencyWindowDays) * (100 / params.recencyWindowDays));

  const frequencyScore = Math.min(totalOrders * params.frequencyPointsPerOrder, 100);

  const monetaryScore =
    totalSpent <= 0 ? 0 : Math.min((Math.log10(totalSpent + 1) / params.monetaryLogDivisor) * 100, 100);

  return roundToTwo(
    recencyScore * params.weightRecency +
      frequencyScore * params.weightFrequency +
      monetaryScore * params.weightMonetary,
  );
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

export interface ComputeRfmParams {
  frequencyThresholds?: FrequencyThresholds;
  engagementScoreParams?: EngagementScoreParams;
}

/**
 * The single entry point services should call. Takes an aggregate (already summed
 * from order rows) and a reference "now", returns every derived RFM field.
 */
export function computeRfm(
  aggregate: CustomerAggregate | undefined,
  now: Date,
  params: ComputeRfmParams = {},
): RfmResult {
  const totalOrders = aggregate?.totalOrders ?? 0;
  const totalSpent = roundToTwo(aggregate?.totalSpent ?? 0);
  const lastOrderDate = aggregate?.lastOrderDate ?? null;
  const daysSinceLastOrder = daysSince(lastOrderDate, now);
  const avgOrderValue = totalOrders > 0 ? roundToTwo(totalSpent / totalOrders) : 0;
  const purchaseFrequency = determinePurchaseFrequency(totalOrders, daysSinceLastOrder, params.frequencyThresholds);
  const engagementScore = calculateEngagementScore(
    totalOrders,
    totalSpent,
    daysSinceLastOrder,
    params.engagementScoreParams,
  );

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
