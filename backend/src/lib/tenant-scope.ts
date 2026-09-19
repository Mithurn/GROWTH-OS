
/**
 * Every model whose rows belong to one company. A query against one of these
 * that reaches the database with no `companyId` anywhere in its `where` is
 * either a bug (a route that forgot to scope) or a real cross-tenant leak —
 * see docs/breaks.md's 2026-09-18 entry for a real instance of the latter.
 *
 * Deliberately does not include models with no company_id column at all
 * (Communication, CommunicationEvent, ProcessedWebhookEvent, ...) — those are
 * scoped indirectly through a parent that IS in this set.
 */
const TENANT_SCOPED_MODELS = new Set([
  'Customer',
  'Product',
  'Persona',
  'Opportunity',
  'Campaign',
  'CampaignApproval',
  'Agent',
  'AgentRun',
  'IngestionSession',
  'Integration',
  'CostLedger',
  'CompanyConfig',
  'Order',
  'OrderItem',
  'CustomerMetrics',
  'CustomerAttributes',
]);

/**
 * Only the "list/bulk" read and write shapes: these are exactly the ones
 * where an omitted filter silently widens from "this tenant's rows" to
 * "every tenant's rows" — `findMany`, `count`, `aggregate`, `groupBy` returning
 * other tenants' data; `updateMany`/`deleteMany` mutating them.
 *
 * Single-row operations (`findUnique`, `update`, `delete`, keyed by id) are
 * deliberately NOT enforced here: the existing convention (see
 * `requireCompanyOwnership` in middleware/auth.ts) is to verify ownership
 * once, before the id ever reaches Prisma, and most call sites already fetch
 * or verify a row before mutating it by id alone. Requiring `companyId` in
 * every single-row `where` would be a much larger, separately-reviewed change
 * across dozens of call sites that don't need it — see docs/V3_PLAN.md Phase 2
 * for why this scope was chosen over that broader one.
 */
const GUARDED_OPERATIONS = new Set([
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

export class MissingTenantScopeError extends Error {
  constructor(model: string, operation: string) {
    super(
      `${model}.${operation} ran with no companyId anywhere in its where clause. ` +
        `This model is tenant-scoped — pass { where: { companyId, ... } } explicitly.`,
    );
    this.name = 'MissingTenantScopeError';
  }
}

/**
 * True if `where` has a top-level `companyId` or `company` filter, or one
 * nested under AND/OR/NOT. Shallow on purpose — `{ customer: { companyId } }`
 * does not count; put `companyId` on the model being queried.
 */
export function whereHasTenantScope(where: unknown): boolean {
  if (!where || typeof where !== 'object') return false;
  const w = where as Record<string, unknown>;
  if ('companyId' in w) return true;
  if ('company' in w) return true;

  // AND/OR/NOT combinators: scoped if every branch of an AND is scoped, or any
  // branch of an OR/NOT wrapper still narrows through a scoped clause. This is
  // deliberately permissive on OR (a single scoped branch is enough to count)
  // rather than trying to prove the whole boolean expression is safe — the goal
  // is catching the common "forgot to scope entirely" mistake, not verifying
  // arbitrarily nested filter logic.
  for (const key of ['AND', 'OR', 'NOT'] as const) {
    const branch = w[key];
    if (Array.isArray(branch) && branch.some((b) => whereHasTenantScope(b))) return true;
    if (branch && typeof branch === 'object' && whereHasTenantScope(branch)) return true;
  }

  return false;
}

/**
 * Structural tenant-isolation guard (docs/V3_PLAN.md Phase 2). Applied via
 * `prisma.$extends(tenantScopeExtension)` in lib/prisma.ts. Throws instead of
 * silently running an unscoped query — a missing filter is a bug to fix at the
 * call site, not something to paper over by guessing a companyId.
 *
 * A plain extension-args object rather than `Prisma.defineExtension(...)` —
 * that wrapper returns a definer function meant for sharing one extension
 * across multiple clients with stronger inference; `$extends` accepts this
 * shape directly, and it keeps the guard trivially unit-testable (see
 * tenant-scope.test.ts) without constructing a real client.
 */
export const tenantScopeExtension = {
  name: 'tenant-scope-guard',
  query: {
    $allModels: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async $allOperations({ model, operation, args, query }: any) {
        if (
          model &&
          TENANT_SCOPED_MODELS.has(model) &&
          GUARDED_OPERATIONS.has(operation) &&
          !whereHasTenantScope((args as { where?: unknown } | undefined)?.where)
        ) {
          throw new MissingTenantScopeError(model, operation);
        }
        return query(args);
      },
    },
  },
};
