'use client';

import { AgentAvatar } from '@/components/agent/agent-avatar';
import { Cursor } from './cursor';
import { PANEL_CLASS } from './panel';
import { OPPORTUNITY as C } from './config';
import { easeOut, progress, useVisualClock } from './use-visual-clock';

function cursorAt(t: number) {
  const [a, b] = C.cursorStops;
  const p = easeOut(progress(t, b.atMs - C.cursorMoveMs, b.atMs));
  return { x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
}

export function OpportunityVisual() {
  const { ref, t } = useVisualClock({ endMs: C.endMs, loop: true });
  const revenue = C.revenue.to * easeOut(progress(t, C.revenue.fromMs, C.revenue.toMs));
  const confidence = C.confidence.to * easeOut(progress(t, C.confidence.fromMs, C.confidence.toMs));
  const filled = (confidence / 100) * C.confidence.segments;
  const pressed = t >= C.pressMs && t < C.releaseMs;
  const { x, y } = cursorAt(t);

  return (
    <div ref={ref} className={`relative ${PANEL_CLASS}`}>
      <div className="grid h-full md:grid-cols-[1.25fr_1fr]">
        <div className="flex flex-col justify-between gap-8 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <AgentAvatar size="md" />
            <div>
              <p className="text-sm font-medium text-white">{C.title}</p>
              <p className="text-xs text-zinc-400">{C.type}, found by the agent</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Recoverable revenue</p>
            <p className="mt-1 text-6xl font-semibold tabular-nums tracking-tight text-white sm:text-7xl">
              ₹{revenue.toFixed(1)}
              <span className="text-4xl text-zinc-400 sm:text-5xl">L</span>
            </p>
          </div>
          <div role="meter" aria-label="Confidence" aria-valuemin={0} aria-valuemax={100} aria-valuenow={C.confidence.to}>
            <div className="mb-2 flex items-baseline justify-between text-xs">
              <span className="text-zinc-400">Confidence</span>
              <span className="tabular-nums text-white">{Math.round(confidence)}%</span>
            </div>
            <div className="flex gap-1" aria-hidden>
              {Array.from({ length: C.confidence.segments }, (_, i) => (
                <span key={i} className="h-2 flex-1 rounded-full bg-white/10">
                  <span
                    className="block h-full origin-left rounded-full bg-indigo-400"
                    style={{ transform: `scaleX(${Math.min(1, Math.max(0, filled - i))})` }}
                  />
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-6 border-t border-white/10 p-5 sm:p-6 md:border-l md:border-t-0">
          <dl className="grid divide-y md:flex-1 md:grid-rows-3 divide-white/10 text-sm">
            {C.stats.map((s) => (
              <div key={s.label} className="flex items-center justify-between py-2.5 md:py-0">
                <dt className="text-zinc-400">{s.label}</dt>
                <dd className="font-medium tabular-nums text-white">{s.value}</dd>
              </div>
            ))}
          </dl>
          <div>
            <p className="text-xs text-zinc-400">Recommended</p>
            <p className="mt-1 text-sm leading-snug text-zinc-200">{C.action}</p>
            <div
              aria-hidden
              className="mt-4 w-full rounded-lg bg-indigo-500 px-4 text-center py-2.5 text-sm font-medium text-white transition-transform duration-150 ease-out"
              style={{ transform: pressed ? 'scale(0.97)' : 'scale(1)' }}
            >
              {pressed ? C.pressedLabel : C.button}
            </div>
          </div>
        </div>
      </div>
      <Cursor x={x} y={y} pressed={pressed} />
    </div>
  );
}
