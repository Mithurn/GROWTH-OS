export const AGENT_NAME = 'GrowthOS Agent';

export const AGENT_AVATAR_LOOK = { type: 'hexagon', shading: 'plastic', color: '#14b8a6', face: 'mouth' } as const;

export const AGENT_AVATAR_SIZES = { sm: 32, md: 32, lg: 64 } as const;

export const AGENT_STATES = {
  idle: { avatar: 'default', orb: 'breathing', label: 'Watching your customers' },
  working: { avatar: 'working', orb: 'working', label: 'Working' },
  sleeping: { avatar: 'sleeping', orb: 'breathing', label: 'Offline' },
} as const;

export type AgentState = keyof typeof AGENT_STATES;
export type AgentAvatarSize = keyof typeof AGENT_AVATAR_SIZES;

export const STATUS_TONES = {
  live: { dot: 'bg-primary', chip: 'bg-brand-tint text-primary-hover border-brand-tint' },
  success: { dot: 'bg-success', chip: 'bg-success-tint text-success border-success/20' },
  warning: { dot: 'bg-warning', chip: 'bg-warning-tint text-warning border-warning/20' },
  danger: { dot: 'bg-danger', chip: 'bg-danger-tint text-danger border-danger/20' },
  neutral: { dot: 'bg-subtle', chip: 'bg-muted text-body border-border' },
} as const;

export type StatusTone = keyof typeof STATUS_TONES;

export const PROMPT_DEFAULTS = {
  maxLength: 200,
  placeholderIntervalMs: 3500,
} as const;

export const ACTIVITY_DEFAULTS = {
  limit: 6,
  skeletonRows: 4,
} as const;

export const CONFIDENCE_SEGMENTS = 10;
