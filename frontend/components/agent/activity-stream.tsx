'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { getActivityStream } from '@/lib/api';
import { ACTIVITY_DEFAULTS, ACTIVITY_TIMING } from './activity-config';
import { toActivityEntry, type ActivityEntry, type RawActivity } from './activity-model';
import { AgentActivityFeed } from './agent-activity-feed';

export function ActivityStream({ className }: { className?: string }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await getActivityStream(ACTIVITY_DEFAULTS.pageSize);
        if (cancelled) return;
        setEntries((res.data as RawActivity[]).map(toActivityEntry));
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to fetch activity stream');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, ACTIVITY_TIMING.pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [attempt]);

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? entries.filter((e) => `${e.label} ${e.description} ${e.reasoning ?? ''}`.toLowerCase().includes(needle))
    : entries;

  return (
    <AgentActivityFeed
      className={className}
      title="Activity"
      items={shown}
      loading={loading}
      error={entries.length ? null : error}
      onRetry={() => setAttempt((a) => a + 1)}
      busy
      limit={ACTIVITY_DEFAULTS.pageSize}
      toolbar={
        <label className="relative hidden sm:block">
          <span className="sr-only">Search activity</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#9CA3AF]" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="h-8 w-44 rounded-full border border-[#E5E7EB] bg-[#F7F7FB] pl-8 pr-3 text-xs text-[#1A1A1A] outline-none focus:border-[#5B4FFF]"
          />
        </label>
      }
    />
  );
}
