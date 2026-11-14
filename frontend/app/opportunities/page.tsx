'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { GOAL_LOADING_STEPS } from '@/lib/loading-copy';
import { AiLoader } from '@/components/ui/ai-loader';
import { StatePanel, statePanelActionClass } from '@/components/ui/state-panel';
import { AgentAvatar } from '@/components/agent/agent-avatar';
import { AgentPromptInput } from '@/components/agent/agent-prompt-input';
import { ConfidenceMeter } from '@/components/agent/confidence-meter';
import { StatusPill } from '@/components/agent/status-pill';
import { generateOpportunities, getOpportunityDashboard, createOpportunityFromGoal, getCampaigns } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CampaignWithMetrics, Opportunity } from '@/lib/types';
import {
  CATEGORY_FILTERS,
  GOAL_PLACEHOLDERS,
  GOAL_SUGGESTIONS,
  STATUS_FILTERS,
  categoryForType,
  parseChannel,
  stageOf,
} from './opportunities-config';

interface OpportunityReport {
  totalOpportunities: number;
  totalRevenuePotential: number;
  totalCustomers: number;
  topOpportunities: Opportunity[];
  opportunityDistribution: Opportunity[];
}

type StatusKey = (typeof STATUS_FILTERS)[number]['key'];

const idOf = (o: Opportunity) => o.opportunity_id || o.title;

const stageKeyOf = (map: Record<string, string>, o: Opportunity): StatusKey => {
  const cs = map[o.opportunity_id];
  if (!cs) return 'new';
  return cs === 'Launched' ? 'completed' : 'awaiting_review';
};

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-[#C7D2FE] bg-[#EEF2FF] text-[#4B3FE5]'
          : 'border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F3F4F6]',
      )}
    >
      {children}
    </button>
  );
}

function OpportunityRow({ opp, campaignStatus }: { opp: Opportunity; campaignStatus: string | null }) {
  const channel = parseChannel(opp.recommended_action);
  const stage = stageOf(campaignStatus);
  const audience = opp.customer_count ?? opp.audience_size;

  return (
    <li>
      <Link
        href={`/opportunities/${opp.opportunity_id}`}
        className="group grid items-center gap-x-6 gap-y-3 px-4 py-4 transition-colors hover:bg-[#FCFBFF] sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] lg:grid-cols-[minmax(0,1fr)_88px_88px_150px_200px]"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#1A1A1A] group-hover:text-[#4B3FE5]">{opp.title}</p>
          <p className="mt-0.5 line-clamp-1 text-xs text-[#6B7280]">{opp.trigger_reason || opp.description}</p>
        </div>
        <div className="hidden sm:block lg:text-right">
          <p className="text-sm font-semibold tabular-nums text-[#5B4FFF]">{formatCurrency(opp.potential_revenue)}</p>
          <p className="text-xs text-[#6B7280]">recoverable</p>
        </div>
        <div className="hidden lg:block lg:text-right">
          <p className="text-sm font-semibold tabular-nums text-[#1A1A1A]">{audience.toLocaleString()}</p>
          <p className="text-xs text-[#6B7280]">customers</p>
        </div>
        <ConfidenceMeter value={opp.confidence_score} className="hidden w-[150px] lg:flex" />
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <StatusPill tone={stage.tone}>{stage.label}</StatusPill>
            <span className="text-xs font-medium text-[#6B7280]">{stage.action(channel)}</span>
          </div>
          <ChevronRight className="size-4 text-[#D1D5DB] transition-transform group-hover:translate-x-0.5 group-hover:text-[#5B4FFF]" aria-hidden />
        </div>
        <div className="flex items-center gap-4 text-xs text-[#6B7280] sm:hidden">
          <span className="font-semibold text-[#5B4FFF]">{formatCurrency(opp.potential_revenue)}</span>
          <span>{audience.toLocaleString()} customers</span>
          <span>{Math.round(opp.confidence_score)}% confident</span>
        </div>
      </Link>
    </li>
  );
}

