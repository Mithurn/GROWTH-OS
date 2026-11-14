import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { SURFACE_CLASS } from '@/components/ui/surface';
import { SECONDARY_ACTION_CLASS } from '@/components/ui/action-styles';

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(SURFACE_CLASS, className)}>{children}</div>;
}

export function PanelLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-label font-medium tracking-tight text-muted-foreground', className)}>{children}</p>;
}

export function Stat({ icon: Icon, label, children }: { icon?: React.ComponentType<{ className?: string }>; label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-inset px-3.5 py-3">
      <dt className="flex items-center gap-1.5 text-label font-medium text-muted-foreground">
        {Icon && <Icon className="size-3.5" />} {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-foreground">{children}</dd>
    </div>
  );
}

export const alertClass = 'rounded-lg border border-danger/20 bg-danger-tint px-3 py-2 text-sm text-danger';
export const outlineButtonClass = SECONDARY_ACTION_CLASS;
