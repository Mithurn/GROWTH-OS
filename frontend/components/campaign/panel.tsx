import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]', className)}>{children}</div>;
}

export function PanelLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-[11px] font-medium uppercase tracking-wider text-[#9CA3AF]', className)}>{children}</p>;
}

export function Stat({ icon: Icon, label, children }: { icon?: React.ComponentType<{ className?: string }>; label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-[#F9FAFB] px-3.5 py-3">
      <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[#9CA3AF]">
        {Icon && <Icon className="size-3.5" />} {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-[#1A1A1A]">{children}</dd>
    </div>
  );
}

export const alertClass = 'rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700';
export const outlineButtonClass =
  'inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-5 text-sm font-medium text-[#1A1A1A] transition-colors hover:bg-[#F3F4F6] disabled:opacity-50';
