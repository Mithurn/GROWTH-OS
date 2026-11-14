import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { AiOrb } from '@/components/ui/ai-orb';
import { cn } from '@/lib/utils';
import { PRIMARY_ACTION_CLASS, SECONDARY_ACTION_CLASS } from '@/components/ui/action-styles';

const TONES = {
  error: { icon: AlertCircle, well: 'bg-danger-tint text-danger', role: 'alert' },
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
      <h2 className="mt-5 text-lg font-semibold tracking-tight text-foreground">{title}</h2>
      {message && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{message}</p>}
      {children && <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{children}</div>}
    </div>
  );
}

export const statePanelActionClass = PRIMARY_ACTION_CLASS;

export const statePanelSecondaryClass = SECONDARY_ACTION_CLASS;
