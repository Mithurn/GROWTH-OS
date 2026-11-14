'use client';

import { useId, useState } from 'react';
import { BorderBeam } from 'border-beam';
import { ChevronDown } from 'lucide-react';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { ACTIVITY_KINDS, ACTIVITY_TIMING } from './activity-config';
import { groupByDay, isLive, type ActivityEntry } from './activity-model';

type ActivityTimelineProps = {
  entries: readonly ActivityEntry[];
  busy?: boolean;
  freshIds?: ReadonlySet<string>;
  className?: string;
};

export function ActivityTimeline({ entries, busy = false, freshIds, className }: ActivityTimelineProps) {
  const groups = groupByDay(entries);
  const newestId = entries[0]?.id;

  return (
    <div className={cn('space-y-5', className)}>
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h3 className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-[#9CA3AF]">
            {group.label}
            <span className="h-px flex-1 bg-[#EEEEF2]" aria-hidden />
          </h3>
          <ol>
            {group.entries.map((entry, i) => (
              <TimelineRow
                key={entry.id}
                entry={entry}
                last={i === group.entries.length - 1}
                live={isLive(entry, entry.id === newestId, busy)}
                fresh={freshIds?.has(entry.id) ?? false}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

type TimelineRowProps = { entry: ActivityEntry; last: boolean; live: boolean; fresh: boolean };

function TimelineRow({ entry, last, live, fresh }: TimelineRowProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const reduced = useReducedMotion();
  const meta = ACTIVITY_KINDS[entry.kind];
  const Icon = entry.icon;
  const expandable = Boolean(entry.reasoning || entry.metrics);

  const card = (
    <div className="rounded-xl border border-[#EEEEF2] bg-white transition-colors hover:border-[#DCDFF5]">
      <button
        type="button"
        disabled={!expandable}
        aria-expanded={expandable ? open : undefined}
        aria-controls={expandable ? panelId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-[#5B4FFF] disabled:cursor-default"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2 text-[11px] font-medium uppercase tracking-wider">
            <span className={cn('flex items-center gap-1.5', meta.text)}>
              {entry.label}
              {live && <span className="rounded-full bg-[#EEF2FF] px-1.5 py-px text-[10px] normal-case tracking-normal text-[#4B3FE5]">live</span>}
            </span>
            <time dateTime={entry.createdAt} title={new Date(entry.createdAt).toLocaleString()} className="font-mono normal-case tracking-normal text-[#9CA3AF]">
              {timeAgo(entry.createdAt)}
            </time>
          </span>
          <span className="mt-0.5 block text-[13px] leading-snug text-[#1A1A1A]">{entry.description}</span>
        </span>
        {expandable && (
          <ChevronDown className={cn('mt-4 size-3.5 shrink-0 text-[#9CA3AF] transition-transform motion-reduce:transition-none', open && 'rotate-180')} aria-hidden />
        )}
      </button>
      {expandable && (
        <div
          id={panelId}
          className={cn('grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
        >
          <div className="overflow-hidden">
            <div className="space-y-2.5 border-t border-[#F0F0F2] px-3 py-2.5">
              {entry.reasoning && (
                <p className="text-xs leading-relaxed text-[#4B5563]">
                  <span className="font-medium text-[#1A1A1A]">Why: </span>
                  {entry.reasoning}
                </p>
              )}
              {entry.metrics && (
                <dl className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {Object.entries(entry.metrics).map(([key, value]) => (
                    <div key={key} className="rounded-lg bg-[#F7F7FB] px-2 py-1.5">
                      <dt className="text-[10px] uppercase tracking-wider text-[#9CA3AF]">{key}</dt>
                      <dd className="font-mono text-xs font-semibold text-[#1A1A1A]">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <li className={cn('relative flex gap-3 pb-2.5', fresh && 'ai-step-in')}>
      {!last && <span className="absolute bottom-0 left-[13px] top-8 w-px bg-[#E5E7EB]" aria-hidden />}
      <span className={cn('relative z-10 mt-2 flex size-7 shrink-0 items-center justify-center rounded-lg border', meta.node, meta.text)}>
        <Icon className="size-3.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        {live && !reduced ? (
          <BorderBeam size="md" colorVariant="ocean" theme="light" strength={ACTIVITY_TIMING.beamStrength}>
            {card}
          </BorderBeam>
        ) : (
          card
        )}
      </div>
    </li>
  );
}
