export const AGENT_NAME = 'GrowthOS Agent';

export const AGENT_AVATAR_LOOK = { type: 'droid', shading: 'plastic', color: '#6a5cff', face: 'mouth' } as const;

export const AGENT_AVATAR_SIZES = { sm: 32, md: 32, lg: 64 } as const;

export const AGENT_STATES = {
  idle: { avatar: 'default', orb: 'breathing', label: 'Watching your customers' },
  working: { avatar: 'working', orb: 'working', label: 'Working' },
  sleeping: { avatar: 'sleeping', orb: 'breathing', label: 'Offline' },
} as const;

export type AgentState = keyof typeof AGENT_STATES;
export type AgentAvatarSize = keyof typeof AGENT_AVATAR_SIZES;

export const STATUS_TONES = {
  live: { dot: 'bg-[#5B4FFF]', chip: 'bg-[#EEF2FF] text-[#4B3FE5] border-[#E0E7FF]' },
  success: { dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  warning: { dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 border-amber-100' },
  danger: { dot: 'bg-red-500', chip: 'bg-red-50 text-red-700 border-red-100' },
  neutral: { dot: 'bg-[#9CA3AF]', chip: 'bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]' },
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
