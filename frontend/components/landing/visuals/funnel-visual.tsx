'use client';

import { FUNNEL as C } from './config';
import { PANEL_CLASS } from './panel';
import { easeOut, progress, useVisualClock } from './use-visual-clock';

const TOP = C.rows[0].value;

export function FunnelVisual() {
  const { ref, t, replay } = useVisualClock({ endMs: C.endMs, loop: false });

  return (
    <div ref={ref} onMouseEnter={replay} className={`flex flex-col justify-between gap-6 p-5 ${PANEL_CLASS}`}>
      <ul className="flex flex-col gap-5">
        {C.rows.map((row, i) => {
          const start = C.firstMs + i * C.rowStaggerMs;
          const p = easeOut(progress(t, start, start + C.rowRiseMs));
          return (
            <li key={row.label}>
              <div className="mb-2 flex items-baseline justify-between text-sm">
                <span className="text-zinc-400">{row.label}</span>
                <span className="text-xl font-semibold tabular-nums text-white">{Math.round(row.value * p)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full origin-left rounded-full bg-gradient-to-r from-indigo-500 to-indigo-300"
                  style={{ transform: `scaleX(${(row.value / TOP) * p})` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <dl className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 pt-4 text-center">
        {C.footer.map((f) => (
          <div key={f.label}>
            <dd className="text-base font-medium tabular-nums text-white">{f.value}</dd>
            <dt className="mt-0.5 text-xs text-zinc-400">{f.label}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}
