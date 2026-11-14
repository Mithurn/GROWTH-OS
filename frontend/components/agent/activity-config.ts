import type { LucideIcon } from 'lucide-react';
import { Activity, CheckCheck, PenLine, Radar, Rocket, Send, Trophy, TriangleAlert } from 'lucide-react';

export type ActivityKind = 'discovered' | 'drafted' | 'approved' | 'sent' | 'milestone' | 'error';
export type ActivityFilter = 'all' | 'discoveries' | 'campaigns' | 'delivery';
export type ActivityMetrics = Record<string, string | number>;

export const ACTIVITY_KINDS: Record<
  ActivityKind,
  { label: string; icon: LucideIcon; group: Exclude<ActivityFilter, 'all'>; node: string; text: string }
> = {
  discovered: { label: 'Discovered', icon: Radar, group: 'discoveries', node: 'border-brand-line bg-brand-tint', text: 'text-primary-hover' },
  drafted: { label: 'Drafted', icon: PenLine, group: 'campaigns', node: 'border-sky-200 bg-sky-50', text: 'text-sky-700' },
  approved: { label: 'Approved', icon: CheckCheck, group: 'campaigns', node: 'border-emerald-200 bg-success-tint', text: 'text-success' },
  sent: { label: 'Sent', icon: Send, group: 'delivery', node: 'border-brand-line bg-white', text: 'text-primary' },
  milestone: { label: 'Milestone', icon: Trophy, group: 'delivery', node: 'border-amber-200 bg-warning-tint', text: 'text-warning' },
  error: { label: 'Needs attention', icon: TriangleAlert, group: 'delivery', node: 'border-danger/20 bg-danger-tint', text: 'text-danger' },
};

export const ACTIVITY_ACTIONS: Record<string, { kind: ActivityKind; label?: string; icon?: LucideIcon }> = {
  discovered_opportunity: { kind: 'discovered' },
  created_campaign: { kind: 'drafted' },
  approved_campaign: { kind: 'approved' },
  launched_campaign: { kind: 'sent', label: 'Launched', icon: Rocket },
  sent_messages: { kind: 'sent' },
  achieved_milestone: { kind: 'milestone' },
  campaign_failed: { kind: 'error' },
  delivery_failed: { kind: 'error' },
};

export const ACTIVITY_FALLBACK = { kind: 'milestone' as ActivityKind, icon: Activity };

export const ACTIVITY_FILTERS: readonly { id: ActivityFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'discoveries', label: 'Discoveries' },
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'delivery', label: 'Delivery' },
];

export const ACTIVITY_TIMING = {
  pollMs: 2500,
  heartbeatMs: 1000,
  runPollMs: 1500,
  runTickMs: 200,
  beamStrength: 1,
} as const;

export const ACTIVITY_DEFAULTS = {
  pageSize: 50,
  skeletonRows: 4,
  dashboardLimit: 5,
} as const;

export const RUN_TRACE_NODES: Record<string, string> = {
  scout: 'text-sky-300',
  strategist: 'text-indigo-300',
  reviewer: 'text-emerald-300',
};

export const RUN_TRACE_LIVE_STATUS = 'running';
export const RUN_TRACE_LINK_KEYS = { opportunityId: '/opportunities/', campaignId: '/campaigns' } as const;

export const ACTIVITY_DAY_LABELS = { today: 'Today', yesterday: 'Yesterday' } as const;
