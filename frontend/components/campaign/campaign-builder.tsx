'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BotAvatar } from 'bot-avatars';
import { BorderBeam } from 'border-beam';
import { ArrowLeft, Check, Target, TrendingUp, Users } from 'lucide-react';
import { approveCampaign, generateCampaign, getCampaigns, getOpportunityCustomers, refineCampaign, saveCampaign } from '@/lib/api';
import { useIsDemo } from '@/lib/demo/use-demo';
import type { CampaignWithMetrics, Opportunity } from '@/lib/types';
import { StatePanel, statePanelActionClass, statePanelSecondaryClass } from '@/components/ui/state-panel';
import { cn } from '@/lib/utils';
import { AgentWorking } from './agent-working';
import { ApprovalGate } from './approval-gate';
import { CHANNELS, CHANNEL_META, DRAFT_STEPS, formatCurrency, formatNumber, type Channel } from './config';
import { MessagePreview } from './message-preview';
import { RefineBar } from './refine-bar';
import { StatusBadge } from './status-badge';

type BuilderProps = {
  opportunityId: string;
  backHref?: string;
};

type Draft = CampaignWithMetrics;

function Metric({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-base font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

export function CampaignBuilder({ opportunityId, backHref = '/opportunities' }: BuilderProps) {
  const router = useRouter();
  const demo = useIsDemo();
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<Channel>('WhatsApp');
  const [refining, setRefining] = useState(false);
  const [approving, setApproving] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [revision, setRevision] = useState(1);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [oppRes, listRes] = await Promise.all([getOpportunityCustomers(opportunityId), getCampaigns()]);
        if (!oppRes.success) throw new Error('Could not load the opportunity');
        const existing = (listRes.data ?? []).find((c: CampaignWithMetrics) => c.opportunity_id === opportunityId);
        let saved: Draft | undefined = existing;
        if (!saved) {
          const gen = await generateCampaign(opportunityId);
          if (!gen.success) throw new Error('The agent could not draft a campaign');
          const res = await saveCampaign(opportunityId, gen.data.campaign);
          saved = res.data;
        }
        if (cancelled || !saved) return;
        if (saved.status === 'Launched') {
          router.replace(`/analytics?campaignId=${saved.id}`);
          return;
        }
        setOpportunity(oppRes.data.opportunity);
        setDraft(saved);
        setChannel((saved.channel as Channel) ?? 'WhatsApp');
        setPhase('ready');
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Something went wrong');
        setPhase('error');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [opportunityId, router, attempt]);

  const retry = useCallback(() => {
    setPhase('loading');
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  const rewrite = async (instruction: string, nextChannel?: Channel): Promise<boolean> => {
    if (!draft || refining) return false;
    setRefining(true);
    setGateError(null);
    try {
      const res = await refineCampaign(draft.id, instruction, nextChannel);
      const message = res.data?.message_content;
      if (message) {
        setDraft({ ...draft, message_content: message });
        setRevision((n) => n + 1);
      }
      if (nextChannel) setChannel(nextChannel);
      return true;
    } catch (e) {
      setGateError(e instanceof Error ? e.message : 'Could not rewrite the draft');
      return false;
    } finally {
      setRefining(false);
    }
  };

  const approve = async () => {
    if (!draft) return;
    setApproving(true);
    setGateError(null);
    try {
      await approveCampaign(draft.id);
      setDraft({ ...draft, status: 'Approved' });
    } catch (e) {
      setGateError(e instanceof Error ? e.message : 'Could not approve the campaign');
    } finally {
      setApproving(false);
    }
  };

  if (phase === 'loading') {
    return (
      <div className="px-4 py-12">
        <AgentWorking active />
      </div>
    );
  }

  if (phase === 'error' || !draft || !opportunity) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <StatePanel tone="error" title="The agent could not draft this campaign" message={error ?? undefined}>
          <button type="button" onClick={retry} className={statePanelActionClass}>
            Try again
          </button>
          <Link href={backHref} className={statePanelSecondaryClass}>
            Back
          </Link>
        </StatePanel>
      </div>
    );
  }

  const approved = draft.status === 'Approved';
  const confidence = opportunity.confidence_score;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary">
          <ArrowLeft className="size-4" aria-hidden /> Opportunities
        </Link>
        <StatusBadge status={approved ? 'Approved' : 'PendingApproval'} />
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{draft.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drafted by the agent from <span className="font-medium text-foreground">{opportunity.title}</span>
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric icon={Users} label="Audience" value={formatNumber(opportunity.audience_size)} />
            <Metric icon={TrendingUp} label="Projected revenue" value={formatCurrency(opportunity.potential_revenue)} />
            <Metric icon={Target} label="Confidence" value={`${confidence}%`} />
          </div>

          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start gap-4">
              <BotAvatar type="pill" state="default" size={44} interactive={false} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Why the agent chose this</p>
                <p className="mt-1.5 text-sm leading-relaxed">{draft.reasoning ?? draft.objective}</p>
                {draft.expected_outcome && <p className="mt-2 text-xs text-muted-foreground">Expected: {draft.expected_outcome}</p>}
              </div>
            </div>
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
              {DRAFT_STEPS.map(({ label }) => (
                <li key={label} className="flex items-center gap-1.5">
                  <Check className="size-3 text-primary" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </section>

          <BorderBeam size="md" theme="dark" colorVariant="ocean" strength={1} active={!approved}>
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold tracking-tight">
                  Draft <span className="text-muted-foreground">v{revision}</span>
                </h2>
                <div role="tablist" aria-label="Channel" className="inline-flex rounded-lg bg-muted p-0.5">
                  {CHANNELS.map((ch) => {
                    const { icon: Icon } = CHANNEL_META[ch];
                    return (
                      <button
                        key={ch}
                        type="button"
                        role="tab"
                        aria-selected={channel === ch}
                        disabled={refining || approved}
                        onClick={() => ch !== channel && void rewrite('', ch)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60',
                          channel === ch ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <Icon className="size-3.5" aria-hidden /> {ch}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="mb-4 text-xs text-muted-foreground">
                {CHANNEL_META[channel].blurb} · {CHANNEL_META[channel].stat}
              </p>
              <dl className="mb-5 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Offer</dt>
                  <dd className="mt-0.5 font-medium">{draft.offer || 'None'}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Angle</dt>
                  <dd className="mt-0.5 font-medium">{draft.message_angle || 'Direct'}</dd>
                </div>
              </dl>
              {!approved && <RefineBar busy={refining} onRefine={rewrite} />}
            </section>
          </BorderBeam>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <MessagePreview channel={channel} message={draft.message_content} subject={draft.name} offer={draft.offer} busy={refining} />
          <ApprovalGate
            approved={approved}
            approving={approving}
            demo={demo}
            channel={channel}
            message={draft.message_content}
            audience={opportunity.audience_size}
            caseStatus={draft.case_status}
            error={gateError}
            onApprove={approve}
            onDiscard={() => router.push(backHref)}
          />
        </aside>
      </div>
    </div>
  );
}
