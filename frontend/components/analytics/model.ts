import type { SeriesKey } from './config';

export type FunnelCounts = { targeted: number; sent: number; delivered: number; read: number; clicked: number; failed?: number };
export type TimelinePoint = { hour: number } & Record<SeriesKey, number>;
export type PersonaSlice = { persona_name: string; count: number; percentage: number };
export type Heatmap = { days: string[]; slots: string[]; rates: number[][] };
export type Benchmark = { delivered: number; read: number; clicked: number };

export type AnalyticsData = {
  campaign: {
    id: string;
    name: string;
    objective: string;
    channel: string;
    status: string;
    launched_at?: string;
    potential_revenue: number;
  };
  funnel: FunnelCounts;
  personaBreakdown: PersonaSlice[];
  timeline: TimelinePoint[];
  sendTimeHeatmap?: Heatmap;
  benchmark?: Benchmark;
  insights: {
    learnings: string[];
    nextAction: { title: string; description: string; potentialRevenue: number; confidence: number };
  };
};

export const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
export const formatPct = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(1)}%`;

export const estimateRevenue = (funnel: FunnelCounts, potential: number) =>
  funnel.targeted > 0 ? Math.round((funnel.clicked / funnel.targeted) * potential) : 0;

export const seriesOf = (timeline: TimelinePoint[], key: SeriesKey) => timeline.map((p) => ({ v: p[key] }));

export function toCsv(columns: readonly string[], rows: TimelinePoint[]) {
  return [columns.join(','), ...rows.map((r) => columns.map((c) => r[c as keyof TimelinePoint]).join(','))].join('\n');
}
