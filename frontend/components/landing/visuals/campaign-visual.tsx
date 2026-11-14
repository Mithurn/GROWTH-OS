'use client';

import { CAMPAIGN as C } from './config';
import { PANEL_CLASS } from './panel';
import { useVisualClock } from './use-visual-clock';

export function CampaignVisual() {
  const { ref, t, replay } = useVisualClock({ endMs: C.endMs, loop: false });
  const typed = C.instruction.slice(0, Math.max(0, Math.floor((t - C.typeFromMs) / C.typeCharMs)));
  const sent = t >= C.sendMs;
  const streamed = C.after.slice(0, Math.max(0, Math.floor((t - C.streamFromMs) / C.streamCharMs)));
  const body = t < C.sendMs ? C.before : t < C.streamFromMs ? '' : streamed;
  const typing = sent && streamed.length < C.after.length;

  return (
    <div ref={ref} onMouseEnter={replay} className={`flex flex-col ${PANEL_CLASS}`}>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-xs">
        <span className="font-medium text-white">{C.channel} preview</span>
        <span className="text-zinc-400">Dormant VIPs</span>
      </div>
      <div className="flex flex-1 flex-col justify-center bg-[radial-gradient(circle_at_20%_0%,rgba(91,79,255,0.10),transparent_60%)] px-4 py-5">
        <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-sm bg-[#0b5c4d] px-3.5 py-2.5 text-[13px] leading-relaxed text-white">
          <p className="min-h-[5.5em]">
            {body}
            {typing && <span className="ml-0.5 inline-block h-3.5 w-px translate-y-0.5 motion-safe:animate-pulse bg-white" aria-hidden />}
          </p>
          <p className="mt-1 text-right text-[10px] text-white/60">{C.time}</p>
        </div>
      </div>
      <div className="border-t border-white/10 p-3">
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {C.chips.map((chip) => {
            const active = t >= chip.onMs;
            return (
              <span
                key={chip.label}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors duration-200 ${
                  active ? 'border-indigo-400/60 bg-indigo-500/20 text-indigo-100' : 'border-white/10 text-zinc-400'
                }`}
              >
                {chip.label}
              </span>
            );
          })}
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] py-2 pl-3 pr-2 text-sm">
          <span className="min-h-5 flex-1 text-zinc-100">
            {sent ? <span className="text-zinc-500">Refine in a sentence</span> : typed || <span className="text-zinc-500">Refine in a sentence</span>}
          </span>
          <span className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${typed.length === C.instruction.length ? 'bg-indigo-500 text-white' : 'bg-white/10 text-zinc-400'}`}>
            Refine
          </span>
        </div>
      </div>
    </div>
  );
}
