'use client';

import { BotAvatar } from 'bot-avatars';
import { AGENT_AVATAR_LOOK, AGENT_AVATAR_SIZES, AGENT_NAME, AGENT_STATES, type AgentAvatarSize, type AgentState } from './agent-config';

type AgentAvatarProps = {
  state?: AgentState;
  size?: AgentAvatarSize;
  className?: string;
};

export function AgentAvatar({ state = 'idle', size = 'md', className }: AgentAvatarProps) {
  return (
    <BotAvatar
      {...AGENT_AVATAR_LOOK}
      state={AGENT_STATES[state].avatar}
      size={AGENT_AVATAR_SIZES[size]}
      aria-label={`${AGENT_NAME}: ${AGENT_STATES[state].label}`}
      className={className}
    />
  );
}
