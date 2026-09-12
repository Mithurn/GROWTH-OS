import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

/**
 * Shared Supabase client.
 *
 * Uses the **service role key**, which bypasses row-level security entirely. Nothing
 * this client reads or writes is filtered by Postgres, so every route is responsible
 * for its own tenant scoping — see `requireCompanyOwnership` and the `company_id`
 * filters in the services.
 *
 * `ws` is injected for realtime because Node has no global WebSocket on the versions
 * this deploys to.
 */
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    realtime: {
      transport: WebSocket as any,
    },
  },
);
