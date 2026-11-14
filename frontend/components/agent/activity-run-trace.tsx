'use client';

import { useEffect, useState } from 'react';
import { Terminal } from 'lucide-react';
import { getAgentRun, getAgentRuns, getAgents } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { RUN_TRACE_NODES, RUN_TRACE_STAGGER_MS } from './activity-config';

type Step = { id: string; node: string; toolName?: string | null; error?: string | null; latencyMs: number; result?: unknown };
type Run = { id: string; status: string; summary: string; startedAt: string; steps: Step[] };

function summarize(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const parts = Object.entries(result as Record<string, unknown>)
    .filter(([, v]) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
    .map(([k, v]) => `${k}=${v}`);
  return parts.length ? parts.join('  ') : null;
}

export function ActivityRunTrace({ className }: { className?: string }) {
  const [run, setRun] = useState<Run | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const agents = await getAgents({ limit: 1 });
        const agentId = agents.data?.[0]?.id;
        const runs = agentId ? await getAgentRuns(agentId, { limit: 1 }) : null;
        const latest = runs?.data?.[0];
        if (!latest) return void (!cancelled && setState('empty'));
        const detail = await getAgentRun(agentId, latest.id);
        if (cancelled) return;
        setRun({ ...latest, ...detail.data, steps: detail.data?.steps ?? [] });
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section aria-label="Latest agent run" className={cn('overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b12] text-white', className)}>
      <header className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <Terminal className="size-4 text-indigo-300" aria-hidden />
        <h2 className="text-sm font-semibold tracking-tight">Latest run trace</h2>
        {run && <span className="ml-auto font-mono text-[11px] text-white/50">{timeAgo(run.startedAt)}</span>}
      </header>
      <div className="p-4 font-mono text-xs">
        {state === 'loading' && (
          <ul className="space-y-2" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="h-4 animate-pulse rounded bg-white/10" />
            ))}
          </ul>
        )}
        {state === 'error' && <p role="alert" className="text-red-300">Could not load the run trace.</p>}
        {state === 'empty' && <p className="text-white/50">No runs yet. Start one from the Agent page.</p>}
        {state === 'ready' && run && (
          <>
            <ol className="space-y-3">
              {run.steps.map((step, i) => {
                const detail = summarize(step.result);
                const node = RUN_TRACE_NODES[step.node] ?? 'text-white/70';
                return (
                  <li key={step.id} className="ai-step-in" style={{ animationDelay: `${i * RUN_TRACE_STAGGER_MS}ms` }}>
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className={cn('uppercase tracking-wider', node)}>{step.node}</span>
                      <span className="text-white">{step.toolName}</span>
                      <span className="ml-auto text-white/40">{step.latencyMs}ms</span>
                    </p>
                    {detail && <p className="mt-0.5 break-words pl-3 text-white/55">{detail}</p>}
                    {step.error && <p className="mt-0.5 pl-3 text-red-300">{step.error}</p>}
                  </li>
                );
              })}
            </ol>
            <p className="mt-4 border-t border-white/10 pt-3 font-sans text-[13px] leading-snug text-white/80">{run.summary}</p>
          </>
        )}
      </div>
    </section>
  );
}
