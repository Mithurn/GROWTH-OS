import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { AiOrb } from '@/components/ui/ai-orb';
import { cn } from '@/lib/utils';

const TONES = {
  error: { icon: AlertCircle, well: 'bg-red-50 text-red-500', role: 'alert' },
  empty: { icon: null, well: '', role: undefined },
} as const;

type StatePanelProps = {
  tone: keyof typeof TONES;
  title: string;
  message?: string;
  children?: ReactNode;
  className?: string;
};

export function StatePanel({ tone, title, message, children, className }: StatePanelProps) {
  const { icon: Icon, well, role } = TONES[tone];

  return (
    <div role={role} className={cn('mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center', className)}>
      {Icon ? (
        <span className={cn('flex size-12 items-center justify-center rounded-2xl', well)}>
          <Icon className="size-6" aria-hidden />
        </span>
      ) : (
        <AiOrb size="lg" state="breathing" />
      )}
      <h2 className="mt-5 text-lg font-semibold tracking-tight text-[#1A1A1A]">{title}</h2>
      {message && <p className="mt-1.5 text-sm leading-relaxed text-[#6B7280]">{message}</p>}
      {children && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{children}</div>}
    </div>
  );
}

export const statePanelActionClass =
  'inline-flex items-center gap-2 rounded-xl bg-[#5B4FFF] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4B3FE5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B4FFF]';

export const statePanelSecondaryClass =
  'inline-flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#1A1A1A] transition-colors hover:bg-[#F3F4F6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B4FFF]';
