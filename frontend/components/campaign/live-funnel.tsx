import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FUNNEL_STAGES, formatNumber } from './config';

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

export function LiveFunnel({ counts, live, heading, className }: LiveFunnelProps) {
  const base = counts.targeted || counts.sent || 1;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium uppercase tracking-wider">{heading}</span>
        {live && (
          <span className="flex items-center gap-1.5 font-medium text-primary">
            <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden /> Live
          </span>
        )}
      </div>
      <ul className="space-y-2.5">
        {FUNNEL_STAGES.map(({ key, label }, i) => {
          const value = counts[key];
          const prev = i === 0 ? base : counts[FUNNEL_STAGES[i - 1].key];
          const pct = Math.max(MIN_BAR_PCT, Math.round((value / base) * 100));
          const rate = prev ? Math.round((value / prev) * 100) : 0;
          return (
            <li key={key}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span className="flex items-baseline gap-2">
                  {i > 0 && <span className="text-[11px] tabular-nums text-muted-foreground">{rate}%</span>}
                  <span className="font-semibold tabular-nums">{formatNumber(value)}</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
                  style={{ width: `${pct}%`, opacity: 1 - i * 0.18 }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {counts.failed > 0 && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
          <AlertTriangle className="size-3.5" aria-hidden />
          {formatNumber(counts.failed)} failed to deliver
        </p>
      )}
    </div>
  );
}
