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
import { CHANNELS, CHANNEL_META, CONFIDENCE_SEGMENTS, DRAFT_STEPS, formatCurrency, formatNumber, type Channel } from './config';
import { ConsoleCard, ConsoleLabel, Segments } from './console';
import { MessagePreview } from './message-preview';
import { RefineBar } from './refine-bar';
import { StatusBadge } from './status-badge';

type BuilderProps = {
  opportunityId: string;
  backHref?: string;
};

type Draft = CampaignWithMetrics;

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
  const wordCount = draft.message_content.trim().split(/\s+/).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="mb-5">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary">
          <ArrowLeft className="size-4" aria-hidden /> Opportunities
        </Link>
      </div>

      <div className="space-y-4">
        <BorderBeam size="md" theme="dark" colorVariant="ocean" strength={1} active={!approved}>
          <ConsoleCard glow>
            <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="flex gap-4">
                <BotAvatar type="pill" state="default" size={52} interactive={false} className="shrink-0" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ConsoleLabel>Agent draft v{revision}</ConsoleLabel>
                    <StatusBadge dark status={approved ? 'Approved' : 'PendingApproval'} />
                  </div>
                  <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{draft.name}</h1>
                  <p className="mt-1 text-sm text-zinc-500">
                    From <span className="text-zinc-300">{opportunity.title}</span>
                  </p>
                  <p className="mt-4 text-sm leading-relaxed text-zinc-300">{draft.reasoning ?? draft.objective}</p>
                  {draft.expected_outcome && <p className="mt-2 font-mono text-xs text-indigo-300">Expected: {draft.expected_outcome}</p>}
                </div>
              </div>
              <dl className="grid grid-cols-3 gap-3 lg:grid-cols-1">
                {[
                  { icon: Users, label: 'Audience', value: formatNumber(opportunity.audience_size) },
                  { icon: TrendingUp, label: 'Projected revenue', value: formatCurrency(opportunity.potential_revenue) },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
                    <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
                      <Icon className="size-3.5" aria-hidden /> {label}
                    </dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums text-white">{value}</dd>
                  </div>
                ))}
                <div className="col-span-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 lg:col-span-1">
                  <dt className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
                    <Target className="size-3.5" aria-hidden /> Confidence
                  </dt>
                  <dd>
                    <Segments value={opportunity.confidence_score} count={CONFIDENCE_SEGMENTS} label="Confidence" />
                  </dd>
                </div>
              </dl>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-white/10 px-5 py-3 font-mono text-xs text-zinc-500 sm:px-6">
              {DRAFT_STEPS.map(({ label }) => (
                <li key={label} className="flex items-center gap-1.5">
                  <Check className="size-3 text-indigo-400" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </ConsoleCard>
        </BorderBeam>

        <div className="grid gap-4 lg:grid-cols-12">
          <ConsoleCard className="lg:col-span-7">
            <section className="p-5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold tracking-tight text-white">Message</h2>
                <div role="tablist" aria-label="Channel" className="inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5">
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
                          channel === ch ? 'bg-indigo-500 text-white' : 'text-zinc-400 hover:text-white',
                        )}
                      >
                        <Icon className="size-3.5" aria-hidden /> {ch}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                <p className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-zinc-200">{draft.message_content}</p>
                <p className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 font-mono text-[11px] text-zinc-500">
                  <span>{CHANNEL_META[channel].blurb}</span>
                  <span className="tabular-nums">
                    {wordCount} words · {draft.message_content.length} chars
                  </span>
                </p>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-zinc-500">Offer</dt>
                  <dd className="mt-0.5 text-zinc-200">{draft.offer || 'None'}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-zinc-500">Angle</dt>
                  <dd className="mt-0.5 text-zinc-200">{draft.message_angle || 'Direct'}</dd>
                </div>
              </dl>

              {!approved && <RefineBar busy={refining} onRefine={rewrite} className="mt-6" />}
            </section>
          </ConsoleCard>

          <ConsoleCard glow className="lg:col-span-5">
            <div className="flex h-full flex-col items-center justify-center px-4 py-6">
              <ConsoleLabel className="mb-4">{channel} preview</ConsoleLabel>
              <MessagePreview channel={channel} message={draft.message_content} subject={draft.name} offer={draft.offer} busy={refining} />
            </div>
          </ConsoleCard>
        </div>

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
      </div>
    </div>
  );
}
