'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Loader2, Sparkles, Users, Wallet } from 'lucide-react';
import { StatePanel, statePanelActionClass, statePanelSecondaryClass } from '@/components/ui/state-panel';
import { AiOrb } from '@/components/ui/ai-orb';
import { MetricTile } from '@/components/agent/metric-tile';
import { AgentAvatar } from '@/components/agent/agent-avatar';
import { AgentActivityFeed, type AgentActivityItem } from '@/components/agent/agent-activity-feed';
import { toActivityEntry } from '@/components/agent/activity-model';
import { AgentPromptInput } from '@/components/agent/agent-prompt-input';
import { ConfidenceMeter } from '@/components/agent/confidence-meter';
import { PrimaryAction } from '@/components/agent/primary-action';
import { StatusPill } from '@/components/agent/status-pill';
import { getActivityStream, getOpportunityDashboard, createOpportunityFromGoal } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Opportunity } from '@/lib/types';
import {
  ACTIVITY_FETCH_LIMIT,
  ACTIVITY_POLL_MS,
  COLD_START_HINT_MS,
  COLD_START_RETRY_MS,
  FEATURE_SWAP_MS,
  GOAL_PLACEHOLDERS,
  GOAL_SUGGESTIONS,
  GRID_COUNT,
  MAX_RETRIES,
  QUERY_ERROR_MS,
  RUN_STEPS,
  STEP_INTERVAL_MS,
  greetingFor,
  opportunityRevenue,
  parseChannel,
  parseTriggerReasons,
  priorityOf,
} from './dashboard-config';

