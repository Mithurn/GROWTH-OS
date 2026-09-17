/**
 * Which customers belong to which opportunity segment.
 *
 * Extracted from `backend/src/services/opportunity-discovery.ts`. This is the single
 * source of truth for what each opportunity type targets — the model proposes a type,
 * this decides who actually receives anything. A model must never define an audience;
 * see docs/ARCHITECTURE_V2.md §5 (the determinism boundary).
 *
 * Pure and I/O-free: it takes plain metric fields and returns a predicate description
 * the caller applies with whatever query engine it's using (Prisma today). Extending
 * this file to a new opportunity type is a two-step change — add the type to the enum,
 * add a branch here — and the exhaustiveness check below fails to compile until both
 * are done, so a type can never silently fall through to "targets everyone."
 */

export type OpportunityType = 'Retention-Churn' | 'Retention-VIP' | 'Upsell' | 'Reactivation';

export const OPPORTUNITY_TYPES: OpportunityType[] = [
  'Retention-Churn',
  'Retention-VIP',
  'Upsell',
  'Reactivation',
];

export interface CustomerMetricSnapshot {
  customerId: string;
  companyId: string;
  totalOrders: number;
  totalSpent: number;
  avgOrderValue: number;
  daysSinceLastOrder: number | null;
}

/**
 * Evaluate one customer's metrics against one opportunity type's predicate.
 * Kept as a plain boolean function (rather than an ORM `where` builder) so it is
 * usable both as a Prisma filter shape (see `toPrismaWhere` in the backend adapter)
 * and directly in tests/evals without a database.
 */
export function matchesSegment(
  opportunityType: OpportunityType,
  metrics: Pick<CustomerMetricSnapshot, 'totalOrders' | 'totalSpent' | 'avgOrderValue' | 'daysSinceLastOrder'>,
): boolean {
  const { totalOrders, totalSpent, avgOrderValue, daysSinceLastOrder } = metrics;

  switch (opportunityType) {
    case 'Retention-Churn':
      return daysSinceLastOrder !== null && daysSinceLastOrder >= 30 && daysSinceLastOrder < 60;

    case 'Retention-VIP':
      return totalSpent >= 5000 && daysSinceLastOrder !== null && daysSinceLastOrder >= 15;

    case 'Upsell':
      return totalOrders >= 3 && avgOrderValue <= 2000;

    case 'Reactivation':
      return daysSinceLastOrder !== null && daysSinceLastOrder >= 60;

    default: {
      const exhaustive: never = opportunityType;
      throw new Error(`domain/segments: unhandled opportunity type ${String(exhaustive)}`);
    }
  }
}

/** Prisma `where` shape for `customerMetrics.count` / `.findMany`, scoped to a company. */
export function toPrismaWhere(opportunityType: OpportunityType, companyId: string) {
  // customer_metrics carries its own company_id (docs/V3_PLAN.md Phase 2) — a
  // direct filter instead of the join through customer this used to require.
  const owned = { companyId };

  switch (opportunityType) {
    case 'Retention-Churn':
      return { ...owned, daysSinceLastOrder: { gte: 30, lt: 60 } };
    case 'Retention-VIP':
      return { ...owned, totalSpent: { gte: 5000 }, daysSinceLastOrder: { gte: 15 } };
    case 'Upsell':
      return { ...owned, totalOrders: { gte: 3 }, avgOrderValue: { lte: 2000 } };
    case 'Reactivation':
      return { ...owned, daysSinceLastOrder: { gte: 60 } };
    default: {
      const exhaustive: never = opportunityType;
      throw new Error(`domain/segments: unhandled opportunity type ${String(exhaustive)}`);
    }
  }
}
