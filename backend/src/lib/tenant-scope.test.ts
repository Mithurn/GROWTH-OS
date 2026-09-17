import { describe, it, expect } from 'vitest';
import { whereHasTenantScope, MissingTenantScopeError, tenantScopeExtension } from './tenant-scope';

describe('whereHasTenantScope', () => {
  it('rejects an entirely missing or empty where', () => {
    expect(whereHasTenantScope(undefined)).toBe(false);
    expect(whereHasTenantScope({})).toBe(false);
  });

  it('accepts a direct companyId filter', () => {
    expect(whereHasTenantScope({ companyId: 'co_1', status: 'active' })).toBe(true);
  });

  it('accepts a scoped relation filter', () => {
    expect(whereHasTenantScope({ company: { companyName: 'Acme' } })).toBe(true);
  });

  it('accepts companyId nested under AND', () => {
    expect(whereHasTenantScope({ AND: [{ companyId: 'co_1' }, { status: 'active' }] })).toBe(true);
  });

  it('rejects an AND with no scoped branch', () => {
    expect(whereHasTenantScope({ AND: [{ status: 'active' }, { archived: false }] })).toBe(false);
  });

  it('rejects a filter that only scopes by an unrelated id', () => {
    expect(whereHasTenantScope({ id: { in: ['a', 'b'] } })).toBe(false);
  });

  it('rejects nested customer.companyId — scope the model being queried', () => {
    expect(whereHasTenantScope({ customer: { companyId: 'co_1' } })).toBe(false);
  });
});

describe('tenantScopeExtension', () => {
  const ctx = tenantScopeExtension.query.$allModels.$allOperations;

  it('throws MissingTenantScopeError for an unscoped findMany on a tenant-scoped model', async () => {
    await expect(
      ctx({ model: 'Customer', operation: 'findMany', args: { where: {} }, query: async (a: unknown) => a }),
    ).rejects.toThrow(MissingTenantScopeError);
  });

  it('passes through a scoped findMany', async () => {
    const result = await ctx({
      model: 'Customer',
      operation: 'findMany',
      args: { where: { companyId: 'co_1' } },
      query: async (a: unknown) => a,
    });
    expect(result).toEqual({ where: { companyId: 'co_1' } });
  });

  it('does not guard a model outside the tenant-scoped set', async () => {
    const result = await ctx({
      model: 'Communication',
      operation: 'findMany',
      args: { where: {} },
      query: async (a: unknown) => a,
    });
    expect(result).toEqual({ where: {} });
  });

  it('does not guard single-row operations even when unscoped', async () => {
    const result = await ctx({
      model: 'Customer',
      operation: 'findUnique',
      args: { where: { id: 'cust_1' } },
      query: async (a: unknown) => a,
    });
    expect(result).toEqual({ where: { id: 'cust_1' } });
  });
});
