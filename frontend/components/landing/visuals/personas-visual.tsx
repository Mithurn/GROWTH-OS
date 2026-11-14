'use client';

import { PERSONAS as C } from './config';
import { PANEL_CLASS } from './panel';
import { useVisualClock } from './use-visual-clock';

export function PersonasVisual() {
  const { ref, t, replay } = useVisualClock({ endMs: C.endMs, loop: false });
  const step = Math.min(C.selection.length - 1, Math.floor(t / C.stepMs));
  const selected = C.selection[step];
  const detail = C.rows[selected];

  return (
    <div ref={ref} onMouseEnter={replay} className={`grid ${PANEL_CLASS} md:grid-cols-[1.6fr_1fr]`}>
      <div className="flex flex-col p-2 sm:p-3">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-3 pb-2 text-xs text-zinc-500 sm:grid-cols-[1fr_auto_auto_5rem]">
          <span>Persona</span>
          <span className="text-right">Customers</span>
          <span className="text-right">Avg spend</span>
          <span className="hidden sm:block">Revenue share</span>
        </div>
        <ul className="flex flex-1 flex-col">
          {C.rows.map((row, i) => (
            <li
              key={row.name}
              className={`grid flex-1 grid-cols-[1fr_auto_auto] items-center gap-x-4 rounded-lg px-3 py-3 text-sm transition-colors duration-300 sm:grid-cols-[1fr_auto_auto_5rem] ${
                i === selected ? 'bg-indigo-500/15 text-white' : 'text-zinc-300'
              }`}
            >
              <span className="truncate font-medium">{row.name}</span>
              <span className="text-right tabular-nums">{row.customers}</span>
              <span className="text-right tabular-nums">{row.spend}</span>
              <span className="hidden items-center gap-2 sm:flex">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full origin-left rounded-full bg-indigo-400" style={{ transform: `scaleX(${row.share / C.rows[0].share})` }} />
                </span>
                <span className="w-7 text-right text-xs tabular-nums text-zinc-400">{row.share}%</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col justify-center gap-6 border-t border-white/10 p-5 md:border-l md:border-t-0">
        <div key={detail.name}>
          <p className="text-base font-semibold text-white">{detail.name}</p>
          <p className="mt-1 text-sm leading-snug text-zinc-400">{detail.note}</p>
        </div>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs text-zinc-500">Revenue share</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-white">{detail.share}%</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Since last order</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-white">{detail.days} days</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
