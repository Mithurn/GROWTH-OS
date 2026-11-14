import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FUNNEL_STAGES, formatNumber } from './config';
import { ConsoleLabel } from './console';
import { PanelLabel } from './panel';

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
  light?: boolean;
  heading?: string;
  className?: string;
};

const MIN_BAR_PCT = 2;

const TONE = {
  dark: {
    live: 'text-emerald-400',
    label: 'text-zinc-400',
    rate: 'text-zinc-500',
    value: 'text-white',
    track: 'bg-white/10',
    bar: 'bg-gradient-to-r from-indigo-500 to-violet-400 shadow-[0_0_12px_rgba(129,140,248,0.6)]',
    fail: 'border-red-500/20 bg-red-500/10 text-red-300',
  },
  light: {
    live: 'text-emerald-600',
    label: 'text-[#6B7280]',
    rate: 'text-[#9CA3AF]',
    value: 'text-[#1A1A1A]',
    track: 'bg-[#EEF0F4]',
    bar: 'bg-gradient-to-r from-[#5B4FFF] to-[#8B7CFF]',
    fail: 'border-red-200 bg-red-50 text-red-700',
  },
} as const;

export function LiveFunnel({ counts, live, light, heading = 'Delivery funnel', className }: LiveFunnelProps) {
  const t = TONE[light ? 'light' : 'dark'];
  const base = counts.targeted || counts.sent || 1;

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        {light ? <PanelLabel>{heading}</PanelLabel> : <ConsoleLabel>{heading}</ConsoleLabel>}
        {live && (
          <span className={cn('flex items-center gap-1.5 text-xs font-medium', t.live)}>
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
                <span className={t.label}>{label}</span>
                <span className="flex items-baseline gap-2">
                  {i > 0 && <span className={cn('text-[11px] tabular-nums', t.rate)}>{rate}%</span>}
                  <span className={cn('font-semibold tabular-nums', t.value)}>{formatNumber(value)}</span>
                </span>
              </div>
              <div className={cn('h-1.5 overflow-hidden rounded-full', t.track)}>
                <div
                  className={cn('h-full rounded-full transition-[width] duration-700 ease-out', t.bar)}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {counts.failed > 0 && (
        <p className={cn('flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs', t.fail)}>
          <AlertTriangle className="size-3.5" aria-hidden />
          {formatNumber(counts.failed)} failed to deliver
        </p>
      )}
    </div>
  );
}