export default function OpportunitiesPage() {
  const [report, setReport] = useState<OpportunityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingGoal, setCreatingGoal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goal, setGoal] = useState('');
  const [goalError, setGoalError] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusKey | null>(null);
  const [campaignMap, setCampaignMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setError(null);
        const [res, campRes] = await Promise.all([getOpportunityDashboard(), getCampaigns().catch(() => null)]);
        const data = res.data as OpportunityReport;
        if (!mounted) return;
        if (data.totalOpportunities > 0) {
          setReport(data);
        } else {
          const gen = await generateOpportunities();
          if (!mounted) return;
          setReport(gen.data as OpportunityReport);
        }
        if (campRes) {
          const map: Record<string, string> = {};
          (campRes.data ?? []).forEach((c: CampaignWithMetrics) => {
            if (c.opportunity_id) map[c.opportunity_id] = c.status;
          });
          if (mounted) setCampaignMap(map);
        }
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Failed to load opportunities');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const all = useMemo<Opportunity[]>(() => {
    const seen = new Set<string>();
    return [...(report?.opportunityDistribution ?? []), ...(report?.topOpportunities ?? [])].filter((o) => {
      const key = idOf(o);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [report]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    all.forEach((o) => {
      const key = categoryForType(o.opportunity_type);
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return counts;
  }, [all]);

  const statusCounts = useMemo(() => {
    const counts: Record<StatusKey, number> = { new: 0, awaiting_review: 0, completed: 0 };
    all.forEach((o) => {
      counts[stageKeyOf(campaignMap, o)]++;
    });
    return counts;
  }, [all, campaignMap]);

  const filtered = all.filter(
    (o) => (!category || categoryForType(o.opportunity_type) === category) && (!status || stageKeyOf(campaignMap, o) === status),
  );
  const totalRevenue = all.reduce((sum, o) => sum + (o.potential_revenue ?? 0), 0);

  async function submitGoal(value: string) {
    try {
      setCreatingGoal(true);
      setGoal('');
      setGoalError(null);
      await createOpportunityFromGoal(value);
      const res = await getOpportunityDashboard();
      setReport(res.data as OpportunityReport);
    } catch {
      setGoalError('The agent could not create that opportunity. Try again.');
    } finally {
      setCreatingGoal(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-8 sm:py-8">
      <header className="flex items-center gap-4">
        <AgentAvatar state={creatingGoal ? 'working' : 'idle'} size="md" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-[#1A1A1A]">Opportunities</h1>
          <p className="text-sm text-[#6B7280]">
            {loading
              ? 'Scanning for opportunities...'
              : `${all.length} found by the agent, ${formatCurrency(totalRevenue)} in recoverable revenue`}
          </p>
        </div>
      </header>

      <AgentPromptInput
        className="mt-6"
        value={goal}
        onChange={setGoal}
        onSubmit={submitGoal}
        busy={creatingGoal}
        placeholders={GOAL_PLACEHOLDERS}
        suggestions={GOAL_SUGGESTIONS}
        error={goalError}
      />

      {creatingGoal && (
        <div className="mt-4 rounded-2xl border border-[#C7D2FE] bg-white px-6 py-6">
          <AiLoader size="md" state="searching" title="Building your opportunity" steps={GOAL_LOADING_STEPS} />
        </div>
      )}

      {loading && (
        <div className="mt-8 divide-y divide-[#F0F0F2] rounded-2xl border border-[#E5E7EB] bg-white" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex animate-pulse items-center gap-4 px-4 py-5">
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/2 rounded bg-[#F3F4F6]" />
                <div className="h-2.5 w-3/4 rounded bg-[#F3F4F6]" />
              </div>
              <div className="h-6 w-24 rounded-full bg-[#F3F4F6]" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <StatePanel tone="error" title="We could not load opportunities" message={error}>
          <button type="button" onClick={() => window.location.reload()} className={statePanelActionClass}>
            Try again
          </button>
        </StatePanel>
      )}

      {!loading && !error && (
        <>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <Chip
              active={!category && !status}
              onClick={() => {
                setCategory(null);
                setStatus(null);
              }}
            >
              All <span className="text-[#6B7280]">{all.length}</span>
            </Chip>
            {CATEGORY_FILTERS.map(({ key, icon: Icon }) => (
              <Chip
                key={key}
                active={category === key}
                onClick={() => setCategory(category === key ? null : key)}
              >
                <Icon className="size-3" aria-hidden />
                {key} <span className="text-[#6B7280]">{categoryCounts[key] ?? 0}</span>
              </Chip>
            ))}
            <span className="mx-1 hidden h-4 w-px bg-[#E5E7EB] sm:block" aria-hidden />
            {STATUS_FILTERS.map(({ key, label }) => (
              <Chip key={key} active={status === key} onClick={() => setStatus(status === key ? null : key)}>
                {label} <span className="text-[#6B7280]">{statusCounts[key]}</span>
              </Chip>
            ))}
          </div>

          {filtered.length === 0 ? (
            <StatePanel
              tone="empty"
              title={all.length === 0 ? 'No opportunities yet' : 'Nothing matches these filters'}
              message={all.length === 0 ? 'Give the agent a goal above and it will size the audience and revenue.' : 'Clear a filter to see the rest.'}
            >
              {all.length > 0 && (
                <button
                  type="button"
                  className={statePanelActionClass}
                  onClick={() => {
                    setCategory(null);
                    setStatus(null);
                  }}
                >
                  Clear filters <ArrowRight className="size-4" aria-hidden />
                </button>
              )}
            </StatePanel>
          ) : (
            <ul className="mt-4 divide-y divide-[#F0F0F2] overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
              {filtered.map((opp) => (
                <OpportunityRow key={idOf(opp)} opp={opp} campaignStatus={campaignMap[opp.opportunity_id] ?? null} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
