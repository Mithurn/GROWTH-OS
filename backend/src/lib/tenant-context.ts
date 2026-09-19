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
      client.query = ((...args: unknown[]) => {
        const text = typeof args[0] === 'string' ? args[0] : (args[0] as { text?: string })?.text ?? '';
        const out = (origQuery as (...a: unknown[]) => unknown)(...args);
        if (!/^\s*BEGIN\b/i.test(text)) return out;
        return Promise.resolve(out).then(async (result) => {
          await bindTenant(client, companyId);
          return result;
        });
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
