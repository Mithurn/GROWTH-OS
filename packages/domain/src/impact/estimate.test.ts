import { describe, it, expect } from 'vitest';
import { estimateImpact, DEFAULT_GLOBAL_PRIOR_CONVERSION_RATE } from './estimate';

describe('estimateImpact', () => {
  it('falls back almost entirely to the global prior with zero tenant history', () => {
    const result = estimateImpact({
      audienceSize: 1000,
      avgOrderValue: 500,
      historical: [],
    });

    expect(result.conversionRate).toBeCloseTo(DEFAULT_GLOBAL_PRIOR_CONVERSION_RATE, 4);
    expect(result.sampleSize).toBe(0);
    expect(result.confidenceScore).toBe(0);
    // 5% of 1000 * 500 = 25000
    expect(result.expectedRevenue).toBeCloseTo(25000, 0);
  });

  it('does not trust a single lucky campaign at face value', () => {
    // 3 out of 5 converted (60%) — a naive estimate would predict a 60% rate on
    // audienceSize. Shrinkage must pull this hard toward the prior.
    const result = estimateImpact({
      audienceSize: 1000,
      avgOrderValue: 500,
      historical: [{ converted: 3, total: 5 }],
    });

    expect(result.conversionRate).toBeLessThan(0.6);
    expect(result.conversionRate).toBeGreaterThan(DEFAULT_GLOBAL_PRIOR_CONVERSION_RATE);
  });

  it('trusts tenant history more as the sample grows, converging toward the observed rate', () => {
    // Same observed rate (20%) at three sample sizes — confidence should rise and the
    // shrunk rate should move closer to 0.2 as sampleSize grows.
    const small = estimateImpact({
      audienceSize: 1000,
      avgOrderValue: 500,
      historical: [{ converted: 2, total: 10 }],
    });
    const medium = estimateImpact({
      audienceSize: 1000,
      avgOrderValue: 500,
      historical: [{ converted: 20, total: 100 }],
    });
    const large = estimateImpact({
      audienceSize: 1000,
      avgOrderValue: 500,
      historical: [{ converted: 200, total: 1000 }],
    });

    expect(small.confidenceScore).toBeLessThan(medium.confidenceScore);
    expect(medium.confidenceScore).toBeLessThan(large.confidenceScore);

    const distanceFromObserved = (rate: number) => Math.abs(rate - 0.2);
    expect(distanceFromObserved(medium.conversionRate)).toBeLessThan(
      distanceFromObserved(small.conversionRate),
    );
    expect(distanceFromObserved(large.conversionRate)).toBeLessThan(
      distanceFromObserved(medium.conversionRate),
    );

    // With enough real data, confidence approaches 100 (almost entirely real data).
    expect(large.confidenceScore).toBeGreaterThanOrEqual(97);
  });

  it('aggregates multiple past campaigns of the same type', () => {
    const combined = estimateImpact({
      audienceSize: 500,
      avgOrderValue: 200,
      historical: [
        { converted: 10, total: 100 },
        { converted: 15, total: 100 },
      ],
    });

    const equivalentSingle = estimateImpact({
      audienceSize: 500,
      avgOrderValue: 200,
      historical: [{ converted: 25, total: 200 }],
    });

    expect(combined.conversionRate).toBeCloseTo(equivalentSingle.conversionRate, 6);
    expect(combined.sampleSize).toBe(200);
  });

  it('always returns lowRevenue <= expectedRevenue <= highRevenue', () => {
    const cases = [
      { historical: [] },
      { historical: [{ converted: 1, total: 3 }] },
      { historical: [{ converted: 500, total: 1000 }] },
    ];
    for (const c of cases) {
      const result = estimateImpact({ audienceSize: 800, avgOrderValue: 300, ...c });
      expect(result.lowRevenue).toBeLessThanOrEqual(result.expectedRevenue);
      expect(result.expectedRevenue).toBeLessThanOrEqual(result.highRevenue);
    }
  });

  it('never produces a negative revenue bound or a rate outside [0, 1]', () => {
    const result = estimateImpact({
      audienceSize: 10,
      avgOrderValue: 50,
      historical: [{ converted: 0, total: 2 }],
    });
    expect(result.lowRevenue).toBeGreaterThanOrEqual(0);
    expect(result.conversionRate).toBeGreaterThanOrEqual(0);
    expect(result.conversionRate).toBeLessThanOrEqual(1);
  });

  it('scales linearly with audienceSize and avgOrderValue for a fixed rate', () => {
    const base = estimateImpact({
      audienceSize: 100,
      avgOrderValue: 100,
      historical: [{ converted: 1000, total: 10000 }],
    });
    const doubledAudience = estimateImpact({
      audienceSize: 200,
      avgOrderValue: 100,
      historical: [{ converted: 1000, total: 10000 }],
    });
    expect(doubledAudience.expectedRevenue).toBeCloseTo(base.expectedRevenue * 2, 0);
  });

  it('priorityScore is a monotonic function of the shrunk conversion rate', () => {
    const lowRate = estimateImpact({
      audienceSize: 100,
      avgOrderValue: 100,
      historical: [{ converted: 1, total: 100 }],
    });
    const highRate = estimateImpact({
      audienceSize: 100,
      avgOrderValue: 100,
      historical: [{ converted: 50, total: 100 }],
    });
    expect(highRate.priorityScore).toBeGreaterThan(lowRate.priorityScore);
  });
});
