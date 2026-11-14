import { RotateCcw, ShieldAlert, Star, TrendingUp } from 'lucide-react';
import type { StatusTone } from '@/components/agent/agent-config';

export const CATEGORY_FILTERS = [
  { key: 'Recovery', icon: RotateCcw },
  { key: 'Retention', icon: ShieldAlert },
  { key: 'Expansion', icon: TrendingUp },
  { key: 'Loyalty', icon: Star },
] as const;

export const STATUS_FILTERS = [
  { key: 'new', label: 'No campaign' },
  { key: 'awaiting_review', label: 'Draft' },
  { key: 'completed', label: 'Live' },
] as const;

export const GOAL_SUGGESTIONS = ['Find customers likely to churn', 'Find dormant VIP customers', 'Increase denim sales'] as const;

export const GOAL_PLACEHOLDERS = ['Ask the agent to discover an opportunity', 'Describe a growth goal in plain words'] as const;

const CATEGORY_KEYWORDS: Record<(typeof CATEGORY_FILTERS)[number]['key'], string[]> = {
  Recovery: ['recov', 'churn', 'dormant', 'winback'],
  Retention: ['retention', 'retain', 'at-risk', 'risk'],
  Expansion: ['expansion', 'growth', 'revenue', 'upsell', 'cross'],
  Loyalty: ['loyalty', 'vip', 'reward', 'tier'],
};

const DEFAULT_CATEGORY = 'Expansion';

export function categoryForType(type: string): string {
  const t = (type ?? '').toLowerCase();
  const match = CATEGORY_FILTERS.find(({ key }) => CATEGORY_KEYWORDS[key].some((word) => t.includes(word)));
  return match?.key ?? DEFAULT_CATEGORY;
}

export function parseChannel(action: string): string {
  const lower = (action ?? '').toLowerCase();
  if (lower.includes('email')) return 'Email';
  if (lower.includes('sms')) return 'SMS';
  return 'WhatsApp';
}

export const CAMPAIGN_STAGES: Record<'launched' | 'draft' | 'none', { label: string; tone: StatusTone; action: (channel: string) => string }> = {
  launched: { label: 'Campaign live', tone: 'success', action: () => 'View analytics' },
  draft: { label: 'Draft ready', tone: 'warning', action: (channel) => `Review ${channel} draft` },
  none: { label: 'Needs campaign', tone: 'live', action: (channel) => `Draft ${channel} campaign` },
};

export function stageOf(campaignStatus: string | null) {
  if (!campaignStatus) return CAMPAIGN_STAGES.none;
  return campaignStatus === 'Launched' ? CAMPAIGN_STAGES.launched : CAMPAIGN_STAGES.draft;
}
