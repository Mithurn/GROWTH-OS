'use client';

import { cn } from '@/lib/utils';
import { ACTIVITY_FILTERS, type ActivityFilter } from './activity-config';

type ActivityFiltersProps = {
  value: ActivityFilter;
  onChange: (filter: ActivityFilter) => void;
  className?: string;
};

export function ActivityFilters({ value, onChange, className }: ActivityFiltersProps) {
  return (
    <div role="group" aria-label="Filter activity" className={cn('flex flex-wrap gap-1.5', className)}>
      {ACTIVITY_FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          aria-pressed={value === f.id}
          onClick={() => onChange(f.id)}
          className={cn(
            'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary',
            value === f.id ? 'border-primary bg-primary text-white' : 'border-border bg-white text-body hover:bg-surface-inset',
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
