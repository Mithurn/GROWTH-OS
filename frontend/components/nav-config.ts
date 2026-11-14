import { Activity, BarChart3, Brain, LayoutDashboard, Megaphone, Settings, Target, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavItem = { label: string; href: string; icon: LucideIcon; keywords?: string };

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Agent',
    items: [
      { label: 'Overview', href: '/dashboard', icon: LayoutDashboard, keywords: 'home goal agent' },
      { label: 'Opportunities', href: '/opportunities', icon: Target, keywords: 'revenue audience' },
      { label: 'Activity', href: '/activity', icon: Activity, keywords: 'log timeline agent runs' },
      { label: 'Campaigns', href: '/campaigns', icon: Megaphone, keywords: 'messages whatsapp email sms' },
    ],
  },
  {
    title: 'Insight',
    items: [
      { label: 'Analytics', href: '/analytics', icon: BarChart3, keywords: 'results conversion' },
      { label: 'Intelligence', href: '/intelligence', icon: Brain, keywords: 'customers health' },
      { label: 'Personas', href: '/personas', icon: Users, keywords: 'segments groups' },
    ],
  },
  { title: 'Workspace', items: [{ label: 'Settings', href: '/settings', icon: Settings, keywords: 'integrations account' }] },
];

export const OPEN_PALETTE_EVENT = 'growthos:open-palette';
