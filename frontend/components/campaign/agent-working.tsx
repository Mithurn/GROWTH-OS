'use client';

import { BotAvatar } from 'bot-avatars';
import { Check } from 'lucide-react';
import { AiOrb } from '@/components/ui/ai-orb';
import { cn } from '@/lib/utils';
import { DRAFT_STEPS, TIMING } from './config';
import { useStepProgress } from './hooks';

type AgentWorkingProps = {
  active: boolean;
  title?: string;
  className?: string;
};

export function AgentWorking({ active, title = 'Drafting your campaign', className }: AgentWorkingProps) {
  const current = useStepProgress(DRAFT_STEPS.length, active, TIMING.stepMs);
  const step = DRAFT_STEPS[Math.min(current, DRAFT_STEPS.length - 1)];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-sm', className)}
    >
      <div className="flex items-center gap-4 border-b border-border bg-gradient-to-b from-accent/70 to-card px-5 py-5">
        <BotAvatar type="pill" state={active ? 'working' : 'default'} size={56} interactive={false} />
        <div className="min-w-0 flex-1">
          <p className="ai-shimmer text-base font-semibold tracking-tight">{title}</p>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{step.label}</p>
        </div>
        <AiOrb size="lg" state={step.orb} />
      </div>
      <ol className="space-y-px bg-muted/40 p-2 font-mono text-[13px]">
        {DRAFT_STEPS.map(({ label }, i) => {
          const done = i < current;
          const running = i === current;
          return (
            <li
              key={label}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors',
                running && 'bg-card text-foreground shadow-sm',
                done && 'text-muted-foreground',
                !done && !running && 'text-muted-foreground/50',
              )}
            >
              <span
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded-full',
                  done ? 'bg-primary text-primary-foreground' : 'border border-border',
                  running && 'border-primary',
                )}
              >
                {done ? <Check className="size-2.5" aria-hidden /> : running && <span className="size-1.5 animate-pulse rounded-full bg-primary" />}
              </span>
              <span className="truncate">{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
