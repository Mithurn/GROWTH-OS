'use client';

import { BotAvatar } from 'bot-avatars';
import { AGENT_AVATAR_LOOK } from '@/components/agent/agent-config';
import { useBackendStatus } from '@/lib/use-backend-status';
import { HeroActions } from './hero-actions';

const AVATAR_SIZE = 96;

export function ClosingCta() {
  const live = useBackendStatus() === 'online';

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-6 text-center">
      <BotAvatar {...AGENT_AVATAR_LOOK} state={live ? 'working' : 'sleeping'} size={AVATAR_SIZE} aria-label="GrowthOS agent" />
      <h2 className="mt-8 text-4xl font-semibold tracking-tight text-white sm:text-5xl">See the agent work before you bring your data</h2>
      <p className="mt-4 max-w-xl text-zinc-400">
        {live
          ? 'Create an account and point the agent at your own customers.'
          : 'Walk the whole flow on sample data, from opportunity to campaign to results. Nothing is sent.'}
      </p>
      <div className="mt-10">
        <HeroActions />
      </div>
    </div>
  );
}
