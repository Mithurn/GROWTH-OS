import type { LucideIcon } from 'lucide-react';
import { Activity } from 'lucide-react';
import { AiOrb } from '@/components/ui/ai-orb';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ACTIVITY_DEFAULTS } from './agent-config';
import { StatusPill } from './status-pill';

export type AgentActivityItem = {
  id: string;
  label: string;
  description: string;
  createdAt: string;
  icon?: LucideIcon;
  live?: boolean;
};

type AgentActivityFeedProps = {
  items: readonly AgentActivityItem[];
  loading?: boolean;
  busy?: boolean;
  title?: string;
  limit?: number;
  emptyTitle?: string;
  emptyHint?: string;
  onSeeAll?: () => void;
  className?: string;
};

export function AgentActivityFeed({
  items,
  loading = false,
  busy = false,
  title = 'Agent activity',
  limit = ACTIVITY_DEFAULTS.limit,
  emptyTitle = 'The agent is warming up',
  emptyHint = 'Its first pass over your customers appears here.',
  onSeeAll,
  className,
}: AgentActivityFeedProps) {
  return (
    <section aria-label={title} className={cn('rounded-2xl border border-[#E5E7EB] bg-white', className)}>
      <header className="flex items-center justify-between gap-2 border-b border-[#F0F0F2] px-4 py-3">
        <div className="flex items-center gap-2">
          <AiOrb size="sm" state={busy ? 'working' : 'breathing'} />
          <h2 className="text-sm font-semibold tracking-tight text-[#1A1A1A]">{title}</h2>
          <StatusPill tone={busy ? 'live' : 'success'} pulse>
            {busy ? 'Working' : 'Live'}
          </StatusPill>
        </div>
        {onSeeAll && items.length > limit && (
          <button type="button" onClick={onSeeAll} className="text-xs font-medium text-[#5B4FFF] hover:underline">
            View log
          </button>
        )}
      </header>

      {loading ? (
        <ul className="space-y-3 p-4" aria-hidden>
          {Array.from({ length: ACTIVITY_DEFAULTS.skeletonRows }, (_, i) => (
            <li key={i} className="flex animate-pulse gap-3">
              <span className="size-7 shrink-0 rounded-lg bg-[#F3F4F6]" />
              <span className="flex-1 space-y-2 pt-1">
                <span className="block h-2 w-1/4 rounded bg-[#F3F4F6]" />
                <span className="block h-3 w-full rounded bg-[#F3F4F6]" />
              </span>
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm font-medium text-[#4B5563]">{emptyTitle}</p>
          <p className="mt-1 text-xs text-[#9CA3AF]">{emptyHint}</p>
        </div>
      ) : (
        <ol className="relative p-4">
          <span className="absolute bottom-6 left-[29px] top-6 w-px bg-[#EEEEF2]" aria-hidden />
          {items.slice(0, limit).map((item) => {
            const Icon = item.icon ?? Activity;
            return (
              <li key={item.id} className="ai-step-in relative flex gap-3 pb-4 last:pb-0">
                <span
                  className={cn(
                    'relative z-10 flex size-7 shrink-0 items-center justify-center rounded-lg border bg-white',
                    item.live ? 'border-[#C7D2FE] text-[#5B4FFF]' : 'border-[#E5E7EB] text-[#6B7280]',
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-wider text-[#9CA3AF]">
                    <span className={cn(item.live && 'text-[#5B4FFF]')}>{item.label}</span>
                    <span className="font-mono normal-case tracking-normal">{timeAgo(item.createdAt)}</span>
                  </p>
                  <p className="mt-0.5 text-[13px] leading-snug text-[#1A1A1A]">{item.description}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
