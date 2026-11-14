import { useEffect, useRef, useState } from 'react';
import { getAgentRun, getAgentRuns, getAgents } from '@/lib/api';
import { ACTIVITY_TIMING, RUN_TRACE_LINK_KEYS, RUN_TRACE_LIVE_STATUS } from './activity-config';

export type StepStatus = 'running' | 'done' | 'error';

export type RunStep = {
  id: string;
  node: string;
  toolName?: string | null;
  label?: string;
  status: StepStatus;
  latencyMs: number;
  startedAt?: string;
  createdAt?: string;
  args?: unknown;
  result?: unknown;
  error?: string | null;
  tokens?: { in: number; out: number };
};

export type RunLink = { label: string; href: string };

export type RunDetail = {
  id: string;
  status: string;
  goal?: string;
  summary: string;
  startedAt: string;
  steps: RunStep[];
  links: RunLink[];
};

export type RunSource = { runId?: string; agentId?: string };
export type RunState = 'loading' | 'ready' | 'empty' | 'error';

type RawStep = Omit<RunStep, 'status'> & { status?: StepStatus };
type RawRun = Omit<RunDetail, 'steps' | 'links' | 'summary'> & { steps?: RawStep[]; links?: RunLink[]; summary?: string };

export const isRunning = (run: Pick<RunDetail, 'status'> | null) => run?.status === RUN_TRACE_LIVE_STATUS;

function derivedLinks(steps: readonly RunStep[]): RunLink[] {
  const links: RunLink[] = [];
  for (const step of steps) {
    const result = step.result;
    if (!result || typeof result !== 'object') continue;
    for (const [key, base] of Object.entries(RUN_TRACE_LINK_KEYS)) {
      const id = (result as Record<string, unknown>)[key];
      if (typeof id !== 'string') continue;
      links.push(
        key === 'campaignId'
          ? { label: 'Open campaign', href: base }
          : { label: 'Open opportunity', href: `${base}${id}` },
      );
    }
  }
  return links;
}

function normalize(raw: RawRun): RunDetail {
  const steps = (raw.steps ?? []).map((s) => ({ ...s, status: s.status ?? (s.error ? 'error' : 'done') }) as RunStep);
  return { ...raw, summary: raw.summary ?? '', steps, links: raw.links ?? derivedLinks(steps) };
}

async function fetchRun(source: RunSource): Promise<RunDetail | null> {
  let agentId = source.agentId;
  let runId = source.runId;
  if (!agentId) {
    const agents = await getAgents({ limit: 1 });
    agentId = agents.data?.[0]?.id;
  }
  if (!agentId) return null;
  if (!runId) {
    const runs = await getAgentRuns(agentId, { limit: 1 });
    runId = runs.data?.[0]?.id;
  }
  if (!runId) return null;
  const detail = await getAgentRun(agentId, runId);
  return detail.data ? normalize(detail.data) : null;
}

export function useRunTrace(source: RunSource) {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [state, setState] = useState<RunState>('loading');
  const running = useRef(true);
  const { runId, agentId } = source;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    running.current = true;
    const load = async () => {
      try {
        const next = await fetchRun({ runId, agentId });
        if (cancelled) return;
        if (!next) return setState('empty');
        setRun(next);
        setState('ready');
        running.current = isRunning(next) || !runId;
      } catch {
        if (cancelled) return;
        setState((s) => (s === 'ready' ? s : 'error'));
      }
      if (!cancelled && running.current) timer = setTimeout(load, ACTIVITY_TIMING.runPollMs);
    };
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [runId, agentId]);

  return { run, state };
}
