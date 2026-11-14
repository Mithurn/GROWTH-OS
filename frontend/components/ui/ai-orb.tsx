'use client';

import { ThinkingOrb, type OrbState, type OrbTheme } from 'thinking-orbs';

const ORB_SIZES = {
  sm: 20,
  md: 32,
  lg: 64,
} as const;

const ORB_TINT = '#5b4fff';

export type AiOrbSize = keyof typeof ORB_SIZES;
export type AiOrbState = OrbState;

type AiOrbProps = {
  size?: AiOrbSize;
  state?: AiOrbState;
  theme?: OrbTheme;
  className?: string;
};

export function AiOrb({ size = 'md', state = 'working', theme = 'light', className }: AiOrbProps) {
  return <ThinkingOrb state={state} size={ORB_SIZES[size]} theme={theme} color={ORB_TINT} className={className} />;
}
