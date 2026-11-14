'use client';

import { AiOrb, type AiOrbSize, type AiOrbState } from '@/components/ui/ai-orb';
import { useCyclingIndex } from '@/lib/use-cycling-index';
import { cn } from '@/lib/utils';

type AiLoaderProps = {
  title: string;
  steps?: readonly string[];
  stepIntervalMs?: number;
  size?: AiOrbSize;
  state?: AiOrbState;
  className?: string;
};

export function AiLoader({ title, steps = [], stepIntervalMs, size = 'lg', state, className }: AiLoaderProps) {
  const stepIndex = useCyclingIndex(steps.length, stepIntervalMs);

  return (
    <div role="status" aria-live="polite" className={cn('flex flex-col items-center gap-5 text-center', className)}>
      <AiOrb size={size} state={state} />
      <div className="space-y-1.5">
        <p className="ai-shimmer text-base font-semibold">{title}</p>
        {steps.length > 0 && (
          <p key={stepIndex} className="ai-step-in text-sm text-muted-foreground">
            {steps[stepIndex]}
          </p>
        )}
      </div>
    </div>
  );
}
