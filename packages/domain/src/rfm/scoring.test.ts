import { describe, it, expect } from 'vitest';
import {
  computeRfm,
  determinePurchaseFrequency,
  calculateEngagementScore,
  daysSince,
  roundToTwo,
  toNumber,
} from './scoring';

describe('toNumber', () => {
  it('passes through finite numbers', () => {
    expect(toNumber(42)).toBe(42);
  });
  it('parses numeric strings', () => {
    expect(toNumber('19.5')).toBe(19.5);
  });
  it('defaults to 0 for null/undefined/garbage', () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber('not-a-number')).toBe(0);
    expect(toNumber(NaN)).toBe(0);
  });
});

describe('roundToTwo', () => {
  it('rounds to 2 decimal places', () => {
    expect(roundToTwo(10.005)).toBe(10.01);
    expect(roundToTwo(10.004)).toBe(10);
  });
});

describe('daysSince', () => {
  const now = new Date('2026-09-13T00:00:00.000Z');

  it('returns null when there is no date', () => {
    expect(daysSince(null, now)).toBeNull();
  });

  it('computes whole days elapsed', () => {
    const tenDaysAgo = new Date('2026-09-03T00:00:00.000Z');
    expect(daysSince(tenDaysAgo, now)).toBe(10);
  });

  it('never returns negative — clamps a future date to 0', () => {
    const future = new Date('2026-09-20T00:00:00.000Z');
    expect(daysSince(future, now)).toBe(0);
  });
});

describe('determinePurchaseFrequency', () => {
  it('is Low for zero orders regardless of recency', () => {
    expect(determinePurchaseFrequency(0, null)).toBe('Low');
    expect(determinePurchaseFrequency(0, 1)).toBe('Low');
  });

  it('is High for 8+ orders and recent activity (<=45 days)', () => {
    expect(determinePurchaseFrequency(8, 45)).toBe('High');
    expect(determinePurchaseFrequency(20, null)).toBe('High');
  });

  it('drops out of High past 45 days even with 8+ orders', () => {
    expect(determinePurchaseFrequency(8, 46)).toBe('Medium');
  });

  it('is Medium for 3-7 orders and activity within 120 days', () => {
    expect(determinePurchaseFrequency(3, 120)).toBe('Medium');
    expect(determinePurchaseFrequency(7, null)).toBe('Medium');
  });

  it('falls to Low past 120 days even with 3+ orders', () => {
    expect(determinePurchaseFrequency(3, 121)).toBe('Low');
  });

  it('is Low for 1-2 orders regardless of recency', () => {
    expect(determinePurchaseFrequency(2, 1)).toBe('Low');
  });
});

describe('calculateEngagementScore', () => {
  it('is 0 for a customer with no orders and no spend', () => {
    expect(calculateEngagementScore(0, 0, null)).toBe(0);
  });

  it('is higher for a customer who ordered yesterday than one dormant a year', () => {
    const recent = calculateEngagementScore(5, 5000, 1);
    const dormant = calculateEngagementScore(5, 5000, 365);
    expect(recent).toBeGreaterThan(dormant);
  });

  it('is higher for more orders, holding recency and spend constant', () => {
    const fewer = calculateEngagementScore(2, 5000, 10);
    const more = calculateEngagementScore(10, 5000, 10);
    expect(more).toBeGreaterThan(fewer);
  });

  it('is higher for more spend, holding orders and recency constant', () => {
    const low = calculateEngagementScore(5, 100, 10);
    const high = calculateEngagementScore(5, 50000, 10);
    expect(high).toBeGreaterThan(low);
  });

  it('never exceeds 100', () => {
    const maxed = calculateEngagementScore(1000, 10_000_000, 0);
    expect(maxed).toBeLessThanOrEqual(100);
  });

  it('is monotonic non-increasing in days since last order', () => {
    const scores = [0, 30, 90, 180, 365, 1000].map((d) =>
      calculateEngagementScore(5, 1000, d),
    );
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });
});

describe('computeRfm', () => {
  const now = new Date('2026-09-13T00:00:00.000Z');

  it('handles a customer with no orders', () => {
    const result = computeRfm(undefined, now);
    expect(result).toEqual({
      totalOrders: 0,
      totalSpent: 0,
      avgOrderValue: 0,
      lastOrderDate: null,
      daysSinceLastOrder: null,
      purchaseFrequency: 'Low',
      engagementScore: 0,
    });
  });

  it('computes avgOrderValue as totalSpent / totalOrders', () => {
    const result = computeRfm(
      { totalOrders: 4, totalSpent: 1000, lastOrderDate: new Date('2026-09-01T00:00:00.000Z') },
      now,
    );
    expect(result.avgOrderValue).toBe(250);
    expect(result.totalOrders).toBe(4);
    expect(result.daysSinceLastOrder).toBe(12);
  });

  it('rounds totalSpent and avgOrderValue to 2 decimals', () => {
    const result = computeRfm(
      { totalOrders: 3, totalSpent: 100.005, lastOrderDate: null },
      now,
    );
    expect(result.totalSpent).toBe(100.01);
  });
});
