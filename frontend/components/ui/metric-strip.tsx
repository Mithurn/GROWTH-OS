'use client';

import type { LucideIcon } from 'lucide-react';
import { useCountUp } from '@/components/campaign/hooks';
import { cn } from '@/lib/utils';
import { SURFACE_CLASS } from './surface';

const COUNT_UP_MS = 900;
const MAX_PROGRESS = 100;

const COLUMNS_BY_COUNT: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
};

export type MetricItem = {
  label: string;
  value: number;
  format?: (value: number) => string;
  icon?: LucideIcon;
  hint?: string;
  progress?: number;
  accent?: boolean;
};

const defaultFormat = (value: number) => value.toLocaleString();

function MetricCell({ label, value, format = defaultFormat, icon: Icon, hint, progress, accent = false }: MetricItem) {
  const shown = useCountUp(value, COUNT_UP_MS);
  return (
    <div
      className={cn(
        'group relative flex min-w-0 flex-col gap-3 bg-white p-4 transition-colors duration-200 sm:p-5',
        accent ? 'bg-brand-wash' : 'hover:bg-surface-inset',
      )}
    >
      <div className="flex items-center gap-2.5">
        {Icon && (
          <span
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset transition-transform duration-200 group-hover:scale-105',
              accent ? 'bg-primary text-white ring-primary/20 shadow-[0_2px_8px_-2px_rgba(91,79,255,0.5)]' : 'bg-muted text-body ring-black/[0.04]',
            )}
          >
            <Icon className="size-3.5" aria-hidden />
          </span>
        )}
        <p className="text-label font-medium leading-tight text-muted-foreground">{label}</p>
      </div>
      <p
        className={cn(
          'text-3xl font-semibold leading-none tracking-tight tabular-nums',
          accent ? 'text-primary' : 'text-foreground',
        )}
      >
        {format(shown)}
      </p>
      {progress !== undefined && (
        <div className="h-1 overflow-hidden rounded-full bg-line-soft" aria-hidden>
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.min(MAX_PROGRESS, Math.max(0, progress))}%` }}
          />
        </div>
      )}
      {hint && <p className="text-label leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function MetricStrip({ items, className }: { items: MetricItem[]; className?: string }) {
  return (
    <div
      className={cn(
        SURFACE_CLASS,
        'grid gap-px overflow-hidden bg-black/[0.06] p-px',
        COLUMNS_BY_COUNT[items.length] ?? COLUMNS_BY_COUNT[4],
        className,
      )}
    >
      {items.map((item) => (
        <MetricCell key={item.label} {...item} />
      ))}
    </div>
  );
}
