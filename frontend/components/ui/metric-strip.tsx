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
        accent ? 'bg-gradient-to-br from-[#F4F2FF] via-white to-white' : 'hover:bg-[#FAFAFB]',
      )}
    >
      <div className="flex items-center gap-2.5">
        {Icon && (
          <span
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset transition-transform duration-200 group-hover:scale-105',
              accent ? 'bg-[#5B4FFF] text-white ring-[#5B4FFF]/20 shadow-[0_2px_8px_-2px_rgba(91,79,255,0.5)]' : 'bg-[#F4F4F5] text-[#52525B] ring-black/[0.04]',
            )}
          >
            <Icon className="size-3.5" aria-hidden />
          </span>
        )}
        <p className="text-[13px] font-medium leading-tight text-[#6B7280]">{label}</p>
      </div>
      <p
        className={cn(
          'text-[30px] font-semibold leading-none tracking-tight tabular-nums',
          accent ? 'bg-gradient-to-br from-[#4338CA] to-[#7C6AFF] bg-clip-text text-transparent' : 'text-[#111827]',
        )}
      >
        {format(shown)}
      </p>
      {progress !== undefined && (
        <div className="h-1 overflow-hidden rounded-full bg-[#EEF0F4]" aria-hidden>
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#5B4FFF] to-[#8B7CFF]"
            style={{ width: `${Math.min(MAX_PROGRESS, Math.max(0, progress))}%` }}
          />
        </div>
      )}
      {hint && <p className="text-[13px] leading-snug text-[#6B7280]">{hint}</p>}
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
