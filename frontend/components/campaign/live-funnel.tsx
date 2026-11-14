import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FUNNEL_STAGES, formatNumber } from './config';
import { ConsoleLabel } from './console';

export type FunnelCounts = {
  targeted: number;
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
  failed: number;
};

type LiveFunnelProps = {
  counts: FunnelCounts;
  live?: boolean;
  heading?: string;
  className?: string;
};

const MIN_BAR_PCT = 2;

export function LiveFunnel({ counts, live, heading = 'Delivery funnel', className }: LiveFunnelProps) {
  const base = counts.targeted || counts.sent || 1;

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <ConsoleLabel>{heading}</ConsoleLabel>
        {live && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
            </span>
            Live
          </span>
        )}
      </div>
      <ul className="space-y-3">
        {FUNNEL_STAGES.map(({ key, label }, i) => {
          const value = counts[key];
          const prev = i === 0 ? base : counts[FUNNEL_STAGES[i - 1].key];
          const pct = Math.max(MIN_BAR_PCT, Math.round((value / base) * 100));
          const rate = prev ? Math.round((value / prev) * 100) : 0;
          return (
            <li key={key}>
              <div className="mb-1.5 flex items-baseline justify-between text-sm">
                <span className="text-zinc-400">{label}</span>
                <span className="flex items-baseline gap-2">
                  {i > 0 && <span className="font-mono text-[11px] tabular-nums text-zinc-500">{rate}%</span>}
                  <span className="font-semibold tabular-nums text-white">{formatNumber(value)}</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400 shadow-[0_0_12px_rgba(129,140,248,0.6)] transition-[width] duration-700 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {counts.failed > 0 && (
        <p className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-300">
          <AlertTriangle className="size-3.5" aria-hidden />
          {formatNumber(counts.failed)} failed to deliver
        </p>
      )}
    </div>
  );
}
