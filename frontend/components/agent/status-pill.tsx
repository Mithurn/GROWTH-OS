import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { STATUS_TONES, type StatusTone } from './agent-config';

type StatusPillProps = {
  tone?: StatusTone;
  pulse?: boolean;
  children: ReactNode;
  className?: string;
};

export function StatusPill({ tone = 'neutral', pulse = false, children, className }: StatusPillProps) {
  const { dot, chip } = STATUS_TONES[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5',
        chip,
        className,
      )}
    >
      <span className="relative flex size-1.5">
        {pulse && <span className={cn('absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping', dot)} />}
        <span className={cn('relative inline-flex size-1.5 rounded-full', dot)} />
      </span>
      {children}
    </span>
  );
}
