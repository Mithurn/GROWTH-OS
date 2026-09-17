/**
 * Deterministic revenue estimation for a discovered opportunity.
 *
 * Replaces the LLM-invented `potential_revenue` / `confidence_score` / `priority_score`
 * that `opportunity-discovery.ts` used to ask the model for and write straight into a
 * `Decimal(12,2)` currency column — a number a language model made up, displayed to a
 * user as real money. See docs/ARCHITECTURE_V2.md §1 and §5 for why that was a
 * correctness bug, not a style nit, and why this belongs in code, never a prompt.
 *
 * The method: Bayesian shrinkage toward a global prior conversion rate, weighted by how
 * much of this tenant's own campaign history exists for this opportunity type. A brand
 * new company with zero campaign history gets an honest, conservative, prior-driven
 * estimate; a company with 200+ past sends of a given type gets an estimate that's
 * almost entirely their own data. This is the standard fix for "small sample means
 * wild estimates" (a single lucky campaign with 3/5 conversions is not a 60% rate) —
 * shrinking a thin sample toward a sensible prior rather than trusting it outright.
 */

export interface HistoricalOutcome {
  /** How many recipients of one past campaign of this opportunity type converted. */
  converted: number;
  /** How many recipients that campaign had in total. */
  total: number;
}

export interface ImpactEstimateInput {
  audienceSize: number;
  avgOrderValue: number;
  /** This tenant's own past campaigns of the same opportunity type, if any. */
  historical: HistoricalOutcome[];
  /**
   * Fallback conversion rate used when there's little or no tenant history.
   * Default (5%) is a deliberately conservative placeholder for a cold-start tenant —
   * see docs/PROGRESS.md Phase 1 for the backtest that should replace it with a
   * measured, published number once real campaign history exists to backtest against.
   */
  globalPriorConversionRate?: number;
  /**
   * How many "virtual" observations the prior is worth, in the shrinkage formula.
   * Higher = more history needed before the tenant's own data dominates the estimate.
   */
  priorWeight?: number;
  /** z-score for the revenue interval width. Default 1.645 = ~90%. */
  confidenceZ?: number;
}

export interface ImpactEstimate {
  /** Point estimate, at the shrunk conversion rate. */
  expectedRevenue: number;
  /** ~90% interval lower bound — never presented as a bare point number in the UI. */
  lowRevenue: number;
  /** ~90% interval upper bound. */
  highRevenue: number;
  /** The shrunk conversion rate actually used, 0-1. */
  conversionRate: number;
  /** Total real observations (sent messages) backing this estimate, tenant-only. */
  sampleSize: number;
  /**
   * 0-100: how much of the estimate is this tenant's own data vs. the prior. Not a
   * probability — a transparency number, so the UI can say "based on limited history"
   * instead of implying false precision.
   */
  confidenceScore: number;
  /** Deterministic priority signal: rank opportunities by likelihood, not invented. */
  priorityScore: number;
}

export const DEFAULT_GLOBAL_PRIOR_CONVERSION_RATE = 0.05;
export const DEFAULT_PRIOR_WEIGHT = 20;
export const DEFAULT_CONFIDENCE_Z = 1.645;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function estimateImpact(input: ImpactEstimateInput): ImpactEstimate {
  const globalPrior = input.globalPriorConversionRate ?? DEFAULT_GLOBAL_PRIOR_CONVERSION_RATE;
  const priorWeight = input.priorWeight ?? DEFAULT_PRIOR_WEIGHT;

  const observedConversions = input.historical.reduce((sum, h) => sum + h.converted, 0);
  const observedTotal = input.historical.reduce((sum, h) => sum + h.total, 0);

  // Bayesian shrinkage: treat the prior as `priorWeight` extra virtual observations at
  // the prior rate, then take the combined rate over all (real + virtual) observations.
  const effectiveN = observedTotal + priorWeight;
  const shrunkRate = (observedConversions + priorWeight * globalPrior) / effectiveN;

  // 90% interval via a normal approximation to the binomial standard error. Adequate
  // for a UI-facing range (not a scientific confidence interval) — see the backtest
  // task in docs/PROGRESS.md Phase 1 for validating this against real outcomes.
  const standardError = Math.sqrt((shrunkRate * (1 - shrunkRate)) / Math.max(effectiveN, 1));
  const confidenceZ = input.confidenceZ ?? DEFAULT_CONFIDENCE_Z;
  const lowRate = Math.max(0, shrunkRate - confidenceZ * standardError);
  const highRate = Math.min(1, shrunkRate + confidenceZ * standardError);

  const revenueAt = (rate: number) => round2(rate * input.audienceSize * input.avgOrderValue);

  // How much of `effectiveN` is real tenant data vs. the virtual prior weight.
  const confidenceScore = Math.round((observedTotal / effectiveN) * 100);

  // Rank by conversion likelihood — deterministic, comparable across opportunities for
  // the same tenant without needing to compare revenue magnitudes across opportunity
  // types with very different audience sizes.
  const priorityScore = Math.round(shrunkRate * 100);

  return {
    expectedRevenue: revenueAt(shrunkRate),
    lowRevenue: revenueAt(lowRate),
    highRevenue: revenueAt(highRate),
    conversionRate: Math.round(shrunkRate * 10000) / 10000,
    sampleSize: observedTotal,
    confidenceScore,
    priorityScore,
  };
}
