'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Sparkles, Target, TrendingUp, Users } from 'lucide-react';
import { approveCampaign, generateCampaign, getCampaigns, getOpportunityCustomers, refineCampaign, saveCampaign } from '@/lib/api';
import { useIsDemo } from '@/lib/demo/use-demo';
import type { CampaignWithMetrics, Opportunity } from '@/lib/types';
import { AgentAvatar } from '@/components/agent/agent-avatar';
import { ConfidenceMeter } from '@/components/agent/confidence-meter';
import { StatePanel, statePanelActionClass, statePanelSecondaryClass } from '@/components/ui/state-panel';
import { cn } from '@/lib/utils';
import { AgentWorking } from './agent-working';
import { ApprovalGate } from './approval-gate';
import { ChannelTabs } from './channel-tabs';
import { CHANNEL_META, DRAFT_STEPS, PHONE, formatCurrency, formatNumber, type Channel } from './config';
import { MessagePreview } from './message-preview';
import { Panel, PanelLabel, Stat } from './panel';
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
      <Link href={backHref} className="mb-5 inline-flex items-center gap-1.5 text-sm text-[#6B7280] transition-colors hover:text-[#5B4FFF]">
        <ArrowLeft className="size-4" aria-hidden /> Opportunities
      </Link>

      <Panel className="mb-6">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex gap-4">
            <AgentAvatar state="idle" size="lg" className="shrink-0" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <PanelLabel>Agent draft v{revision}</PanelLabel>
                <StatusBadge status={approved ? 'Approved' : 'PendingApproval'} />
              </div>
              <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-[#1A1A1A] sm:text-[28px]">{draft.name}</h1>
              <p className="mt-0.5 text-sm text-[#6B7280]">From {opportunity.title}</p>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#4B5563]">{draft.reasoning ?? draft.objective}</p>
              {draft.expected_outcome && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#EEF2FF] px-2.5 py-1 text-xs font-medium text-[#4B3FE5]">
                  <Sparkles className="size-3" aria-hidden /> Expected: {draft.expected_outcome}
                </p>
              )}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 lg:w-[300px]">
            <Stat icon={Users} label="Audience">
              {formatNumber(opportunity.audience_size)}
            </Stat>
            <Stat icon={TrendingUp} label="Projected">
              {formatCurrency(opportunity.potential_revenue)}
            </Stat>
            <div className="col-span-2 rounded-xl bg-[#F9FAFB] px-3.5 py-3">
              <dt className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[#9CA3AF]">
                <Target className="size-3.5" aria-hidden /> Confidence
              </dt>
              <dd>
                <ConfidenceMeter value={opportunity.confidence_score} />
              </dd>
            </div>
          </dl>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-[#F0F1F4] px-5 py-3 text-xs text-[#6B7280] sm:px-6">
          {DRAFT_STEPS.map(({ label }) => (
            <li key={label} className="flex items-center gap-1.5">
              <Check className="size-3.5 text-emerald-500" aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      </Panel>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_372px]">
        <div className="min-w-0 space-y-6">
          <Panel>
            <section className="p-5 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold tracking-tight text-[#1A1A1A]">Message</h2>
                <ChannelTabs value={channel} disabled={refining || approved} onChange={(ch) => void rewrite('', ch)} />
              </div>

              <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#1A1A1A]">{draft.message_content}</p>
                <p className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E7EB] pt-2.5 text-xs text-[#6B7280]">
                  <span>{CHANNEL_META[channel].blurb}</span>
                  <span className="tabular-nums">
                    {wordCount} words · {draft.message_content.length} characters
                  </span>
                </p>
              </div>

              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <Stat label="Offer">
                  <span className="text-sm font-medium">{draft.offer || 'None'}</span>
                </Stat>
                <Stat label="Angle">
                  <span className="text-sm font-medium">{draft.message_angle || 'Direct'}</span>
                </Stat>
              </dl>

              {!approved && (
                <div className="mt-6 border-t border-[#F0F1F4] pt-5">
                  <p className="mb-3 text-sm font-medium text-[#1A1A1A]">Ask the agent to change it</p>
                  <RefineBar busy={refining} onRefine={rewrite} />
                </div>
              )}
            </section>
          </Panel>

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

        <aside className={cn('lg:sticky', PHONE.stickyTop)} aria-label="Phone preview">
          <PanelLabel className="mb-4 text-center">{channel} preview</PanelLabel>
          <MessagePreview channel={channel} message={draft.message_content} subject={draft.name} offer={draft.offer} busy={refining} />
        </aside>
      </div>
    </div>
  );
}
