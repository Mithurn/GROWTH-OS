import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase sends `.in()` filters as URL query parameters, so a long id list overflows
 * the server's URL length limit. Anything derived from a full customer or order list
 * has to be requested in batches.
 */
const IN_CHUNK_SIZE = 200;

/**
 * Fetch `columns` from `table` where `column` matches any of `values`, batching the
 * `.in()` filter so it cannot exceed Supabase's URL length limit.
 *
 * This is how per-tenant scoping is enforced on tables that carry no `company_id` of
 * their own — `orders`, `order_items`, `customer_metrics`, `customer_attributes`.
 * Their tenant is implied by the customer (or order) they belong to, so the caller
 * passes ids already filtered to one company.
 */
export async function selectIn<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  column: string,
  values: string[],
): Promise<T[]> {
  if (values.length === 0) return [];

  const batches: string[][] = [];
  for (let i = 0; i < values.length; i += IN_CHUNK_SIZE) {
    batches.push(values.slice(i, i + IN_CHUNK_SIZE));
  }

  const results = await Promise.all(
    batches.map(async (batch) => {
      const { data, error } = await supabase
        .from(table)
        .select(columns)
        .in(column, batch);

      if (error) {
        throw new Error(`Failed to load ${table}: ${error.message}`);
      }

      return (data ?? []) as T[];
    }),
  );

  return results.flat();
}

/** Supabase pages at 1,000 rows. Walk pages up to `max` so a large tenant cannot OOM. */
const PAGE_SIZE = 1000;
export const MAX_CUSTOMER_READ = 5_000;

export async function selectPaged<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  filters: (query: any) => any,
  max = MAX_CUSTOMER_READ,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; from < max; from += PAGE_SIZE) {
    const to = Math.min(from + PAGE_SIZE - 1, max - 1);
    const { data, error } = await filters(supabase.from(table).select(columns)).range(from, to);

    if (error) {
      throw new Error(`Failed to load ${table}: ${error.message}`);
    }

    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}
