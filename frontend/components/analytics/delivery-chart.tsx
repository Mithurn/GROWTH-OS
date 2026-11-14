'use client';

import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/components/campaign/config';
import { CHART_UI, DEFAULT_RANGE_HOURS, RANGES, SERIES } from './config';
import { ChartEmpty, Panel } from './panel';
import type { TimelinePoint } from './model';

const hourLabel = (h: number) => (h <= 0 ? 'Launch' : `+${h}h`);

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-40 rounded-xl border border-border bg-card p-3 text-xs shadow-pop">
      <p className="mb-2 font-medium text-foreground">{label}</p>
      <ul className="space-y-1">
        {[...payload].reverse().map((p) => (
          <li key={p.dataKey as string} className="flex items-center justify-between gap-4 text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: p.color }} aria-hidden />
              {p.name}
            </span>
            <span className="font-medium tabular-nums text-foreground">{formatNumber(p.value ?? 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DeliveryChart({ timeline }: { timeline: TimelinePoint[] }) {
  const reduced = useReducedMotion();
  const maxHour = timeline.reduce((m, p) => Math.max(m, p.hour), 0);
  const [range, setRange] = useState<number>(DEFAULT_RANGE_HOURS);
  const ranges = RANGES.filter((r) => r.hours < maxHour);
  const options = [...ranges.map((r) => ({ label: r.label, hours: r.hours })), { label: 'All', hours: Infinity }];
  const active = options.some((o) => o.hours === range) ? range : Infinity;
  const data = useMemo(() => timeline.filter((p) => p.hour <= active).map((p) => ({ ...p, t: hourLabel(p.hour) })), [timeline, active]);
  const empty = data.length === 0 || data.every((d) => d.delivered === 0);

  const chips = (
    <div role="radiogroup" aria-label="Time range" className="inline-flex rounded-lg bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          role="radio"
          aria-checked={active === o.hours}
          onClick={() => setRange(o.hours)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary',
            active === o.hours ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <Panel title="Delivery events over time" description="Cumulative messages at each stage since launch" action={timeline.length > 1 ? chips : undefined}>
      {empty ? (
        <ChartEmpty message="Waiting for the first events" height={CHART_UI.height} />
      ) : (
        <>
          <div role="img" aria-label="Line chart of sent, delivered, read and clicked messages over time">
            <ResponsiveContainer width="100%" height={CHART_UI.height}>
              <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  {SERIES.map((s) => (
                    <linearGradient key={s.key} id={`dc-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.color} stopOpacity={s.key === 'sent' ? 0 : 0.18} />
                      <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid vertical={false} stroke={CHART_UI.grid} />
                <XAxis dataKey="t" tick={{ fill: CHART_UI.axis, fontSize: CHART_UI.fontSize }} axisLine={false} tickLine={false} tickMargin={8} minTickGap={24} />
                <YAxis tick={{ fill: CHART_UI.axis, fontSize: CHART_UI.fontSize }} axisLine={false} tickLine={false} width={48} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--brand-line)', strokeWidth: 1 }} />
                {SERIES.map((s) => (
                  <Area
                    key={s.key}
                    name={s.label}
                    dataKey={s.key}
                    type="monotone"
                    stroke={s.color}
                    strokeWidth={s.width}
                    strokeDasharray={s.dash}
                    fill={`url(#dc-${s.key})`}
                    isAnimationActive={!reduced}
                    animationDuration={CHART_UI.animationMs}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
            {SERIES.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <svg width="16" height="6" aria-hidden>
                  <line x1="0" y1="3" x2="16" y2="3" stroke={s.color} strokeWidth={s.width + 0.5} strokeDasharray={s.dash} strokeLinecap="round" />
                </svg>
                {s.label}
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
