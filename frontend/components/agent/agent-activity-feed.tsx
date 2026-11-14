'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, WifiOff } from 'lucide-react';
import { AiOrb } from '@/components/ui/ai-orb';
import { cn } from '@/lib/utils';
import { ACTIVITY_DEFAULTS, ACTIVITY_FALLBACK, ACTIVITY_KINDS, ACTIVITY_STATUS_PHRASES, ACTIVITY_TIMING, type ActivityFilter, type ActivityKind, type ActivityMetrics } from './activity-config';
import { filterEntries, useFreshIds, useRotatingText, type ActivityEntry } from './activity-model';
import { ActivityFilters } from './activity-filters';
import { ActivityTimeline } from './activity-timeline';
import { AgentAvatar } from './agent-avatar';
import { AGENT_NAME, AGENT_STATES } from './agent-config';
import { StatusPill } from './status-pill';
import { useState } from 'react';

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
  busy?: boolean;
  error?: string | null;
  onRetry?: () => void;
  title?: string;
  limit?: number;
  statusPhrases?: readonly string[];
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

const SEE_ALL_CLASS = 'inline-flex items-center gap-1 text-xs font-medium text-[#5B4FFF] hover:underline';

export function AgentActivityFeed({
  items,
  loading = false,
  busy = false,
  error = null,
  onRetry,
  title = 'Agent activity',
  limit = ACTIVITY_DEFAULTS.dashboardLimit,
  statusPhrases = ACTIVITY_STATUS_PHRASES,
  filterable = true,
  emptyTitle = 'The agent is warming up',
  emptyHint = 'Its first pass over your customers appears here.',
  seeAllHref,
  onSeeAll,
  toolbar,
  className,
}: AgentActivityFeedProps) {
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const entries = items.map(toEntry);
  const fresh = useFreshIds(entries, !loading);
  const visible = filterEntries(entries, filter).slice(0, limit);
  const phrase = useRotatingText(statusPhrases, ACTIVITY_TIMING.statusRotateMs, !busy);
  const status = busy ? phrase : AGENT_STATES.idle.label;
  const showSeeAll = items.length > limit && (seeAllHref || onSeeAll);

  return (
    <section aria-label={title} className={cn('overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white', className)}>
      <header className="flex items-center gap-3 border-b border-[#F0F0F2] px-4 py-3">
        <AgentAvatar size="sm" state={busy ? 'working' : 'idle'} />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight text-[#1A1A1A]">
            {title}
            <StatusPill tone={busy ? 'live' : 'success'} pulse>
              {busy ? 'Working' : 'Live'}
            </StatusPill>
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-[#6B7280]" aria-live="polite">
            <AiOrb size="sm" state={busy ? 'working' : 'breathing'} className="shrink-0" />
            <span className="sr-only">{AGENT_NAME}: </span>
            <span className="truncate">{status}</span>
          </p>
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
        <div className="border-b border-[#F0F0F2] px-4 py-2">
          <ActivityFilters value={filter} onChange={setFilter} />
        </div>
      )}

      <div className="p-4">
        {loading ? (
          <ul className="space-y-3" aria-hidden>
            {Array.from({ length: ACTIVITY_DEFAULTS.skeletonRows }, (_, i) => (
              <li key={i} className="flex animate-pulse gap-3">
                <span className="size-7 shrink-0 rounded-lg bg-[#F3F4F6]" />
                <span className="h-14 flex-1 rounded-xl bg-[#F3F4F6]" />
              </li>
            ))}
          </ul>
        ) : error ? (
          <div role="alert" className="py-8 text-center">
            <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-red-50 text-red-500">
              <WifiOff className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-medium text-[#1A1A1A]">Could not load activity</p>
            <p className="mt-1 text-xs text-[#6B7280]">{error}</p>
            {onRetry && (
              <button type="button" onClick={onRetry} className="mt-3 rounded-full border border-[#E5E7EB] px-3 py-1 text-xs font-medium text-[#4B5563] hover:bg-[#F7F7FB]">
                Try again
              </button>
            )}
          </div>
        ) : visible.length === 0 ? (
          <div className="py-8 text-center">
            <span className="mx-auto flex size-10 items-center justify-center">
              <AiOrb size="md" state="breathing" />
            </span>
            <p className="mt-2 text-sm font-medium text-[#4B5563]">{items.length ? 'Nothing here yet' : emptyTitle}</p>
            <p className="mt-1 text-xs text-[#9CA3AF]">{items.length ? 'Try another filter.' : emptyHint}</p>
          </div>
        ) : (
          <ActivityTimeline entries={visible} busy={busy} freshIds={fresh} />
        )}
      </div>
    </section>
  );
}
