'use client';

import { BotAvatar } from 'bot-avatars';
import { BorderBeam } from 'border-beam';
import { Check } from 'lucide-react';
import { AiOrb } from '@/components/ui/ai-orb';
import { cn } from '@/lib/utils';
import { ConsoleCard } from './console';
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
    <div role="status" aria-live="polite" className={cn('mx-auto w-full max-w-xl', className)}>
      <BorderBeam size="md" theme="dark" colorVariant="ocean" strength={0.9}>
        <ConsoleCard glow>
          <div className="flex items-center gap-4 border-b border-white/10 px-5 py-5">
            <BotAvatar type="pill" state={active ? 'working' : 'default'} size={56} interactive={false} />
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold tracking-tight text-white">{title}</p>
              <p className="mt-0.5 truncate text-sm text-zinc-400">{step.label}</p>
            </div>
            <AiOrb size="lg" state={step.orb} theme="dark" />
          </div>
          <ol className="space-y-px p-2 font-mono text-[13px]">
            {DRAFT_STEPS.map(({ label }, i) => {
              const done = i < current;
              const running = i === current;
              return (
                <li
                  key={label}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors',
                    running && 'bg-white/5 text-white',
                    done && 'text-zinc-400',
                    !done && !running && 'text-zinc-600',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded-full',
                      done ? 'bg-indigo-500 text-white' : 'border border-white/15',
                      running && 'border-indigo-400',
                    )}
                  >
                    {done ? <Check className="size-2.5" aria-hidden /> : running && <span className="size-1.5 animate-pulse rounded-full bg-indigo-400" />}
                  </span>
                  <span className="truncate">{label}</span>
                </li>
              );
            })}
          </ol>
        </ConsoleCard>
      </BorderBeam>
    </div>
  );
}
