import { cn } from '@/lib/utils';
import { STATUS_LABEL, STATUS_TONE } from './config';

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        STATUS_TONE[status] ?? STATUS_TONE.Completed,
        className,
      )}
    >
      {status === 'Launched' && <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden />}
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
