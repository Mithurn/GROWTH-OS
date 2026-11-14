import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ConsoleCardProps = {
  children: ReactNode;
  glow?: boolean;
  className?: string;
};

export function ConsoleCard({ children, glow, className }: ConsoleCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/10 bg-ink-raised text-zinc-100 shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_20px_50px_-24px_rgba(24,16,96,0.6)]',
        className,
      )}
    >
      {glow && (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-3/4 -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl"
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

export function ConsoleLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-2xs font-medium text-zinc-500', className)}>{children}</p>;
}

export function Segments({ value, count, label }: { value: number; count: number; label: string }) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  const filled = Math.round((percent / 100) * count);
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="flex items-center gap-2">
      <div className="flex flex-1 gap-0.5" aria-hidden>
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < filled ? 'bg-indigo-400' : 'bg-white/10')} />
        ))}
      </div>
      <span className="w-9 text-right font-mono text-2xs tabular-nums text-zinc-400">{percent}%</span>
    </div>
  );
}
