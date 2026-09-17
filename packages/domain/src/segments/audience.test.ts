import { describe, it, expect } from 'vitest';
import { matchesSegment, toPrismaWhere, OPPORTUNITY_TYPES } from './audience';

describe('matchesSegment', () => {
  describe('Retention-Churn: inactive 30-59 days', () => {
    it('excludes a customer inactive fewer than 30 days', () => {
      expect(
        matchesSegment('Retention-Churn', {
          totalOrders: 5,
          totalSpent: 1000,
          avgOrderValue: 200,
          daysSinceLastOrder: 29,
        }),
      ).toBe(false);
    });

    it('includes a customer at exactly 30 days', () => {
      expect(
        matchesSegment('Retention-Churn', {
          totalOrders: 5,
          totalSpent: 1000,
          avgOrderValue: 200,
          daysSinceLastOrder: 30,
        }),
      ).toBe(true);
    });

    it('excludes a customer at exactly 60 days (boundary belongs to Reactivation)', () => {
      expect(
        matchesSegment('Retention-Churn', {
          totalOrders: 5,
          totalSpent: 1000,
          avgOrderValue: 200,
          daysSinceLastOrder: 60,
        }),
      ).toBe(false);
    });

    it('excludes a customer with no orders (null daysSinceLastOrder)', () => {
      expect(
        matchesSegment('Retention-Churn', {
          totalOrders: 0,
          totalSpent: 0,
          avgOrderValue: 0,
          daysSinceLastOrder: null,
        }),
      ).toBe(false);
    });
  });

  describe('Retention-VIP: >=5000 spent, inactive 15+ days', () => {
    it('excludes a big spender who ordered recently', () => {
      expect(
        matchesSegment('Retention-VIP', {
          totalOrders: 10,
          totalSpent: 10000,
          avgOrderValue: 1000,
          daysSinceLastOrder: 5,
        }),
      ).toBe(false);
    });

    it('excludes a dormant customer below the spend threshold', () => {
      expect(
        matchesSegment('Retention-VIP', {
          totalOrders: 10,
          totalSpent: 4999,
          avgOrderValue: 500,
          daysSinceLastOrder: 30,
        }),
      ).toBe(false);
    });

    it('includes a big spender inactive 15+ days', () => {
      expect(
        matchesSegment('Retention-VIP', {
          totalOrders: 10,
          totalSpent: 5000,
          avgOrderValue: 500,
          daysSinceLastOrder: 15,
        }),
      ).toBe(true);
    });
  });

  describe('Upsell: 3+ orders, AOV <= 2000', () => {
    it('excludes a customer with fewer than 3 orders', () => {
      expect(
        matchesSegment('Upsell', {
          totalOrders: 2,
          totalSpent: 1000,
          avgOrderValue: 500,
          daysSinceLastOrder: 10,
        }),
      ).toBe(false);
    });

    it('excludes a repeat buyer with a high AOV', () => {
      expect(
        matchesSegment('Upsell', {
          totalOrders: 5,
          totalSpent: 15000,
          avgOrderValue: 3000,
          daysSinceLastOrder: 10,
        }),
      ).toBe(false);
    });

    it('includes a repeat buyer with a low AOV', () => {
      expect(
        matchesSegment('Upsell', {
          totalOrders: 3,
          totalSpent: 6000,
          avgOrderValue: 2000,
          daysSinceLastOrder: 10,
        }),
      ).toBe(true);
    });
  });

  describe('Reactivation: dormant 60+ days', () => {
    it('excludes a customer inactive fewer than 60 days', () => {
      expect(
        matchesSegment('Reactivation', {
          totalOrders: 5,
          totalSpent: 1000,
          avgOrderValue: 200,
          daysSinceLastOrder: 59,
        }),
      ).toBe(false);
    });

    it('includes a customer at exactly 60 days', () => {
      expect(
        matchesSegment('Reactivation', {
          totalOrders: 5,
          totalSpent: 1000,
          avgOrderValue: 200,
          daysSinceLastOrder: 60,
        }),
      ).toBe(true);
    });
  });

  it('never targets everyone: every type requires a real signal, none match a customer with 0 orders and 0 spend and 0 recency data other than Retention-Churn/Reactivation which explicitly require null-safe daysSinceLastOrder', () => {
    for (const type of OPPORTUNITY_TYPES) {
      const emptyCustomer = {
        totalOrders: 0,
        totalSpent: 0,
        avgOrderValue: 0,
        daysSinceLastOrder: null,
      };
      expect(matchesSegment(type, emptyCustomer)).toBe(false);
    }
  });
});

describe('toPrismaWhere', () => {
  it('scopes every opportunity type by companyId for tenancy', () => {
    for (const type of OPPORTUNITY_TYPES) {
      const where = toPrismaWhere(type, 'company-123') as { companyId?: string };
      expect(where.companyId).toBe('company-123');
    }
  });

  it('produces the same boundaries as matchesSegment for Retention-Churn', () => {
    const where = toPrismaWhere('Retention-Churn', 'c1') as {
      daysSinceLastOrder: { gte: number; lt: number };
    };
    expect(where.daysSinceLastOrder).toEqual({ gte: 30, lt: 60 });
  });
});
