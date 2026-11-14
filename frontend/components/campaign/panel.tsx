import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { SURFACE_CLASS } from '@/components/ui/surface';

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(SURFACE_CLASS, className)}>{children}</div>;
}

export function PanelLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-[13px] font-medium tracking-tight text-[#6B7280]', className)}>{children}</p>;
}

export function Stat({ icon: Icon, label, children }: { icon?: React.ComponentType<{ className?: string }>; label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-[#F7F7F9] px-3.5 py-3 ring-1 ring-inset ring-black/[0.04]">
      <dt className="flex items-center gap-1.5 text-[13px] font-medium text-[#6B7280]">
        {Icon && <Icon className="size-3.5" />} {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-[#1A1A1A]">{children}</dd>
    </div>
  );
}

export const alertClass = 'rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700';
export const outlineButtonClass =
  'inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-5 text-sm font-medium text-[#1A1A1A] transition-colors hover:bg-[#F3F4F6] disabled:opacity-50';
