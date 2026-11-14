'use client';

import { BotAvatar } from 'bot-avatars';
import { AGENT_AVATAR_SIZES, AGENT_AVATAR_TYPE, AGENT_NAME, AGENT_STATES, type AgentAvatarSize, type AgentState } from './agent-config';

type AgentAvatarProps = {
  state?: AgentState;
  size?: AgentAvatarSize;
  className?: string;
};

export function AgentAvatar({ state = 'idle', size = 'md', className }: AgentAvatarProps) {
  return (
    <BotAvatar
      type={AGENT_AVATAR_TYPE}
      state={AGENT_STATES[state].avatar}
      size={AGENT_AVATAR_SIZES[size]}
      aria-label={`${AGENT_NAME}: ${AGENT_STATES[state].label}`}
      className={className}
    />
  );
}
