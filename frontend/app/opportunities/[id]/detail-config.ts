import { Calendar, Clock, TrendingDown, TrendingUp } from 'lucide-react';

export const SIGNAL_ICONS = [Clock, TrendingUp, TrendingDown, Calendar] as const;

export const REFINE_SUGGESTIONS = ['Focus only on VIP customers', 'Increase projected revenue', 'Use Email instead'] as const;

export const REFINE_PLACEHOLDERS = ['How should the agent change this opportunity?'] as const;

export const MAX_SIGNALS = 4;
export const MIN_SIGNAL_LENGTH = 10;
export const MAX_PERSONAS = 3;
export const VOUCHER_SHARE = 0.05;
export const VOUCHER_STEP = 50;
export const DEFAULT_VOUCHER = 500;
export const CHURN_HIGH_DAYS = 90;
export const DEFAULT_SEGMENT = 'Dormant VIPs';
export const DEFAULT_RECENCY_DAYS = '60+';
export const LTV_MULTIPLE = 3;
export const DEFAULT_LTV = 12000;

export const FALLBACK_SIGNALS = (ltv: string) => [
  'Purchase inactivity over 60 days',
  `Lifetime value above ${ltv}`,
  'Declining overall engagement',
  'Missed seasonal purchase cycle',
];

export function parseChannel(action: string): string {
  const a = (action ?? '').toLowerCase();
  if (a.includes('email')) return 'Email';
  if (a.includes('sms')) return 'SMS';
  return 'WhatsApp';
}

export function parseSignals(triggerReason: string): string[] {
  if (!triggerReason) return [];
  return triggerReason
    .split(/[.;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > MIN_SIGNAL_LENGTH)
    .slice(0, MAX_SIGNALS);
}

export function playName(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('recovery') || t.includes('dormant')) return 'Win-back campaign';
  if (t.includes('loyalty')) return 'Loyalty upsell';
  return 'Targeted campaign';
}
