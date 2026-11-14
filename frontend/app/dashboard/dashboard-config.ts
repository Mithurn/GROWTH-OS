import { Megaphone, MessageSquare, Search, Sparkles, Trophy, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Opportunity } from '@/lib/types';

export const ACTIVITY_POLL_MS = 4000;
export const ACTIVITY_FETCH_LIMIT = 20;
export const STEP_INTERVAL_MS = 2000;
export const QUERY_ERROR_MS = 4000;
export const COLD_START_HINT_MS = 2500;
export const COLD_START_RETRY_MS = 3000;
export const MAX_RETRIES = 3;
export const GRID_COUNT = 3;
export const FEATURE_SWAP_MS = 300;

export const HIGH_PRIORITY = 70;
export const MEDIUM_PRIORITY = 40;

export const GOAL_PLACEHOLDERS = [
  'Increase repeat purchases',
  'Recover dormant customers',
  'Boost loyalty engagement',
  'Find high-value segments',
  'Reduce customer churn',
] as const;

export const GOAL_SUGGESTIONS = ['Find customers likely to churn', 'Increase denim sales', 'Recover dormant VIPs'] as const;

export const RUN_STEPS = (goal: string) => [
  `Reading the goal: "${goal}"`,
  'Scanning the customer database',
  'Calculating revenue potential',
  'Mapping audience segments',
  'Drafting the opportunity strategy',
];

export const ACTION_META: Record<string, { label: string; icon: LucideIcon }> = {
  discovered_opportunity: { label: 'Discovered', icon: Search },
  created_campaign: { label: 'Campaign', icon: Megaphone },
  launched_campaign: { label: 'Launched', icon: Zap },
  sent_messages: { label: 'Sent', icon: MessageSquare },
  achieved_milestone: { label: 'Milestone', icon: Trophy },
  generating_opportunity: { label: 'Thinking', icon: Sparkles },
};

export const PRIORITY_TONES = {
  high: { label: 'High', tone: 'live' },
  medium: { label: 'Medium', tone: 'warning' },
  low: { label: 'Low', tone: 'neutral' },
} as const;

export function priorityOf(score: number) {
  if (score >= HIGH_PRIORITY) return PRIORITY_TONES.high;
  if (score >= MEDIUM_PRIORITY) return PRIORITY_TONES.medium;
  return PRIORITY_TONES.low;
}

export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function opportunityRevenue(opportunity: Opportunity): number {
  const amount = Number(opportunity.potential_revenue);
  if (Number.isFinite(amount) && amount > 0) return amount;
  const summary = `${opportunity.ai_summary ?? ''} ${opportunity.description ?? ''}`;
  const match = summary.match(/₹\s*([\d,]+)/);
  return match ? Number(match[1].replace(/,/g, '')) : 0;
}

export function parseChannel(action: string): string {
  const lower = action.toLowerCase();
  if (lower.includes('email')) return 'Email';
  if (lower.includes('sms')) return 'SMS';
  return 'WhatsApp';
}

const MAX_REASONS = 3;

export function parseTriggerReasons(opp: Opportunity): string[] {
  const reasons: string[] = [];
  if (opp.average_spend) {
    reasons.push(`Average order value ₹${Math.round(opp.average_spend).toLocaleString()}`);
  }
  const daysSinceLastOrder = opp.audience_definition?.['days_since_last_order'];
  if (typeof daysSinceLastOrder === 'string' || typeof daysSinceLastOrder === 'number') {
    reasons.push(`Last purchase over ${String(daysSinceLastOrder).replace('>=', '').trim()} days ago`);
  } else if (opp.trigger_reason?.toLowerCase().includes('days')) {
    reasons.push('Extended purchase gap detected');
  }
  if (opp.supporting_customer_segment) {
    reasons.push(`${opp.supporting_customer_segment} segment`);
  }
  if (reasons.length === 0 && opp.trigger_reason) {
    return opp.trigger_reason.split('.').filter((s) => s.trim()).slice(0, MAX_REASONS);
  }
  return reasons.length > 0 ? reasons : ['High-value customer pattern detected'];
}