interface ActivityRecord {
  id: string;
  agentId: string;
  actionType: string;
  description: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

function RunPanel({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div role="status" aria-live="polite" className="rounded-2xl border border-[#C7D2FE] bg-white p-6">
      <div className="flex items-center gap-3">
        <AiOrb size="md" state="searching" />
        <div>
          <p className="ai-shimmer text-base font-semibold">The agent is working on your goal</p>
          <p className="text-xs text-[#6B7280]">
            Step {current + 1} of {steps.length}
          </p>
        </div>
      </div>
      <ol className="mt-5 space-y-2.5">
        {steps.map((step, i) => (
          <li key={step} className={`flex items-center gap-2.5 text-sm ${i > current ? 'text-[#D1D5DB]' : 'text-[#1A1A1A]'}`}>
            {i < current ? (
              <Check className="size-4 text-emerald-500" aria-hidden />
            ) : i === current ? (
              <Loader2 className="size-4 text-[#5B4FFF] motion-safe:animate-spin" aria-hidden />
            ) : (
              <span className="size-4 rounded-full border border-[#E5E7EB]" aria-hidden />
            )}
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}

function FeaturedCard({ opp, pinned, onUnpin }: { opp: Opportunity; pinned: boolean; onUnpin: () => void }) {
  const priority = priorityOf(opp.priority_score);
  return (
    <article className="ai-step-in rounded-2xl border border-[#E5E7EB] bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusPill tone="live">{pinned ? 'Generated for your goal' : 'Top recommendation'}</StatusPill>
          <StatusPill tone={priority.tone}>{priority.label} priority</StatusPill>
        </div>
        {pinned && (
          <button type="button" onClick={onUnpin} className="text-xs font-medium text-[#6B7280] hover:text-[#1A1A1A]">
            Back to top recommendation
          </button>
        )}
      </div>

      <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[#1A1A1A]">{opp.title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#6B7280]">{opp.ai_summary || opp.description}</p>

      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-[#6B7280]">Recoverable</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-[#5B4FFF]">{formatCurrency(opportunityRevenue(opp))}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wider text-[#6B7280]">Audience</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-[#1A1A1A]">{opp.audience_size.toLocaleString()}</dd>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-xs font-medium uppercase tracking-wider text-[#6B7280]">Agent confidence</dt>
          <dd className="mt-3">
            <ConfidenceMeter value={opp.confidence_score} />
          </dd>
        </div>
      </dl>

      <div className="mt-6 border-t border-[#F0F0F2] pt-5">
        <p className="text-xs font-medium uppercase tracking-wider text-[#6B7280]">Why the agent flagged this</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {parseTriggerReasons(opp).map((reason) => (
            <li key={reason} className="flex items-center gap-1.5 rounded-lg bg-[#F8F7FF] px-2.5 py-1 text-xs text-[#4B5563]">
              <Check className="size-3 text-emerald-500" aria-hidden />
              {reason}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <PrimaryAction href={`/opportunities/${opp.opportunity_id}`}>
          Review and draft campaign
          <ArrowRight className="size-4" aria-hidden />
        </PrimaryAction>
        <span className="text-xs text-[#6B7280]">
          via {parseChannel(opp.recommended_action)} to {opp.supporting_customer_segment || 'all customers'}
        </span>
      </div>
    </article>
  );
}

function OpportunityTile({ opp }: { opp: Opportunity }) {
  const priority = priorityOf(opp.priority_score);
  return (
    <Link
      href={`/opportunities/${opp.opportunity_id}`}
      className="group flex flex-col rounded-2xl border border-[#E5E7EB] bg-white p-5 transition-colors hover:border-[#C7D2FE] hover:bg-[#FCFBFF]"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-snug text-[#1A1A1A] group-hover:text-[#4B3FE5]">{opp.title}</h3>
        <StatusPill tone={priority.tone}>{priority.label}</StatusPill>
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#6B7280]">{opp.description}</p>
      <div className="mt-4 flex items-end justify-between">
        <p className="text-lg font-semibold tabular-nums text-[#5B4FFF]">{formatCurrency(opportunityRevenue(opp))}</p>
        <p className="text-xs text-[#6B7280]">{opp.audience_size.toLocaleString()} customers</p>
      </div>
      <ConfidenceMeter value={opp.confidence_score} className="mt-3" />
    </Link>
  );
}

export default function HomePage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [activity, setActivity] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [coldStart, setColdStart] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [processing, setProcessing] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [pinned, setPinned] = useState<Opportunity | null>(null);
  const [swapping, setSwapping] = useState(false);
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const wakeTimer = setTimeout(() => setColdStart(true), COLD_START_HINT_MS);
    const run = async () => {
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            setColdStart(true);
            await new Promise((r) => setTimeout(r, COLD_START_RETRY_MS));
          }
          const data = await getOpportunityDashboard();
          if (data.success && data.data.topOpportunities) setOpportunities(data.data.topOpportunities);
          setColdStart(false);
          setLoading(false);
          return;
        } catch {
          if (attempt === MAX_RETRIES - 1) {
            setError('Unable to reach the backend. Try refreshing in a moment.');
            setColdStart(false);
            setLoading(false);
          }
        }
      }
    };
    run();
    return () => clearTimeout(wakeTimer);
  }, []);

  useEffect(() => {
    const poll = async () => {
      try {
        const data = await getActivityStream(ACTIVITY_FETCH_LIMIT);
        if (data.success && Array.isArray(data.data)) setActivity(data.data);
      } catch {
        return;
      } finally {
        setActivityLoading(false);
      }
    };
    poll();
    const interval = setInterval(poll, ACTIVITY_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  const submitGoal = async (goal: string) => {
    const plan = RUN_STEPS(goal);
    setSteps(plan);
    setStepIndex(0);
    setProcessing(true);
    setQuery('');
    setQueryError(null);

    stepTimer.current = setInterval(() => {
      setStepIndex((prev) => {
        if (prev + 1 < plan.length) return prev + 1;
        if (stepTimer.current) clearInterval(stepTimer.current);
        stepTimer.current = null;
        return prev;
      });
    }, STEP_INTERVAL_MS);

    try {
      const result = await createOpportunityFromGoal(goal);
      const data = await getOpportunityDashboard();
      if (data.success && data.data.topOpportunities) setOpportunities(data.data.topOpportunities);
      if (result.success && result.data) {
        setSwapping(true);
        setTimeout(() => {
          setPinned(result.data);
          setSwapping(false);
        }, FEATURE_SWAP_MS);
      }
    } catch {
      setQueryError("The agent couldn't turn that goal into an opportunity right now. Try rephrasing it.");
      setTimeout(() => setQueryError(null), QUERY_ERROR_MS);
    } finally {
      if (stepTimer.current) clearInterval(stepTimer.current);
      stepTimer.current = null;
      setProcessing(false);
    }
  };

  const unpin = () => {
    setSwapping(true);
    setTimeout(() => {
      setPinned(null);
      setSwapping(false);
    }, FEATURE_SWAP_MS);
  };

  const feed = useMemo<AgentActivityItem[]>(() => {
    const live: AgentActivityItem[] = processing
      ? [{ id: 'run', label: 'Thinking', description: steps[stepIndex] ?? '', createdAt: new Date().toISOString(), live: true, icon: Sparkles, kind: 'discovered' }]
      : [];
    return [...live, ...activity.map(toActivityEntry)];
  }, [activity, processing, steps, stepIndex]);

  const featured = pinned ?? opportunities[0];
  const tiles = (pinned ? opportunities : opportunities.slice(1)).slice(0, GRID_COUNT);
  const totalRevenue = opportunities.reduce((sum, o) => sum + opportunityRevenue(o), 0);
  const totalAudience = opportunities.reduce((sum, o) => sum + o.audience_size, 0);
  const hasContent = !loading && !error && opportunities.length > 0;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-8 sm:py-8">
      <header className="flex items-center gap-4">
        <AgentAvatar state={processing ? 'working' : 'idle'} size="lg" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-[#6B7280]">{greetingFor(new Date().getHours())}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1A1A1A] sm:text-3xl">Give the agent a goal</h1>
          <p className="mt-0.5 text-sm text-[#6B7280]">
            {loading
              ? coldStart
                ? 'The API is waking up. The first load can take up to a minute.'
                : 'Scanning for opportunities...'
              : 'It has been studying your customers, and will draft the campaign once you approve.'}
          </p>
        </div>
      </header>

      <AgentPromptInput
        className="mt-6"
        value={query}
        onChange={setQuery}
        onSubmit={submitGoal}
        busy={processing}
        placeholders={GOAL_PLACEHOLDERS}
        suggestions={GOAL_SUGGESTIONS}
        error={queryError}
      />

      {error && (
        <StatePanel tone="error" title="We could not load your dashboard" message={error}>
          <button type="button" onClick={() => window.location.reload()} className={statePanelActionClass}>
            Try again
          </button>
          <Link href="/onboarding" className={statePanelSecondaryClass}>
            Go to onboarding <ArrowRight className="size-4" />
          </Link>
        </StatePanel>
      )}

      {!loading && !error && opportunities.length === 0 && (
        <StatePanel tone="empty" title="No opportunities yet" message="Upload your customer data and the agent will find where revenue is leaking.">
          <Link href="/onboarding" className={statePanelActionClass}>
            Get started <ArrowRight className="size-4" />
          </Link>
        </StatePanel>
      )}

      {loading && !error && (
        <div className="mt-8 grid gap-6 lg:grid-cols-12" aria-hidden>
          <div className="h-80 animate-pulse rounded-2xl bg-[#F3F4F6] lg:col-span-8" />
          <div className="h-80 animate-pulse rounded-2xl bg-[#F3F4F6] lg:col-span-4" />
        </div>
      )}

      {hasContent && (
        <>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <MetricTile icon={Wallet} accent label="Revenue the agent found" value={formatCurrency(totalRevenue)} hint={`Recoverable across ${opportunities.length} opportunities`} />
            <MetricTile icon={Users} label="Customers in scope" value={totalAudience.toLocaleString()} hint="Reachable by the campaigns it proposes" />
            <MetricTile icon={Check} label="Open opportunities" value={String(opportunities.length)} hint={`${formatCurrency(Math.round(totalRevenue / opportunities.length))} average per opportunity`} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-12">
            <div className={`lg:col-span-8 transition-opacity duration-300 ${swapping ? 'opacity-0' : 'opacity-100'}`}>
              {processing ? (
                <RunPanel steps={steps} current={stepIndex} />
              ) : (
                featured && <FeaturedCard opp={featured} pinned={Boolean(pinned)} onUnpin={unpin} />
              )}
            </div>
            <div className="lg:col-span-4">
              <AgentActivityFeed items={feed} loading={activityLoading} busy={processing} seeAllHref="/activity" />
            </div>
          </div>

          {tiles.length > 0 && (
            <section className="mt-10" aria-label="More opportunities">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-tight text-[#1A1A1A]">More opportunities</h2>
                <Link href="/opportunities" className="text-xs font-medium text-[#5B4FFF] hover:underline">
                  View all
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tiles.map((opp) => (
                  <OpportunityTile key={opp.opportunity_id} opp={opp} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
