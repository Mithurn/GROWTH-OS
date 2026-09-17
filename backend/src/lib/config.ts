import {
  CONFIG_REGISTRY,
  CONFIG_KEYS,
  schemaDefault,
  type ConfigKey,
  type ConfigValue,
} from '@growthos/contracts/config/registry';
import { Prisma } from '../../generated/prisma';
import { prisma } from './prisma';
import { getClient } from './redis';
import { logger } from './logger';

/**
 * Resolution: company override -> plan override -> config_defaults row -> the
 * Zod schema's own `.default(...)`. Every literal this replaces (rate limits,
 * RFM thresholds, queue concurrency, LLM params, ...) used to be a number
 * sitting in a `.ts` file; now it is a typed, tenant-overridable value read
 * from here. See docs/V3_PLAN.md Phase 1 and CONFIG_REGISTRY for the full
 * catalogue and what each key replaced.
 *
 * Cached in Redis (not a local process cache — a redeploy or a second
 * instance must never see a different value for the same key). A direct
 * company-level write invalidates its own cache entry immediately; a plan- or
 * global-level write is picked up on the next TTL expiry rather than fanned
 * out to every affected tenant.
 * ponytail: TTL-based invalidation for plan/global writes, not instant —
 * upgrade to pub/sub invalidation if a plan-wide config change ever needs to
 * take effect faster than CACHE_TTL_SECONDS.
 */
const CACHE_TTL_SECONDS = 300;
const CACHE_PREFIX = 'config:';

function cacheKey(companyId: string | null, key: ConfigKey): string {
  return `${CACHE_PREFIX}${companyId ?? 'global'}:${key}`;
}

async function resolveFromDb<K extends ConfigKey>(companyId: string | null, key: K): Promise<ConfigValue<K>> {
  const schema = CONFIG_REGISTRY[key];

  if (companyId) {
    const companyRow = await prisma.companyConfig.findUnique({
      where: { companyId_key: { companyId, key } },
    });
    if (companyRow) {
      const parsed = schema.safeParse(companyRow.value);
      if (parsed.success) return parsed.data as ConfigValue<K>;
      logger.warn({ key, companyId }, 'company_config value failed schema validation, falling back to plan/default');
    }

    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { plan: true } });
    if (company?.plan) {
      const planRow = await prisma.planConfig.findUnique({
        where: { planId_key: { planId: company.plan, key } },
      });
      if (planRow) {
        const parsed = schema.safeParse(planRow.value);
        if (parsed.success) return parsed.data as ConfigValue<K>;
        logger.warn({ key, plan: company.plan }, 'plan_config value failed schema validation, falling back to default');
      }
    }
  }

  const globalRow = await prisma.configDefault.findUnique({ where: { key } });
  if (globalRow) {
    const parsed = schema.safeParse(globalRow.value);
    if (parsed.success) return parsed.data as ConfigValue<K>;
    logger.warn({ key }, 'config_defaults value failed schema validation, falling back to schema default');
  }

  return schemaDefault(key);
}

/**
 * Resolve one config value. `companyId` is null for genuinely global settings
 * (nothing a tenant should override); pass it whenever the call site has one.
 */
export async function getConfig<K extends ConfigKey>(companyId: string | null, key: K): Promise<ConfigValue<K>> {
  const redis = getClient();
  const ck = cacheKey(companyId, key);

  try {
    const cached = await redis.get(ck);
    if (cached !== null) {
      const parsed = CONFIG_REGISTRY[key].safeParse(JSON.parse(cached));
      if (parsed.success) return parsed.data as ConfigValue<K>;
    }
  } catch (err) {
    logger.warn({ err, key }, 'config cache read failed, resolving from DB');
  }

  const resolved = await resolveFromDb(companyId, key);

  try {
    await redis.set(ck, JSON.stringify(resolved), 'EX', CACHE_TTL_SECONDS);
  } catch (err) {
    logger.warn({ err, key }, 'config cache write failed (non-fatal)');
  }

  return resolved;
}

/** Tenant-level override. Validated against the same schema `getConfig` reads with. */
export async function setCompanyConfig<K extends ConfigKey>(
  companyId: string,
  key: K,
  value: ConfigValue<K>,
): Promise<void> {
  const parsed = CONFIG_REGISTRY[key].parse(value);
  await prisma.companyConfig.upsert({
    where: { companyId_key: { companyId, key } },
    create: { companyId, key, value: parsed as Prisma.InputJsonValue },
    update: { value: parsed as Prisma.InputJsonValue },
  });
  await getClient().del(cacheKey(companyId, key)).catch(() => {});
}

/** Plan-level override, applied to every company on that plan. */
export async function setPlanConfig<K extends ConfigKey>(
  planId: string,
  key: K,
  value: ConfigValue<K>,
): Promise<void> {
  const parsed = CONFIG_REGISTRY[key].parse(value);
  await prisma.planConfig.upsert({
    where: { planId_key: { planId, key } },
    create: { planId, key, value: parsed as Prisma.InputJsonValue },
    update: { value: parsed as Prisma.InputJsonValue },
  });
}

/**
 * Every key the Zod registry declares must have a `config_defaults` row, or a
 * key can silently fall back to the schema default in a way nobody chose —
 * fine at runtime (getConfig already handles it), but a sign the seed
 * migration and the registry have drifted. Called at boot in both the API and
 * the worker process; a missing row fails the boot instead of failing silently
 * in production later.
 */
export async function assertConfigDefaultsSeeded(): Promise<void> {
  const rows = await prisma.configDefault.findMany({ select: { key: true } });
  const seeded = new Set(rows.map((r) => r.key));
  const missing = CONFIG_KEYS.filter((key) => !seeded.has(key));
  if (missing.length > 0) {
    throw new Error(
      `config_defaults is missing rows for: ${missing.join(', ')}. Add them to the seed migration (see 20260918030000_config_layer) before boot.`,
    );
  }
}
