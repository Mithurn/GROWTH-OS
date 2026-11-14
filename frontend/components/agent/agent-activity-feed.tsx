'use client';

import { useCallback, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, WifiOff } from 'lucide-react';
import { AiOrb } from '@/components/ui/ai-orb';
import { cn } from '@/lib/utils';
import { ACTIVITY_DEFAULTS, ACTIVITY_FALLBACK, ACTIVITY_KINDS, ACTIVITY_TIMING, type ActivityFilter, type ActivityKind, type ActivityMetrics } from './activity-config';
import { filterEntries, useFreshIds, useNow, type ActivityEntry } from './activity-model';
import { ActivityFilters } from './activity-filters';
import { ActivityRunDrawer } from './activity-run-drawer';
import { ActivityTimeline } from './activity-timeline';
import { AgentAvatar } from './agent-avatar';
import { AGENT_NAME } from './agent-config';
import { StatusPill } from './status-pill';

export type AgentActivityItem = {
  id: string;
  label: string;
  description: string;
  createdAt: string;
  icon?: LucideIcon;
  live?: boolean;
  kind?: ActivityKind;
  reasoning?: string;
  metrics?: ActivityMetrics;
};

type AgentActivityFeedProps = {
  items: readonly AgentActivityItem[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  title?: string;
  limit?: number;
  updatedAt?: number;
  filterable?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  seeAllHref?: string;
  onSeeAll?: () => void;
  toolbar?: ReactNode;
  className?: string;
};

const toEntry = (item: AgentActivityItem): ActivityEntry => ({
  ...item,
  kind: item.kind ?? ACTIVITY_FALLBACK.kind,
  icon: item.icon ?? ACTIVITY_KINDS[item.kind ?? ACTIVITY_FALLBACK.kind].icon,
});

const SEE_ALL_CLASS = 'inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline';

export function AgentActivityFeed({
  items,
  loading = false,
  error = null,
  onRetry,
  title = 'Agent activity',
  limit = ACTIVITY_DEFAULTS.dashboardLimit,
  updatedAt,
  filterable = true,
  emptyTitle = 'The agent is warming up',
  emptyHint = 'Its first pass over your customers appears here.',
  seeAllHref,
  onSeeAll,
  toolbar,
  className,
}: AgentActivityFeedProps) {
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [opened, setOpened] = useState<ActivityEntry | null>(null);
  const entries = items.map(toEntry);
  const fresh = useFreshIds(entries, !loading);
  const visible = filterEntries(entries, filter).slice(0, limit);
  const running = entries.find((e) => e.live);
  const now = useNow(ACTIVITY_TIMING.heartbeatMs, updatedAt === undefined);
  const ageSec = updatedAt === undefined ? null : Math.max(0, Math.floor((now - updatedAt) / 1000));
  const status = running ? running.description : 'Watching for new activity';
  const showSeeAll = items.length > limit && (seeAllHref || onSeeAll);
  const closeDrawer = useCallback(() => setOpened(null), []);

  return (
    <section aria-label={title} className={cn('overflow-hidden rounded-2xl border border-border bg-white', className)}>
      <header className="flex items-center gap-3 border-b border-line-soft px-4 py-3">
        <AgentAvatar size="sm" state={running ? 'working' : 'idle'} />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
            {title}
            <StatusPill tone={running ? 'live' : 'neutral'} pulse={Boolean(running)}>
              {running ? 'Running' : 'Idle'}
            </StatusPill>
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground" aria-live="polite">
            <AiOrb size="sm" state={running ? 'working' : 'breathing'} className="shrink-0" />
            <span className="sr-only">{AGENT_NAME}: </span>
            <span className="truncate">{status}</span>
          </p>
          {ageSec !== null && (
            <p className="mt-0.5 flex items-center gap-1.5 font-mono text-2xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-success motion-safe:animate-pulse" aria-hidden />
              Connected, updated {ageSec < 2 ? 'just now' : `${ageSec}s ago`}
            </p>
          )}
        </div>
        {toolbar}
        {showSeeAll &&
          (seeAllHref ? (
            <Link href={seeAllHref} className={SEE_ALL_CLASS}>
              See all <ArrowRight className="size-3" aria-hidden />
            </Link>
          ) : (
            <button type="button" onClick={onSeeAll} className={SEE_ALL_CLASS}>
              See all <ArrowRight className="size-3" aria-hidden />
            </button>
          ))}
      </header>

      {filterable && !loading && !error && items.length > 0 && (
        <div className="border-b border-line-soft px-4 py-2">
          <ActivityFilters value={filter} onChange={setFilter} />
        </div>
      )}

      <div className="p-4">
        {loading ? (
          <ul className="space-y-3" aria-hidden>
            {Array.from({ length: ACTIVITY_DEFAULTS.skeletonRows }, (_, i) => (
              <li key={i} className="flex animate-pulse gap-3">
                <span className="size-7 shrink-0 rounded-lg bg-muted" />
                <span className="h-14 flex-1 rounded-xl bg-muted" />
              </li>
            ))}
          </ul>
        ) : error ? (
          <div role="alert" className="py-8 text-center">
            <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-danger-tint text-danger">
              <WifiOff className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-medium text-foreground">Could not load activity</p>
            <p className="mt-1 text-xs text-muted-foreground">{error}</p>
            {onRetry && (
              <button type="button" onClick={onRetry} className="mt-3 rounded-full border border-border px-3 py-1 text-xs font-medium text-body hover:bg-surface-inset">
                Try again
              </button>
            )}
          </div>
        ) : visible.length === 0 ? (
          <div className="py-8 text-center">
            <span className="mx-auto flex size-10 items-center justify-center">
              <AiOrb size="md" state="breathing" />
            </span>
            <p className="mt-2 text-sm font-medium text-body">{items.length ? 'Nothing here yet' : emptyTitle}</p>
            <p className="mt-1 text-xs text-muted-foreground">{items.length ? 'Try another filter.' : emptyHint}</p>
          </div>
        ) : (
          <ActivityTimeline entries={visible} onOpen={setOpened} freshIds={fresh} />
        )}
      </div>
      {opened && <ActivityRunDrawer entry={opened} onClose={closeDrawer} />}
    </section>
  );
}
