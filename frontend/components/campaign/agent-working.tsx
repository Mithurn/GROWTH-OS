'use client';

import { BorderBeam } from 'border-beam';
import { Check } from 'lucide-react';
import { AgentAvatar } from '@/components/agent/agent-avatar';
import { AiOrb } from '@/components/ui/ai-orb';
import { cn } from '@/lib/utils';
import { Panel } from './panel';
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
      <BorderBeam size="md" theme="light" colorVariant="ocean" strength={0.8}>
        <Panel className="shadow-[0_20px_50px_-30px_rgba(20,25,41,0.3)]">
          <div className="flex items-center gap-4 border-b border-[#F0F1F4] px-5 py-5">
            <AgentAvatar state={active ? 'working' : 'idle'} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold tracking-tight text-[#1A1A1A]">{title}</p>
              <p className="mt-0.5 truncate text-sm text-[#6B7280]">{step.label}</p>
            </div>
            <AiOrb size="lg" state={step.orb} />
          </div>
          <ol className="space-y-px p-2">
            {DRAFT_STEPS.map(({ label }, i) => {
              const done = i < current;
              const running = i === current;
              return (
                <li
                  key={label}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                    running && 'bg-[#EEF2FF] font-medium text-[#1A1A1A]',
                    done && 'text-[#6B7280]',
                    !done && !running && 'text-[#C4C8D0]',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-4 shrink-0 items-center justify-center rounded-full',
                      done ? 'bg-[#5B4FFF] text-white' : 'border border-[#D5D8DF]',
                      running && 'border-[#5B4FFF]',
                    )}
                  >
                    {done ? <Check className="size-2.5" aria-hidden /> : running && <span className="size-1.5 animate-pulse rounded-full bg-[#5B4FFF]" />}
                  </span>
                  <span className="truncate">{label}</span>
                </li>
              );
            })}
          </ol>
        </Panel>
      </BorderBeam>
    </div>
  );
}
