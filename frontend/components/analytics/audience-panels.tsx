'use client';

import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { formatCurrency, formatNumber } from '@/components/campaign/config';
import { CHART_UI, PERSONA_COLORS } from './config';
import { ChartEmpty, Panel } from './panel';
import type { PersonaSlice } from './model';

const colorOf = (i: number) => PERSONA_COLORS[i % PERSONA_COLORS.length];
const BAR_ROW_HEIGHT = 52;
const BAR_AXIS_WIDTH = 124;

export function AudienceMixPanel({ personas }: { personas: PersonaSlice[] }) {
  const reduced = useReducedMotion();
  const total = personas.reduce((s, p) => s + p.count, 0);

  return (
    <Panel title="Audience mix" description="Customers targeted by persona" className="h-full">
      {total === 0 ? (
        <ChartEmpty message="No audience data yet" height={CHART_UI.compactHeight} />
      ) : (
        <div className="flex flex-1 flex-col items-center gap-5 sm:flex-row">
          <div className="relative size-[184px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={personas}
                  dataKey="count"
                  nameKey="persona_name"
                  innerRadius={CHART_UI.donutInner}
                  outerRadius={CHART_UI.donutOuter}
                  paddingAngle={2}
                  cornerRadius={4}
                  stroke="none"
                  isAnimationActive={!reduced}
                  animationDuration={CHART_UI.animationMs}
                >
                  {personas.map((p, i) => (
                    <Cell key={p.persona_name} fill={colorOf(i)} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold tabular-nums text-foreground">{formatNumber(total)}</span>
              <span className="text-xs text-muted-foreground">customers</span>
            </div>
          </div>
          <ul className="w-full min-w-0 flex-1 space-y-2.5">
            {personas.map((p, i) => (
              <li key={p.persona_name} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-body">
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ background: colorOf(i) }} aria-hidden />
                  <span className="truncate">{p.persona_name}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  <span className="font-medium text-foreground">{p.percentage}%</span> · {formatNumber(p.count)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

export function SegmentRevenuePanel({ personas, revenue }: { personas: PersonaSlice[]; revenue: number }) {
  const reduced = useReducedMotion();
  const data = personas.map((p) => ({ name: p.persona_name, value: Math.round((revenue * p.percentage) / 100) }));
  const empty = revenue <= 0 || data.length === 0;

  return (
    <Panel title="Revenue by segment" description="Estimated share of campaign revenue" className="h-full">
      {empty ? (
        <ChartEmpty message="Revenue appears once customers click" height={CHART_UI.compactHeight} />
      ) : (
        <div role="img" aria-label="Bar chart of estimated revenue by persona">
          <ResponsiveContainer width="100%" height={Math.max(CHART_UI.compactHeight, data.length * BAR_ROW_HEIGHT)}>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }} barCategoryGap={12}>
              <CartesianGrid horizontal={false} stroke={CHART_UI.grid} />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={BAR_AXIS_WIDTH}
                tick={{ fill: 'var(--body)', fontSize: CHART_UI.fontSize }}
                axisLine={false}
                tickLine={false}
              />
              <Bar dataKey="value" radius={[0, CHART_UI.barRadius, CHART_UI.barRadius, 0]} isAnimationActive={!reduced} animationDuration={CHART_UI.animationMs}>
                {data.map((d, i) => (
                  <Cell key={d.name} fill={colorOf(i)} />
                ))}
                <LabelList dataKey="value" position="right" formatter={(v: number) => formatCurrency(v)} fill="var(--foreground)" fontSize={CHART_UI.fontSize} fontWeight={600} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}
