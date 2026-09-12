import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestDb, type TestDb } from './testDb';
import { toPrismaWhere, matchesSegment, type OpportunityType } from '@growthos/domain';

/**
 * This is the test the mocked suite (src/__tests__/tenant-isolation.test.ts) cannot
 * write: it proves isolation against a real database with two real tenants and real
 * foreign keys, rather than against a mock that returns whatever the test tells it to.
 * See docs/PROGRESS.md Phase 0 and docs/ARCHITECTURE_V2.md §12.
 *
 * Scenario: two companies, each with a customer whose metrics satisfy the same
 * opportunity segment (Retention-VIP). Querying company A's audience through the exact
 * predicate the agent will use (`toPrismaWhere`, from @growthos/domain) must return only
 * company A's customer — never company B's, even though B's customer matches the same
 * segment definition. This is the tenant-isolation invariant surviving all the way
 * through the domain layer, not just the HTTP layer PRODUCTION_PLAN.md already covers.
 */
describe('tenant isolation — real Postgres, two live tenants', () => {
  let db: TestDb;
  let companyA: string;
  let companyB: string;

  beforeAll(async () => {
    db = await startTestDb();

    const [a, b] = await Promise.all([
      db.prisma.company.create({ data: { companyName: `Tenant A ${Date.now()}` } }),
      db.prisma.company.create({ data: { companyName: `Tenant B ${Date.now()}` } }),
    ]);
    companyA = a.id;
    companyB = b.id;

    // Both customers satisfy Retention-VIP: totalSpent >= 5000, daysSinceLastOrder >= 15.
    const [customerA, customerB] = await Promise.all([
      db.prisma.customer.create({
        data: { companyId: companyA, firstName: 'Alice', externalCustomerId: 'ext-a' },
      }),
      db.prisma.customer.create({
        data: { companyId: companyB, firstName: 'Bob', externalCustomerId: 'ext-b' },
      }),
    ]);

    await Promise.all([
      db.prisma.customerMetrics.create({
        data: {
          customerId: customerA.id,
          totalOrders: 10,
          totalSpent: 8000,
          avgOrderValue: 800,
          daysSinceLastOrder: 20,
        },
      }),
      db.prisma.customerMetrics.create({
        data: {
          customerId: customerB.id,
          totalOrders: 12,
          totalSpent: 9000,
          avgOrderValue: 750,
          daysSinceLastOrder: 25,
        },
      }),
    ]);
  }, 60_000);

  afterAll(async () => {
    await db.stop();
  });

  it('a Retention-VIP query scoped to company A never returns company B\'s customer', async () => {
    const where = toPrismaWhere('Retention-VIP' as OpportunityType, companyA);
    const results = await db.prisma.customerMetrics.findMany({
      where,
      include: { customer: true },
    });

    expect(results).toHaveLength(1);
    expect(results[0].customer.companyId).toBe(companyA);
    expect(results[0].customer.firstName).toBe('Alice');
  });

  it('the same query scoped to company B returns only company B, despite identical metrics shape', async () => {
    const where = toPrismaWhere('Retention-VIP' as OpportunityType, companyB);
    const results = await db.prisma.customerMetrics.findMany({
      where,
      include: { customer: true },
    });

    expect(results).toHaveLength(1);
    expect(results[0].customer.companyId).toBe(companyB);
    expect(results[0].customer.firstName).toBe('Bob');
  });

  it('an unscoped count would see both tenants — the regression this predicate prevents', async () => {
    // Deliberately the bug PRODUCTION_PLAN.md §3 documents as historical: counting
    // customerMetrics with no company_id filter at all. Proves the fix in
    // toPrismaWhere is doing real work, not just adding an unused parameter.
    const unscopedCount = await db.prisma.customerMetrics.count({
      where: { totalSpent: { gte: 5000 }, daysSinceLastOrder: { gte: 15 } },
    });
    expect(unscopedCount).toBe(2);

    const scopedCount = await db.prisma.customerMetrics.count({
      where: toPrismaWhere('Retention-VIP' as OpportunityType, companyA),
    });
    expect(scopedCount).toBe(1);
  });

  it('matchesSegment (the in-memory predicate) agrees with toPrismaWhere (the SQL predicate) on both customers', async () => {
    const metricsRows = await db.prisma.customerMetrics.findMany({
      include: { customer: true },
    });

    for (const row of metricsRows) {
      const matchesInMemory = matchesSegment('Retention-VIP', {
        totalOrders: row.totalOrders,
        totalSpent: Number(row.totalSpent),
        avgOrderValue: Number(row.avgOrderValue),
        daysSinceLastOrder: row.daysSinceLastOrder,
      });
      expect(matchesInMemory).toBe(true);
    }
  });
});
