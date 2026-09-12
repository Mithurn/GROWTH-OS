'use client';

import { useEffect } from 'react';
import { BACKEND_ORIGIN } from '@/lib/api';

/**
 * Fire-and-forget wake-up for the Render backend on landing-page view.
 *
 * The keep-alive cron should already be holding the instance warm; this covers the gap
 * if a deploy or a missed cron run left it spun down, so that by the time a visitor
 * finishes reading the page and clicks through, the API is answering.
 */
export function BackendWarmup() {
  useEffect(() => {
    fetch(`${BACKEND_ORIGIN}/health`, { cache: 'no-store' }).catch(() => {});
  }, []);

  return null;
}
