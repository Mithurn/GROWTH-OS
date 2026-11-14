import {
  BadgeIndianRupee,
  Coffee,
  Cpu,
  HeartHandshake,
  Home,
  RefreshCcw,
  ShoppingBag,
  Sparkles,
  Store,
  TrendingUp,
  Users,
} from 'lucide-react';

export type Step = 'welcome' | 'company' | 'data' | 'goal' | 'mode' | 'setup';

export const STEP_ORDER: Step[] = ['welcome', 'company', 'data', 'goal', 'mode', 'setup'];
export const FORM_STEPS: Step[] = ['company', 'data', 'goal', 'mode'];

export const INDUSTRIES = [
  { value: 'fashion', label: 'Fashion', icon: ShoppingBag },
  { value: 'beauty', label: 'Beauty', icon: Sparkles },
  { value: 'food', label: 'Food and beverage', icon: Coffee },
  { value: 'electronics', label: 'Electronics', icon: Cpu },
  { value: 'home', label: 'Home and living', icon: Home },
  { value: 'other', label: 'Other retail', icon: Store },
] as const;

export const GOALS = [
  { value: 'repeat', label: 'Increase repeat purchases', icon: RefreshCcw },
  { value: 'churn', label: 'Reduce churn', icon: TrendingUp },
  { value: 'loyalty', label: 'Grow loyalty', icon: HeartHandshake },
  { value: 'aov', label: 'Increase average order value', icon: BadgeIndianRupee },
  { value: 'acquire', label: 'Acquire new customers', icon: Users },
] as const;

export const AGENT_LINES: Record<Exclude<Step, 'setup'>, { title: string; body: string }> = {
  welcome: { title: 'Meet your growth agent', body: 'I study your customers, find where revenue leaks, and draft the campaign to recover it. You approve every send.' },
  company: { title: 'First, who am I working for?', body: 'Your brand and industry tell me what a healthy customer looks like in your market.' },
  data: { title: 'Now give me something to read', body: 'Customers and orders are enough. I build profiles, personas and audiences from them.' },
  goal: { title: 'What should I optimise for?', body: 'Every opportunity I surface is ranked against this goal.' },
  mode: { title: 'How much should I do alone?', body: 'Start in operator mode. I draft, you approve. Autonomy comes later.' },
};

export const SETUP_ITEMS = [
  'Validating your data',
  'Importing customer and order history',
  'Building customer profiles',
  'Generating AI personas',
  'Setting up your AI growth team',
  'Ready to grow',
];

export const GOAL_LABELS: Record<string, string> = Object.fromEntries(GOALS.map((g) => [g.value, g.label]));

export const POLL_INTERVAL_MS = 1500;
export const MAX_POLLS = 200;
export const DEMO_CUSTOMERS = 500;
export const DEMO_ORDERS = '3,000';
export const AGENT_CHANNELS = ['WhatsApp', 'Email'];
export const AGENT_MAX_BUDGET = 100000;
export const AGENT_FREQUENCY_CAP = 3;

const DONE_BY_STEP: Record<string, number> = {
  validating: 0,
  parsing: 0,
  seeding_products: 0,
  importing_customers: 1,
  importing_orders: 1,
  calculating_metrics: 2,
  validating_metrics: 2,
  calculating_attributes: 2,
  validating_attributes: 2,
  generating_personas: 3,
  personas_complete: 3,
  personas_skipped: 3,
  completed: 4,
};

export const getDoneCount = (step: string): number => DONE_BY_STEP[step] ?? 0;
