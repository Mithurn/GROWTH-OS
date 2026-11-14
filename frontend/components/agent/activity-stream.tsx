'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { getActivityStream, getAgentRuns, getAgents } from '@/lib/api';
import { ACTIVITY_DEFAULTS, ACTIVITY_TIMING, RUN_TRACE_LIVE_STATUS } from './activity-config';
import { toActivityEntry, type ActivityEntry, type RawActivity } from './activity-model';
import { AgentActivityFeed } from './agent-activity-feed';

async function currentRun(known: readonly RawActivity[]): Promise<RawActivity | null> {
  const agentId = (await getAgents({ limit: 1 })).data?.[0]?.id;
  if (!agentId) return null;
  const run = (await getAgentRuns(agentId, { limit: 1 })).data?.[0];
  if (!run || run.status !== RUN_TRACE_LIVE_STATUS || known.some((e) => e.details?.runId === run.id)) return null;
  return {
    id: `run-${run.id}`,
    agentId,
    actionType: 'discovered_opportunity',
    description: run.goal ?? 'Working on a new pass',
    createdAt: run.startedAt,
    details: { status: RUN_TRACE_LIVE_STATUS, runId: run.id },
  };
}

export function ActivityStream({ className }: { className?: string }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await getActivityStream(ACTIVITY_DEFAULTS.pageSize);
        const raw = res.data as RawActivity[];
        const running = await currentRun(raw).catch(() => null);
        if (cancelled) return;
        setEntries((running ? [running, ...raw] : raw).map(toActivityEntry));
        setUpdatedAt(Date.now());
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
      updatedAt={updatedAt}
      limit={ACTIVITY_DEFAULTS.pageSize}
      toolbar={
        <label className="relative hidden sm:block">
          <span className="sr-only">Search activity</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="h-8 w-44 rounded-full border border-border bg-surface-inset pl-8 pr-3 text-xs text-foreground outline-none focus:border-primary"
          />
        </label>
      }
    />
  );
}
