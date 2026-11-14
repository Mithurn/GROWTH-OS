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
    <div className={cn('flex flex-col rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-[#6B7280]">{label}</p>
        {Icon && (
          <span className={cn('flex size-7 items-center justify-center rounded-lg', accent ? 'bg-[#EEF2FF] text-[#5B4FFF]' : 'bg-[#F4F4F5] text-[#6B7280]')}>
            <Icon className="size-3.5" aria-hidden />
          </span>
        )}
      </div>
      <p className={cn('mt-3 text-[28px] font-semibold leading-none tracking-tight tabular-nums', accent ? 'text-[#5B4FFF]' : 'text-[#111827]')}>{value}</p>
      {hint && <p className="mt-2 text-[13px] leading-snug text-[#6B7280]">{hint}</p>}
    </div>
  );
}
