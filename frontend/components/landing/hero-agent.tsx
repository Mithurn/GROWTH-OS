'use client';

import { BorderBeam } from 'border-beam';
import { BotAvatar } from 'bot-avatars';
import { Check, CornerDownLeft, RotateCcw } from 'lucide-react';
import { AiOrb } from '@/components/ui/ai-orb';
import { CONSOLE, STAGES } from './config';
import { useAgentRun } from './use-agent-run';

const MONO = 'font-(family-name:--font-jetbrains)';
const AVATAR_SIZE = 64;

export function HeroAgent() {
  const run = useAgentRun();
  const { lines, result } = CONSOLE;
  const avatarState = run.done || run.typing ? 'default' : 'working';

  return (
    <div className="relative mx-auto w-full max-w-5xl text-left">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-10 -top-16 bottom-0 -z-10 bg-[radial-gradient(50%_60%_at_50%_30%,rgba(91,79,255,0.28),transparent)] blur-3xl"
      />
      <BorderBeam size="md" colorVariant="ocean" theme="dark" strength={0.75} duration={6}>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b12]/95 backdrop-blur">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3">
            <div className="flex items-center gap-1.5" aria-hidden>
              <span className="size-2.5 rounded-full bg-white/15" />
              <span className="size-2.5 rounded-full bg-white/15" />
              <span className="size-2.5 rounded-full bg-white/15" />
            </div>
            <p className={`${MONO} text-xs text-zinc-500`}>{CONSOLE.path}</p>
            <button
              type="button"
              onClick={run.replay}
              aria-label="Replay the agent run"
              className="cursor-pointer rounded-md p-1 text-zinc-500 transition-colors hover:text-zinc-200 focus-visible:outline-2 focus-visible:outline-indigo-400"
            >
              <RotateCcw className="size-3.5" aria-hidden />
            </button>
          </div>

          <div className="grid md:grid-cols-[15rem_1fr]">
            <aside className="flex items-center gap-4 border-b border-white/[0.07] p-5 md:flex-col md:items-start md:border-b-0 md:border-r">
              <div className="flex items-center gap-3">
                <BotAvatar shading="plastic" type="pill" state={avatarState} size={AVATAR_SIZE} aria-label="GrowthOS agent" />
                <div>
                  <p className="text-sm font-semibold text-zinc-100">Growth agent</p>
                  <p className="text-xs text-zinc-500">{run.done ? 'Waiting for approval' : run.typing ? 'Ready' : 'Working'}</p>
                </div>
              </div>
              <ol className="ml-auto flex gap-2 md:ml-0 md:mt-4 md:w-full md:flex-col md:gap-1">
                {STAGES.map((stage, index) => {
                  const complete = run.activeStage > index || (run.done && run.activeStage >= index);
                  const active = run.activeStage === index && !run.done;
                  return (
                    <li
                      key={stage.id}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors md:w-full ${
                        active ? 'bg-indigo-500/15 text-white' : complete ? 'text-zinc-300' : 'text-zinc-600'
                      }`}
                    >
                      <span className="flex size-4 shrink-0 items-center justify-center">
                        {complete ? (
                          <Check className="size-3.5 text-indigo-400" aria-hidden />
                        ) : active ? (
                          <AiOrb size="sm" state={stage.orb} theme="dark" />
                        ) : (
                          <span className="size-1.5 rounded-full bg-zinc-700" aria-hidden />
                        )}
                      </span>
                      <span className="hidden sm:inline">{stage.label}</span>
                    </li>
                  );
                })}
              </ol>
            </aside>

            <div className="flex min-h-[22rem] flex-col p-5 sm:p-6">
              <ul className={`${MONO} flex-1 space-y-2.5 text-[13px] leading-relaxed`} aria-live="polite">
                {lines.slice(0, run.visibleLines).map((line) => (
                  <li key={line.text} className="agent-reveal flex gap-3 text-zinc-300">
                    <span className="select-none text-indigo-400">{'>'}</span>
                    {line.text}
                  </li>
                ))}
              </ul>

              {run.showResult && (
                <div className="agent-reveal mt-5 rounded-xl border border-indigo-400/20 bg-indigo-500/[0.07] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-300">{result.label}</p>
                  <p className="mt-1 text-lg font-semibold tracking-tight text-white">{result.title}</p>
                  <dl className="mt-3 grid grid-cols-3 gap-2">
                    {result.metrics.map((metric) => (
                      <div key={metric.label} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                        <dt className="text-[10px] uppercase tracking-wider text-zinc-500">{metric.label}</dt>
                        <dd className="mt-0.5 text-base font-semibold text-white">{metric.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              <div className="mt-5">
                <BorderBeam size="line" colorVariant="ocean" theme="dark" strength={0.9} active={run.typing || !run.done}>
                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-3">
                    <span className={`${MONO} min-h-5 flex-1 truncate text-[13px] text-zinc-200`}>
                      {run.typed === 0 ? <span className="text-zinc-600">Ask the agent for a goal</span> : CONSOLE.command.slice(0, run.typed)}
                      {run.typing && <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-indigo-300" aria-hidden />}
                    </span>
                    <span className="flex size-7 items-center justify-center rounded-md bg-white/10 text-zinc-300" aria-hidden>
                      <CornerDownLeft className="size-3.5" />
                    </span>
                  </div>
                </BorderBeam>
              </div>
            </div>
          </div>
        </div>
      </BorderBeam>
    </div>
  );
}
