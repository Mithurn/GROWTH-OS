'use client';

import { useId, useState } from 'react';
import { BorderBeam } from 'border-beam';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { ACTIVITY_KINDS, ACTIVITY_TIMING } from './activity-config';
import { groupByDay, type ActivityEntry } from './activity-model';

type ActivityTimelineProps = {
  entries: readonly ActivityEntry[];
  onOpen?: (entry: ActivityEntry) => void;
  freshIds?: ReadonlySet<string>;
  className?: string;
};

export function ActivityTimeline({ entries, onOpen, freshIds, className }: ActivityTimelineProps) {
  const groups = groupByDay(entries);

  return (
    <div className={cn('space-y-5', className)}>
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h3 className="mb-2 flex items-center gap-2 text-2xs font-medium text-muted-foreground">
            {group.label}
            <span className="h-px flex-1 bg-line-soft" aria-hidden />
          </h3>
          <ol>
            {group.entries.map((entry, i) => (
              <TimelineRow
                key={entry.id}
                entry={entry}
                last={i === group.entries.length - 1}
                onOpen={onOpen}
                fresh={freshIds?.has(entry.id) ?? false}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

type TimelineRowProps = { entry: ActivityEntry; last: boolean; onOpen?: (entry: ActivityEntry) => void; fresh: boolean };

function TimelineRow({ entry, last, onOpen, fresh }: TimelineRowProps) {
  const live = Boolean(entry.live);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const reduced = useReducedMotion();
  const meta = ACTIVITY_KINDS[entry.kind];
  const Icon = entry.icon;
  const openable = Boolean(onOpen && (entry.runId || entry.live));
  const expandable = !openable && Boolean(entry.reasoning || entry.metrics);
  const interactive = openable || expandable;

  const card = (
    <div className="rounded-xl border border-line-soft bg-white transition-colors hover:border-brand-line hover:shadow-sm">
      <button
        type="button"
        disabled={!interactive}
        aria-expanded={expandable ? open : undefined}
        aria-controls={expandable ? panelId : undefined}
        aria-haspopup={openable ? 'dialog' : undefined}
        onClick={() => (openable ? onOpen?.(entry) : setOpen((v) => !v))}
        className="flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2 text-2xs font-medium">
            <span className={cn('flex items-center gap-1.5', meta.text)}>
              {entry.label}
              {live && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint px-1.5 py-px text-2xs text-primary-hover">
                  <span className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse" aria-hidden />
                  Running
                </span>
              )}
            </span>
            <time dateTime={entry.createdAt} title={new Date(entry.createdAt).toLocaleString()} className="font-mono text-muted-foreground">
              {timeAgo(entry.createdAt)}
            </time>
          </span>
          <span className="mt-0.5 block text-label leading-snug text-foreground">{entry.description}</span>
        </span>
        {openable && <ChevronRight className="mt-4 size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
        {expandable && (
          <ChevronDown className={cn('mt-4 size-3.5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none', open && 'rotate-180')} aria-hidden />
        )}
      </button>
      {expandable && (
        <div
          id={panelId}
          className={cn('grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
        >
          <div className="overflow-hidden">
            <div className="space-y-2.5 border-t border-line-soft px-3 py-2.5">
              {entry.reasoning && (
                <p className="text-xs leading-relaxed text-body">
                  <span className="font-medium text-foreground">Why: </span>
                  {entry.reasoning}
                </p>
              )}
              {entry.metrics && (
                <dl className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {Object.entries(entry.metrics).map(([key, value]) => (
                    <div key={key} className="rounded-lg bg-surface-inset px-2 py-1.5">
                      <dt className="text-2xs text-muted-foreground">{key}</dt>
                      <dd className="font-mono text-xs font-semibold text-foreground">{value}</dd>
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
      {!last && <span className="absolute bottom-0 left-[13px] top-8 w-px bg-border" aria-hidden />}
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
