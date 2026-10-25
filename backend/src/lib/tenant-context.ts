import { AsyncLocalStorage } from 'node:async_hooks';
import type { Pool, PoolClient } from 'pg';

export const tenantAls = new AsyncLocalStorage<string>();

export function runWithTenant<T>(companyId: string, fn: () => T | PromiseLike<T>): Promise<T> {
  return tenantAls.run(companyId, async () => await fn());
}

const SET_TENANT = "SELECT set_config('app.company_id', $1, true)";
const SET_ROLE = 'SET LOCAL ROLE growthos_app';

async function bindTenant(client: PoolClient, companyId: string): Promise<void> {
  await client.query(SET_ROLE);
  await client.query(SET_TENANT, [companyId]);
}

/** Wrap a pg Pool so tenant queries run as growthos_app with SET LOCAL app.company_id. */
export function installTenantRls(pool: Pool): void {
  const rawQuery = pool.query.bind(pool);
  const rawConnect = pool.connect.bind(pool);

  // ponytail: one BEGIN/COMMIT per pool.query. Fine at our QPS; use a request-scoped
  // client if checkout rate ever shows up in pg_stat_activity.
  pool.query = ((...args: unknown[]) => {
    const companyId = tenantAls.getStore();
    if (!companyId) return (rawQuery as (...a: unknown[]) => unknown)(...args);
    return (async () => {
      const client = await rawConnect();
      try {
        await client.query('BEGIN');
        await bindTenant(client, companyId);
        const result = await (client.query as (...a: unknown[]) => Promise<unknown>)(...args);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        try {
          await client.query('ROLLBACK');
        } catch {
          /* already failed */
        }
        throw err;
      } finally {
        client.release();
      }
    })();
  }) as Pool['query'];

  pool.connect = ((cb?: (err: Error | undefined, client?: PoolClient) => void) => {
    const companyId = tenantAls.getStore();
    const p = rawConnect().then(async (client) => {
      if (!companyId) return client;
      const origQuery = client.query.bind(client);
      // Postgres requires SET TRANSACTION ISOLATION LEVEL to be the very first
      // statement after BEGIN — nothing else may run before it, not even ours.
      // Prisma issues that statement itself right after BEGIN for a
      // Serializable (or any explicitly-isolated) transaction, so binding the
      // tenant eagerly on BEGIN landed between the two and broke every such
      // transaction with "SET TRANSACTION ISOLATION LEVEL must be called
      // before any query". Bound lazily instead, right before whichever query
      // is actually the first real one, so it never matters how many
      // transaction-setup statements Prisma issues first.
      let tenantBound = false;
      client.query = ((...args: unknown[]) => {
        const text = typeof args[0] === 'string' ? args[0] : (args[0] as { text?: string })?.text ?? '';
        const isSetupStatement = /^\s*(BEGIN\b|SET\s+TRANSACTION\b)/i.test(text);
        if (tenantBound || isSetupStatement) {
          return (origQuery as (...a: unknown[]) => unknown)(...args);
        }
        tenantBound = true;
        return bindTenant(client, companyId).then(() => (origQuery as (...a: unknown[]) => unknown)(...args));
      }) as PoolClient['query'];
      return client;
    });
    if (typeof cb === 'function') {
      p.then((client) => cb(undefined, client), (err) => cb(err));
      return undefined;
    }
    return p;
  }) as Pool['connect'];
}
