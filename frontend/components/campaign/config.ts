import { Mail, MessageSquare, Smartphone, type LucideIcon } from 'lucide-react';

export const CHANNELS = ['WhatsApp', 'Email', 'SMS'] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_META: Record<Channel, { icon: LucideIcon; blurb: string; stat: string }> = {
  WhatsApp: { icon: MessageSquare, blurb: 'Conversational, rich media', stat: '86% open rate' },
  Email: { icon: Mail, blurb: 'Long copy, links, images', stat: '24% open rate' },
  SMS: { icon: Smartphone, blurb: 'Instant, short, plain', stat: '98% delivery' },
};

export const REFINE_CHIPS = ['Make it more urgent', 'Make it shorter', 'More premium tone'] as const;

export const PREVIEW = {
  brand: 'Your Brand',
  customer: 'Priya',
  time: '10:42',
  link: 'yourbrand.com/offer',
  smsLimit: 160,
} as const;

export const DRAFT_STEPS = [
  { label: 'Reading the audience behind this opportunity', orb: 'searching' },
  { label: 'Choosing the channel and the offer', orb: 'connecting' },
  { label: 'Writing the message', orb: 'composing' },
  { label: 'Checking tone, length and compliance', orb: 'solving' },
] as const;

export const TIMING = {
  stepMs: 1100,
  typeTickMs: 14,
  typeCharsPerTick: 3,
  redirectMs: 2500,
  countUpMs: 900,
} as const;

export const LAUNCH_REQUEST = {
  email: 'openlogtech@gmail.com',
  phone: '8056687515',
  href: `mailto:openlogtech@gmail.com?subject=${encodeURIComponent('GrowthOS launch access')}`,
} as const;

export const STATUS_TONE: Record<string, string> = {
  PendingApproval: 'border-amber-200 bg-amber-50 text-amber-700',
  Approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Launched: 'border-indigo-200 bg-accent text-primary',
  Completed: 'border-border bg-muted text-muted-foreground',
  Cancelled: 'border-red-200 bg-red-50 text-red-700',
};

export const STATUS_LABEL: Record<string, string> = {
  PendingApproval: 'Awaiting approval',
};

export const FUNNEL_STAGES = [
  { key: 'sent', label: 'Sent' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'read', label: 'Read' },
  { key: 'clicked', label: 'Clicked' },
] as const;

export const CHART = {
  primary: '#5B4FFF',
  soft: '#9D8FFF',
  faint: '#C9C2FF',
  grid: '#E4E4E7',
  axis: '#71717A',
  height: 220,
} as const;

export const formatCurrency = (v: number) => {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${Math.round(v)}`;
};

export const formatNumber = (n: number) => n.toLocaleString('en-IN');
