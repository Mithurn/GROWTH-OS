import { ArrowDown } from 'lucide-react';
import { formatNumber } from '@/components/campaign/config';
import { FUNNEL } from './config';
import { Panel } from './panel';
import { formatPct, pct, type FunnelCounts } from './model';

const VIEW = 100;

export function FunnelPanel({ funnel }: { funnel: FunnelCounts }) {
  const top = funnel.sent || funnel.targeted;
  const widthOf = (count: number) => (top > 0 ? Math.max(FUNNEL.minBarPct, (count / top) * VIEW) : FUNNEL.minBarPct);
  const stages = FUNNEL.stages.map((s) => ({ ...s, count: funnel[s.key], width: widthOf(funnel[s.key]) }));

  return (
    <Panel title="Conversion funnel" description="Where customers drop off between stages" className="h-full">
      <ol className="flex flex-1 flex-col justify-center gap-0.5">
        {stages.map((s, i) => {
          const next = stages[i + 1];
          const bottom = next ? next.width : s.width;
          const lost = next ? pct(s.count - next.count, s.count) : 0;
          const half = VIEW / 2;
          const points = `${half - s.width / 2},0 ${half + s.width / 2},0 ${half + bottom / 2},${VIEW} ${half - bottom / 2},${VIEW}`;
          return (
            <li key={s.key} className="grid h-16 grid-cols-[76px_1fr_64px] items-center gap-3 sm:grid-cols-[96px_1fr_84px]">
              <div>
                <p className="text-label font-medium text-muted-foreground">{s.label}</p>
                <p className="text-lg font-semibold leading-tight tabular-nums text-foreground">
                  {formatNumber(s.count)} <span className="text-xs font-medium text-muted-foreground">{formatPct(pct(s.count, top))}</span>
                </p>
              </div>
              <div className="relative h-full">
                <svg viewBox={`0 0 ${VIEW} ${VIEW}`} preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
                  <polygon points={points} fill={s.color} />
                </svg>
              </div>
              <div className="text-xs tabular-nums text-muted-foreground">
                {next && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium text-body">
                    <ArrowDown className="size-3" aria-hidden />
                    <span className="sr-only">Drop-off </span>
                    {formatPct(lost)}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
