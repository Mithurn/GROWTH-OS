'use client';

import Link from 'next/link';
import { ArrowRight, Check, ChevronRight, Loader2, TriangleAlert } from 'lucide-react';
import { AiOrb } from '@/components/ui/ai-orb';
import { cn } from '@/lib/utils';
import { ACTIVITY_TIMING, RUN_TRACE_NODES } from './activity-config';
import { useNow } from './activity-model';
import { isRunning, useRunTrace, type RunDetail, type RunSource, type RunState, type RunStep } from './activity-run-model';
import { AgentAvatar } from './agent-avatar';

const formatMs = (ms: number) => (ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`);
const formatTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const stringify = (value: unknown) => JSON.stringify(value, null, 2);

function stepElapsed(run: RunDetail, i: number, now: number) {
  const step = run.steps[i];
  if (step.status !== 'running') return step.latencyMs;
  const from = step.startedAt ?? run.steps[i - 1]?.createdAt ?? run.startedAt;
  return Math.max(0, now - new Date(from).getTime());
}

const STEP_ICON = {
  running: <Loader2 className="size-3.5 animate-spin text-indigo-300 motion-reduce:animate-none" aria-label="Running" />,
  done: <Check className="size-3.5 text-emerald-400" aria-label="Done" />,
  error: <TriangleAlert className="size-3.5 text-red-400" aria-label="Failed" />,
} as const;

function StepRow({ step, elapsed }: { step: RunStep; elapsed: number }) {
  const node = RUN_TRACE_NODES[step.node] ?? 'text-white/70';
  const hasIO = step.args !== undefined || step.result !== undefined || Boolean(step.error);
  const title = (
    <>
      <span className="mt-0.5 shrink-0">{STEP_ICON[step.status]}</span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className={cn('text-2xs', node)}>{step.node}</span>
          <span className="text-white">{step.toolName}</span>
        </span>
        {step.label && <span className="mt-0.5 block font-sans text-xs text-white/50">{step.label}</span>}
      </span>
      <span className={cn('shrink-0 tabular-nums', step.status === 'running' ? 'text-indigo-300' : 'text-white/40')}>{formatMs(elapsed)}</span>
      {hasIO && <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-white/30 transition-transform group-open:rotate-90" aria-hidden />}
    </>
  );
  const row = 'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left';
  return (
    <li className="ai-step-in">
      {hasIO ? (
        <details className="group rounded-lg hover:bg-white/[0.03] open:bg-white/[0.04]">
          <summary className={cn(row, 'cursor-pointer list-none [&::-webkit-details-marker]:hidden')}>{title}</summary>
          <div className="space-y-2 px-2.5 pb-3 pl-9">
            {step.args !== undefined && <Payload label="Input" value={stringify(step.args)} />}
            {step.result !== undefined && step.result !== null && <Payload label="Output" value={stringify(step.result)} />}
            {step.error && <Payload label="Error" value={step.error} tone="text-red-300" />}
            {step.tokens && (
              <p className="text-2xs text-white/40">
                {formatTokens(step.tokens.in)} tokens in, {formatTokens(step.tokens.out)} out
              </p>
            )}
          </div>
        </details>
      ) : (
        <div className={row}>{title}</div>
      )}
    </li>
  );
}

function Payload({ label, value, tone = 'text-white/70' }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="mb-1 text-2xs text-white/35">{label}</p>
      <pre className={cn('max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-black/40 p-2 text-2xs leading-relaxed', tone)}>{value}</pre>
    </div>
  );
}

function Stat({ label, value, live }: { label: string; value: string; live?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
      <dt className="text-2xs text-white/40">{label}</dt>
      <dd className={cn('mt-0.5 text-sm font-semibold tabular-nums', live ? 'text-indigo-300' : 'text-white')}>{value}</dd>
    </div>
  );
}

export function RunTraceBody({ run, state }: { run: RunDetail | null; state: RunState }) {
  const running = isRunning(run);
  const now = useNow(ACTIVITY_TIMING.runTickMs, !running);

  if (state === 'loading') {
    return (
      <ul className="space-y-2 p-4" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="h-9 animate-pulse rounded-lg bg-white/10" />
        ))}
      </ul>
    );
  }
  if (state === 'error') return <p role="alert" className="p-4 font-sans text-sm text-red-300">Could not load the run trace.</p>;
  if (state === 'empty' || !run) return <p className="p-4 font-sans text-sm text-white/50">No runs yet. Start one from the Agent page.</p>;

  const total = run.steps.reduce((t, s) => t + s.latencyMs, 0);
  const elapsed = running ? Math.max(0, now - new Date(run.startedAt).getTime()) : total;
  const tokens = run.steps.reduce((t, s) => t + (s.tokens ? s.tokens.in + s.tokens.out : 0), 0);
  const active = run.steps.some((s) => s.status === 'running');
  const sinceLast = Math.max(0, now - new Date(run.steps.at(-1)?.createdAt ?? run.startedAt).getTime());

  return (
    <div className="font-mono text-xs">
      <dl className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
        <Stat label={running ? 'Running for' : 'Total time'} value={formatMs(elapsed)} live={running} />
        <Stat label="Steps" value={String(run.steps.length)} />
        <Stat label="Tokens" value={tokens ? formatTokens(tokens) : 'n/a'} />
        <Stat label="Avg latency" value={run.steps.length ? formatMs(total / run.steps.length) : 'n/a'} />
      </dl>
      <ol className="space-y-0.5 px-2 pb-2">
        {run.steps.map((step, i) => (
          <StepRow key={step.id} step={step} elapsed={stepElapsed(run, i, now)} />
        ))}
        {running && !active && (
          <li className="flex items-center gap-2.5 px-2.5 py-2 text-white/60">
            <AiOrb size="sm" state="working" theme="dark" />
            <span>Thinking about the next step</span>
            <span className="ml-auto tabular-nums text-indigo-300">{formatMs(sinceLast)}</span>
          </li>
        )}
      </ol>
      {!running && (
        <div className="mx-4 mb-4 mt-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3 font-sans">
          <p className="flex items-center gap-1.5 text-2xs font-medium text-emerald-300">
            <Check className="size-3.5" aria-hidden /> Outcome
          </p>
          {run.summary && <p className="mt-1.5 text-label leading-snug text-white/85">{run.summary}</p>}
          {run.links.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {run.links.map((link) => (
                <Link key={link.href + link.label} href={link.href} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-foreground hover:bg-white/90">
                  {link.label} <ArrowRight className="size-3" aria-hidden />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function RunTraceHeader({ run, title, state }: { run: RunDetail | null; title: string; state?: RunState }) {
  const running = isRunning(run);
  const failed = state === 'error';
  return (
    <div className="flex items-center gap-3">
      <AgentAvatar size="sm" state={running ? 'working' : 'idle'} />
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-sans text-sm font-semibold tracking-tight text-white">{title}</h2>
        <p className="mt-0.5 flex items-center gap-1.5 font-mono text-2xs text-white/50">
          <span className="relative flex size-1.5">
            {running && <span className="absolute inline-flex size-full rounded-full bg-indigo-400 opacity-70 motion-safe:animate-ping" />}
            <span className={cn('relative inline-flex size-1.5 rounded-full', running ? 'bg-indigo-400' : failed ? 'bg-red-400' : 'bg-emerald-400')} />
          </span>
          {running ? 'Running live' : failed ? 'Unavailable' : run ? 'Finished' : 'Loading'}
        </p>
      </div>
    </div>
  );
}

export function ActivityRunTrace({ source = {}, title = 'Latest run', className }: { source?: RunSource; title?: string; className?: string }) {
  const { run, state } = useRunTrace(source);
  return (
    <section aria-label={title} className={cn('overflow-hidden rounded-2xl border border-white/10 bg-ink-raised text-white', className)}>
      <header className="border-b border-white/10 px-4 py-3">
        <RunTraceHeader run={run} state={state} title={title} />
      </header>
      <RunTraceBody run={run} state={state} />
    </section>
  );
}
