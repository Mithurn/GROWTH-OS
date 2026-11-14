'use client';

import { Area, AreaChart } from 'recharts';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/components/campaign/config';
import { useCountUp } from '@/components/campaign/hooks';
import { TIMING } from '@/components/campaign/config';
import { cn } from '@/lib/utils';
import { CHART_UI, SERIES, type SeriesKey } from './config';
import { estimateRevenue, formatPct, pct, seriesOf, type AnalyticsData } from './model';

type Kpi = {
  label: string;
  value: string;
  hint: string;
  spark: SeriesKey;
  delta?: number;
  accent?: boolean;
};

function Spark({ data, color, id }: { data: { v: number }[]; color: string; id: string }) {
  return (
    <AreaChart width={CHART_UI.sparkWidth} height={CHART_UI.sparkHeight} data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }} accessibilityLayer={false}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} fill={`url(#${id})`} isAnimationActive={false} />
    </AreaChart>
  );
}

function Delta({ value }: { value: number }) {
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums',
        up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
      )}
    >
      <Icon className="size-3" aria-hidden />
      <span className="sr-only">{up ? 'Up' : 'Down'} </span>
      {Math.abs(value).toFixed(1)} pts
    </span>
  );
}

export function KpiStrip({ data }: { data: AnalyticsData }) {
  const { funnel, timeline, benchmark, campaign } = data;
  const revenue = useCountUp(estimateRevenue(funnel, campaign.potential_revenue), TIMING.countUpMs);
  const rate = (n: number, d: number) => pct(n, d);
  const deliveredRate = rate(funnel.delivered, funnel.sent);
  const readRate = rate(funnel.read, funnel.delivered);
  const clickRate = rate(funnel.clicked, funnel.sent);

  const kpis: Kpi[] = [
    { label: 'Sent', value: formatNumber(funnel.sent), hint: `of ${formatNumber(funnel.targeted)} targeted`, spark: 'sent' },
    {
      label: 'Delivered',
      value: formatPct(deliveredRate),
      hint: `${formatNumber(funnel.delivered)} messages`,
      spark: 'delivered',
      delta: benchmark ? deliveredRate - benchmark.delivered : undefined,
    },
    {
      label: 'Read',
      value: formatPct(readRate),
      hint: `${formatNumber(funnel.read)} readers`,
      spark: 'read',
      delta: benchmark ? readRate - benchmark.read : undefined,
    },
    {
      label: 'Click rate',
      value: formatPct(clickRate),
      hint: `${formatNumber(funnel.clicked)} clicks`,
      spark: 'clicked',
      delta: benchmark ? clickRate - benchmark.clicked : undefined,
    },
    { label: 'Revenue (est.)', value: formatCurrency(revenue), hint: `of ${formatCurrency(campaign.potential_revenue)} potential`, spark: 'clicked', accent: true },
  ];

  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] md:grid-cols-3 xl:grid-cols-5">
      {kpis.map((k, i) => {
        const color = k.accent ? '#5B4FFF' : SERIES.find((s) => s.key === k.spark)!.color;
        return (
          <div key={k.label} className="relative flex min-w-0 flex-col gap-1 max-md:last:col-span-2 border-b border-r border-[#EEF0F4] p-4 last:border-r-0 xl:border-b-0 xl:[&:nth-child(5n)]:border-r-0">
            <dt className="text-[13px] font-medium text-[#6B7280]">{k.label}</dt>
            <dd className="flex items-end justify-between gap-2">
              <span className={cn('text-[28px] font-semibold leading-none tracking-tight tabular-nums', k.accent ? 'text-[#5B4FFF]' : 'text-[#111827]')}>{k.value}</span>
              {k.spark !== 'sent' && <Spark data={seriesOf(timeline, k.spark)} color={color} id={`kpi-spark-${i}`} />}
            </dd>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[#6B7280]">
              {k.delta !== undefined && <Delta value={k.delta} />}
              <span>{k.hint}</span>
            </p>
          </div>
        );
      })}
    </dl>
  );
}
