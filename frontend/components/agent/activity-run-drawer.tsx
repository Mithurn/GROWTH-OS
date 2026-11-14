'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/format';
import { ACTIVITY_KINDS, ACTIVITY_TIMING } from './activity-config';
import type { ActivityEntry } from './activity-model';
import { isRunning, useRunTrace } from './activity-run-model';
import { RunTraceBody, RunTraceHeader } from './activity-run-trace';

type ActivityRunDrawerProps = { entry: ActivityEntry; onClose: () => void };

export function ActivityRunDrawer({ entry, onClose }: ActivityRunDrawerProps) {
  const { run, state } = useRunTrace({ runId: entry.runId, agentId: entry.agentId });
  const [shown, setShown] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const meta = ACTIVITY_KINDS[entry.kind];

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Run trace: ${entry.label}`}>
      <button
        type="button"
        aria-label="Close run trace"
        tabIndex={-1}
        onClick={onClose}
        className={cn('absolute inset-0 bg-black/40 transition-opacity duration-300 motion-reduce:transition-none', shown ? 'opacity-100' : 'opacity-0')}
      />
      <aside
        className={cn(
          'absolute inset-y-0 right-0 flex w-full max-w-[520px] flex-col border-l border-white/10 bg-ink-raised text-white shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none',
          shown ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <header className="flex items-start gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0 flex-1">
            <RunTraceHeader run={run} state={state} title={entry.label} />
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-300">
            <X className="size-4" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-3 border-b border-white/10 px-4 py-4 font-sans">
            <p className="text-2xs font-medium text-indigo-300">
              {meta.label} <span className="ml-1 text-white/40">{timeAgo(entry.createdAt)}</span>
            </p>
            <p className="text-sm leading-snug text-white/90">{entry.live ? ((isRunning(run) ? run?.goal : run?.summary) ?? entry.description) : entry.description}</p>
            {entry.reasoning && <p className="text-xs leading-relaxed text-white/55">{entry.reasoning}</p>}
            {entry.metrics && (
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(entry.metrics).map(([key, value]) => (
                  <div key={key} className="rounded-lg bg-white/[0.05] px-2 py-1.5">
                    <dt className="text-2xs text-white/40">{key}</dt>
                    <dd className="font-mono text-xs font-semibold text-white">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <RunTraceBody run={run} state={state} />
        </div>
        <footer className="border-t border-white/10 px-4 py-2 font-mono text-2xs text-white/40">
          {run?.status === 'running' ? `Streaming, refreshed every ${(ACTIVITY_TIMING.runPollMs / 1000).toFixed(1)}s` : 'Run complete'}
        </footer>
      </aside>
    </div>
  );
}
