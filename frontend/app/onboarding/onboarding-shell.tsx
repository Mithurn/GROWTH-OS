import { Logo } from '@/components/brand/logo';

const ONBOARDING_LOGO_HEIGHT = 32;
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AgentAvatar } from '@/components/agent/agent-avatar';
import type { AgentState } from '@/components/agent/agent-config';
import { cn } from '@/lib/utils';

type OnboardingShellProps = {
  title: string;
  body: string;
  progress?: { index: number; total: number };
  agentState?: AgentState;
  children: ReactNode;
};

export function OnboardingShell({ title, body, progress, agentState = 'idle', children }: OnboardingShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-white lg:flex-row">
      <aside className="relative flex flex-col justify-between overflow-hidden bg-[#0A0E1A] bg-[radial-gradient(circle_at_20%_0%,rgba(91,79,255,0.28),transparent_55%)] px-6 py-6 text-white lg:w-[420px] lg:shrink-0 lg:px-10 lg:py-10">
        <Link href="/" aria-label="GrowthOS home">
          <Logo height={ONBOARDING_LOGO_HEIGHT} />
        </Link>
        <div className="mt-8 lg:mt-0">
          <AgentAvatar state={agentState} size="lg" />
          <h2 className="mt-5 text-2xl font-semibold tracking-tight lg:text-3xl">{title}</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#8B92A5]">{body}</p>
        </div>
        {progress && (
          <ol className="mt-8 flex gap-1.5 lg:mt-0" aria-label={`Step ${progress.index + 1} of ${progress.total}`}>
            {Array.from({ length: progress.total }, (_, i) => (
              <li key={i} className={cn('h-1 flex-1 rounded-full', i <= progress.index ? 'bg-[#7C6AFF]' : 'bg-[#1E2545]')} />
            ))}
          </ol>
        )}
      </aside>
      <main className="flex flex-1 flex-col justify-center px-6 py-10 lg:px-16">
        <div className="mx-auto w-full max-w-xl">{children}</div>
      </main>
    </div>
  );
}
