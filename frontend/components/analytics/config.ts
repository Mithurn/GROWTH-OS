export const SERIES = [
  { key: 'sent', label: 'Sent', color: '#94A3B8', dash: '4 4', width: 1.5 },
  { key: 'delivered', label: 'Delivered', color: '#818CF8', dash: undefined, width: 2 },
  { key: 'read', label: 'Read', color: '#4338CA', dash: undefined, width: 2 },
  { key: 'clicked', label: 'Clicked', color: '#D97706', dash: undefined, width: 2.5 },
] as const;

export type SeriesKey = (typeof SERIES)[number]['key'];

export const RANGES = [
  { label: '6h', hours: 6 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
] as const;

export const DEFAULT_RANGE_HOURS = 24;

export const PERSONA_COLORS = ['#4338CA', '#0891B2', '#D97706', '#94A3B8', '#A5B4FC'] as const;

export const CHART_UI = {
  height: 280,
  compactHeight: 240,
  grid: '#EEF0F4',
  axis: '#6B7280',
  fontSize: 12,
  animationMs: 700,
  donutInner: 62,
  donutOuter: 92,
  barRadius: 6,
  sparkHeight: 28,
  sparkWidth: 84,
} as const;

export const FUNNEL = {
  stages: [
    { key: 'sent', label: 'Sent', color: '#E0E7FF' },
    { key: 'delivered', label: 'Delivered', color: '#C7D2FE' },
    { key: 'read', label: 'Read', color: '#818CF8' },
    { key: 'clicked', label: 'Clicked', color: '#4338CA' },
  ],
  minBarPct: 10,
} as const;

export const HEATMAP = {
  ramp: ['#EEF2FF', '#C7D2FE', '#818CF8', '#4F46E5', '#312E81'],
  darkFrom: 3,
} as const;

export const KPI_SKELETONS = 5;
export const LEARNINGS_LIMIT = 3;
export const ALL_CAMPAIGNS_PATH = '/analytics';

export const EXPORT = {
  filename: 'campaign-timeline.csv',
  columns: ['hour', 'sent', 'delivered', 'read', 'clicked'],
} as const;
