import { HEATMAP } from './config';
import { Panel } from './panel';
import type { Heatmap } from './model';

function bucket(value: number, max: number) {
  const idx = Math.min(HEATMAP.ramp.length - 1, Math.floor((value / max) * HEATMAP.ramp.length));
  return idx;
}

export function SendTimeHeatmap({ heatmap }: { heatmap: Heatmap }) {
  const all = heatmap.rates.flat();
  const max = Math.max(...all, 1);
  const best = Math.max(...all);

  return (
    <Panel title="Best time to send" description="Click rate by day and time of day">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-separate border-spacing-1 text-xs">
          <caption className="sr-only">Click rate by send day and time slot</caption>
          <thead>
            <tr>
              <th className="w-10" />
              {heatmap.slots.map((s) => (
                <th key={s} scope="col" className="pb-1 text-center font-medium text-muted-foreground">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmap.days.map((day, r) => (
              <tr key={day}>
                <th scope="row" className="pr-2 text-left font-medium text-muted-foreground">
                  {day}
                </th>
                {heatmap.rates[r].map((v, c) => {
                  const level = bucket(v, max);
                  return (
                    <td
                      key={heatmap.slots[c]}
                      className="h-9 rounded-md text-center font-medium tabular-nums"
                      style={{ background: HEATMAP.ramp[level], color: level >= HEATMAP.darkFrom ? '#fff' : '#3730A3' }}
                    >
                      {v}%{v === best && <span className="sr-only"> (best)</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span>Lower</span>
        <span className="flex gap-0.5" aria-hidden>
          {HEATMAP.ramp.map((c) => (
            <span key={c} className="size-3.5 rounded-sm" style={{ background: c }} />
          ))}
        </span>
        <span>Higher</span>
      </div>
    </Panel>
  );
}
