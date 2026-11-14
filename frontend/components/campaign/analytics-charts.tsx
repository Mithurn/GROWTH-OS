'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity } from 'lucide-react';
import { CHART, formatCurrency, formatNumber } from './config';

export type TimelinePoint = { hour: number; sent: number; delivered: number; read: number; clicked: number };
export type PersonaSlice = { persona_name: string; count: number; percentage: number };

const hourLabel = (h: number) => (h <= 0 ? 'Start' : `+${h}h`);

const SERIES = [
  { key: 'Read', color: CHART.soft },
  { key: 'Clicked', color: CHART.glow },
] as const;

export function EngagementChart({ timeline }: { timeline: TimelinePoint[] }) {
  const data = timeline.map((p) => ({ t: hourLabel(p.hour), Read: p.read, Clicked: p.clicked }));
  const empty = data.length === 0 || data.every((d) => d.Read === 0 && d.Clicked === 0);

  if (empty) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 text-zinc-500" style={{ height: CHART.height }}>
        <Activity className="size-5" aria-hidden />
        <p className="text-sm">Waiting for the first events</p>
      </div>
    );
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={CHART.height}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {SERIES.map(({ key, color }) => (
              <linearGradient key={key} id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.07)" strokeDasharray="3 3" />
          <XAxis dataKey="t" tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickMargin={8} />
          <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            cursor={{ stroke: 'rgba(255,255,255,0.2)' }}
            contentStyle={{ background: '#14141f', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', fontSize: 12, color: '#fff' }}
            itemStyle={{ color: '#e4e4e7' }}
            labelStyle={{ color: '#a1a1aa' }}
          />
          {SERIES.map(({ key, color }) => (
            <Area key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={2} fill={`url(#fill-${key})`} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-2 flex gap-4 text-xs text-zinc-400">
        {SERIES.map(({ key, color }) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />
            {key}
          </span>
        ))}
      </div>
    </div>
  );
}

const SHADES = ['#818cf8', '#a78bfa', '#c4b5fd', '#ddd6fe'] as const;

export function SegmentBars({ personas, revenue }: { personas: PersonaSlice[]; revenue?: number }) {
  if (personas.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-500">No audience data yet</p>;
  }
  return (
    <ul className="space-y-4">
      {personas.map((p, i) => (
        <li key={p.persona_name}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-zinc-300">{p.persona_name}</span>
            <span className="shrink-0 font-mono text-xs tabular-nums text-zinc-400">
              {revenue !== undefined ? formatCurrency(Math.round((revenue * p.percentage) / 100)) : `${formatNumber(p.count)} · ${p.percentage}%`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${p.percentage}%`, background: SHADES[Math.min(i, SHADES.length - 1)] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
