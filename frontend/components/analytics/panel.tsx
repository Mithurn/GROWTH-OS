import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { SURFACE_CLASS } from '@/components/ui/surface';

type PanelProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Panel({ title, description, action, children, className }: PanelProps) {
  return (
    <section className={cn(SURFACE_CLASS, 'flex min-w-0 flex-col p-5', className)}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-label text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function ChartEmpty({ message, height }: { message: string; height: number }) {
  return (
    <div className="flex items-center justify-center rounded-xl bg-surface-inset text-sm text-muted-foreground" style={{ height }}>
      {message}
    </div>
  );
}
