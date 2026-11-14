import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type MetricTileProps = {
  label: string;
  value: string;
  icon?: LucideIcon;
  hint?: string;
  accent?: boolean;
  className?: string;
};

export function MetricTile({ label, value, icon: Icon, hint, accent = false, className }: MetricTileProps) {
  return (
    <div className={cn('rounded-xl border border-[#E5E7EB] bg-white px-4 py-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-[#9CA3AF]">{label}</p>
        {Icon && <Icon className="size-3.5 text-[#9CA3AF]" aria-hidden />}
      </div>
      <p className={cn('mt-1 font-mono text-xl font-semibold tabular-nums', accent ? 'text-[#5B4FFF]' : 'text-[#1A1A1A]')}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[#9CA3AF]">{hint}</p>}
    </div>
  );
}
