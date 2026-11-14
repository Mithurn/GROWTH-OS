import { cn } from '@/lib/utils';
import { STATUS_LABEL, STATUS_TONE, STATUS_TONE_DARK } from './config';

type StatusBadgeProps = {
  status: string;
  dark?: boolean;
  className?: string;
};

export function StatusBadge({ status, dark, className }: StatusBadgeProps) {
  const tones = dark ? STATUS_TONE_DARK : STATUS_TONE;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        tones[status] ?? tones.Completed,
        className,
      )}
    >
      {status === 'Launched' && <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />}
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
