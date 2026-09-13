'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAgentRun, getAgentRuns, getAgents, openAuthedSse, runAgent } from '@/lib/api';

type AgentRow = {
  id: string;
  name: string;
  goal: string;
  status: string;
};

type RunRow = {
  id: string;
  status: string;
  summary: string;
  stepCount: number;
  mode: string;
  startedAt: string;
};

type StepRow = {
  id: string;
  node: string;
  toolName?: string | null;
  error?: string | null;
  latencyMs: number;
  result?: unknown;
};

function resultLine(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const row = result as Record<string, unknown>;
  if (typeof row.totalCustomers === 'number') {
    return `${row.totalCustomers} customers · churn ${row.churnRiskCustomers ?? 0} · dormant ${row.dormantCustomers ?? 0} · AOV ₹${Math.round(Number(row.avgOrderValue ?? 0))}`;
  }
  if (typeof row.audienceSize === 'number') {
    return `${row.opportunity_type ?? 'segment'}: ${row.audienceSize} people`;
  }
  if (typeof row.lowRevenue === 'number' || typeof row.highRevenue === 'number') {
    return `₹${row.lowRevenue ?? 0}–${row.highRevenue ?? 0}`;
  }
  if (typeof row.allowed === 'boolean') {
    return row.allowed ? 'Guardrails allowed' : 'Guardrails blocked';
  }
  if (typeof row.thought === 'string') return row.thought;
  if (typeof row.note === 'string') return row.note;
  return null;
}

export default function AgentPage() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [agentId, setAgentId] = useState<string>('');
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = useCallback(async (id: string) => {
    const res = await getAgentRuns(id);
    setAvailable(res.available !== false);
    setRuns(res.data ?? []);
    return res;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getAgents({ limit: 20 });
        const rows = (list.data ?? []) as AgentRow[];
        if (cancelled) return;
        setAgents(rows);
        const first = rows[0]?.id;
        if (first) {
          setAgentId(first);
          await loadRuns(first);
        } else {
          setAvailable(true);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load agents');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadRuns]);

  const onSelectAgent = async (id: string) => {
    setAgentId(id);
    setSelectedRunId('');
    setSteps([]);
    setSummary('');
    setError(null);
    try {
      await loadRuns(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runs');
    }
  };

  useEffect(() => {
    if (!agentId || !selectedRunId) return;
    const run = runs.find((r) => r.id === selectedRunId);
    if (run && run.status !== 'running') return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    openAuthedSse(
      `/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(selectedRunId)}/events`,
      (_event, payload) => {
        const row = payload as { payload?: { description?: string; details?: { latencyMs?: number; node?: string } } };
        setSteps((prev) => [
          ...prev,
          {
            id: `${prev.length}`,
            node: row.payload?.details?.node ?? 'tools',
            toolName: row.payload?.description,
            latencyMs: row.payload?.details?.latencyMs ?? 0,
          },
        ]);
      },
    ).then((close) => {
      if (cancelled) close();
      else stop = close;
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [agentId, selectedRunId, runs]);

  const onSelectRun = async (runId: string) => {
    if (!agentId) return;
    setSelectedRunId(runId);
    setError(null);
    try {
      const res = await getAgentRun(agentId, runId);
      setSteps(res.data?.steps ?? []);
      setSummary(res.data?.summary ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load run');
    }
  };

  const onRun = async () => {
    if (!agentId) return;
    setRunning(true);
    setError(null);
    try {
      await runAgent(agentId);
      await loadRuns(agentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run agent');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#8B92A5] mb-2">Shadow</p>
          <h1 className="text-2xl font-semibold text-[#1A1A1A]">Agent run trace</h1>
          <p className="text-sm text-[#6B7280] mt-2 max-w-xl">
            Observe-only. The operator records what it would do. It cannot create, draft, or launch.
            Without an OpenRouter key this is a fixed script over your tenant numbers — not a live model.
          </p>
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={!agentId || running}
          className="px-4 py-2 rounded-full text-sm font-medium text-white disabled:opacity-40"
          style={{ background: '#5B4FFF' }}
        >
          {running ? 'Running…' : 'Run once'}
        </button>
      </div>

      {loading && <p className="text-sm text-[#6B7280]">Loading…</p>}
      {error && <p className="text-sm text-[#EF4444] mb-4">{error}</p>}

      {!loading && agents.length === 0 && (
        <p className="text-sm text-[#6B7280]">No agent yet. Finish onboarding to create one.</p>
      )}

      {agents.length > 0 && (
        <label className="block mb-6">
          <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[#8B92A5]">Agent</span>
          <select
            value={agentId}
            onChange={(e) => onSelectAgent(e.target.value)}
            className="mt-2 w-full max-w-md border border-[#E5E7EB] rounded-xl px-3 py-2 text-sm bg-white"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} — {a.status}
              </option>
            ))}
          </select>
        </label>
      )}

      {available === false && (
        <div className="mb-6 rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm text-[#6B7280]">
          Run tables are not applied yet. A tick still observes; nothing is stored to list here.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
          <h2 className="text-sm font-medium text-[#1A1A1A] mb-3">Runs</h2>
          {runs.length === 0 ? (
            <p className="text-sm text-[#9CA3AF]">No persisted runs.</p>
          ) : (
            <ul className="space-y-2">
              {runs.map((run) => (
                <li key={run.id}>
                  <button
                    type="button"
                    onClick={() => onSelectRun(run.id)}
                    className={`w-full text-left rounded-xl px-3 py-2 text-sm ${
                      selectedRunId === run.id ? 'bg-[#EEF2FF] text-[#5B4FFF]' : 'hover:bg-[#F3F4F6]'
                    }`}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{run.status}</span>
                      <span className="text-[#9CA3AF]">{run.stepCount} steps</span>
                    </div>
                    <p className="text-[#6B7280] mt-1 line-clamp-2">{run.summary || 'No summary'}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
          <h2 className="text-sm font-medium text-[#1A1A1A] mb-3">Steps</h2>
          {summary && <p className="text-sm text-[#1A1A1A] mb-3">{summary}</p>}
          {steps.length === 0 ? (
            <p className="text-sm text-[#9CA3AF]">Select a run.</p>
          ) : (
            <ol className="space-y-2">
              {steps
                .filter((step) => step.toolName || step.error)
                .map((step, i) => (
                <li key={step.id} className="text-sm border-b border-[#F3F4F6] pb-2">
                  <span className="text-[#9CA3AF] mr-2">{i + 1}.</span>
                  <span className="font-medium">{step.toolName || step.node}</span>
                  <span className="text-[#9CA3AF] ml-2">{step.latencyMs}ms</span>
                  {resultLine(step.result) && (
                    <p className="text-[#6B7280] mt-1">{resultLine(step.result)}</p>
                  )}
                  {step.error && <p className="text-[#EF4444] mt-1">{step.error}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
