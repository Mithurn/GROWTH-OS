import { cn } from '@/lib/utils';
import { CONFIDENCE_SEGMENTS } from './agent-config';

type ConfidenceMeterProps = {
  value: number;
  label?: string;
  className?: string;
};

export function ConfidenceMeter({ value, label = 'Confidence', className }: ConfidenceMeterProps) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  const filled = Math.round((percent / 100) * CONFIDENCE_SEGMENTS);

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn('flex items-center gap-2', className)}
    >
      <div className="flex flex-1 gap-0.5" aria-hidden>
        {Array.from({ length: CONFIDENCE_SEGMENTS }, (_, i) => (
          <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < filled ? 'bg-[#5B4FFF]' : 'bg-[#E5E7EB]')} />
        ))}
      </div>
      <span className="w-9 text-right font-mono text-[11px] tabular-nums text-[#4B5563]">{percent}%</span>
    </div>
  );
}
