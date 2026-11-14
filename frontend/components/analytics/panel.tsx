import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PanelProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Panel({ title, description, action, children, className }: PanelProps) {
  return (
    <section className={cn('flex min-w-0 flex-col rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]', className)}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-[#111827]">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-[#6B7280]">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function ChartEmpty({ message, height }: { message: string; height: number }) {
  return (
    <div className="flex items-center justify-center rounded-xl bg-[#F9FAFB] text-sm text-[#6B7280]" style={{ height }}>
      {message}
    </div>
  );
}
