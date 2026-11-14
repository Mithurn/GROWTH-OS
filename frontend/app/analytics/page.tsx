'use client';

import { Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { BotAvatar } from 'bot-avatars';
import { BorderBeam } from 'border-beam';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { getCampaignAnalytics, getCampaigns, openAuthedSse } from '@/lib/api';
import type { CampaignWithMetrics } from '@/lib/types';
import { EngagementChart, SegmentBars, type PersonaSlice, type TimelinePoint } from '@/components/campaign/analytics-charts';
import { CHANNEL_META, TIMING, formatCurrency, formatNumber, type Channel } from '@/components/campaign/config';
import { useCountUp } from '@/components/campaign/hooks';
import { LiveFunnel, type FunnelCounts } from '@/components/campaign/live-funnel';
import { ConsoleCard, ConsoleLabel } from '@/components/campaign/console';
import { PrimaryAction } from '@/components/agent/primary-action';
import { StatusBadge } from '@/components/campaign/status-badge';
import { StatePanel, statePanelActionClass } from '@/components/ui/state-panel';

type AnalyticsData = {
  campaign: { id: string; name: string; objective: string; channel: string; status: string; potential_revenue: number };
  funnel: FunnelCounts;
  personaBreakdown: PersonaSlice[];
  timeline: TimelinePoint[];
  insights: {
    learnings: string[];
    nextAction: { title: string; description: string; potentialRevenue: number; confidence: number };
  };
};

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
const SKELETON_KPIS = 4;

function Panel({ title, children, className, glow }: { title: string; children: ReactNode; className?: string; glow?: boolean }) {
  return (
    <ConsoleCard glow={glow} className={className}>
      <section className="p-5">
        <ConsoleLabel className="mb-4">{title}</ConsoleLabel>
        {children}
      </section>
    </ConsoleCard>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="h-9 w-1/2 rounded-lg bg-muted" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: SKELETON_KPIS }, (_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-72 rounded-2xl bg-muted lg:col-span-2" />
        <div className="h-72 rounded-2xl bg-muted" />
      </div>
    </div>
  );
}

function CampaignPicker() {
  const [list, setList] = useState<CampaignWithMetrics[] | null>(null);

  useEffect(() => {
    getCampaigns()
      .then((res) => setList((res.data ?? []).filter((c: CampaignWithMetrics) => c.status === 'Launched' || c.status === 'Completed')))
      .catch(() => setList([]));
  }, []);

  if (!list) return <AnalyticsSkeleton />;
  if (list.length === 0) {
    return (
      <StatePanel tone="empty" title="No launched campaigns yet" message="Results appear here once a campaign has gone out.">
        <Link href="/campaigns" className={statePanelActionClass}>
          Go to campaigns
        </Link>
      </StatePanel>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {list.map((c) => {
        const Icon = CHANNEL_META[c.channel as Channel]?.icon;
        return (
          <li key={c.id}>
            <Link
              href={`/analytics?campaignId=${c.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{c.name}</span>
                <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {Icon && <Icon className="size-3.5" aria-hidden />}
                  {formatNumber(c.communications_clicked)} clicks from {formatNumber(c.communications_sent)} sent
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function AnalyticsView({ data }: { data: AnalyticsData }) {
  const { campaign, funnel, personaBreakdown, timeline, insights } = data;
  const live = campaign.status === 'Launched';
  const revenue = funnel.targeted > 0 ? Math.round((funnel.clicked / funnel.targeted) * campaign.potential_revenue) : 0;
  const animated = useCountUp(revenue, TIMING.countUpMs);
  const reached = campaign.potential_revenue > 0 ? Math.min(100, Math.round((revenue / campaign.potential_revenue) * 100)) : 0;
  const next = insights.nextAction;
  const rates = [
    { label: 'Delivered', value: pct(funnel.delivered, funnel.sent), hint: `${formatNumber(funnel.delivered)} of ${formatNumber(funnel.sent)}` },
    { label: 'Read', value: pct(funnel.read, funnel.delivered), hint: `${formatNumber(funnel.read)} readers` },
    { label: 'Clicked', value: pct(funnel.clicked, funnel.read), hint: `${formatNumber(funnel.clicked)} clicks` },
  ];

  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Link href="/analytics" className="hover:text-primary">
              Analytics
            </Link>
            <ChevronRight className="size-3" aria-hidden />
            <span className="truncate">{campaign.name}</span>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{campaign.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {campaign.channel} · {formatNumber(funnel.targeted)} customers targeted
          </p>
        </div>
        <StatusBadge status={campaign.status} />
      </header>

      <div className="grid gap-4 lg:grid-cols-12">
        <ConsoleCard glow className="lg:col-span-5">
          <section className="flex h-full flex-col p-5 sm:p-6">
            <ConsoleLabel>Revenue generated</ConsoleLabel>
            <p className="mt-3 text-5xl font-semibold tabular-nums tracking-tight text-white sm:text-6xl">{formatCurrency(animated)}</p>
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between font-mono text-[11px] text-zinc-500">
                <span>{reached}% of potential</span>
                <span>{formatCurrency(campaign.potential_revenue)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400 shadow-[0_0_12px_rgba(129,140,248,0.6)] transition-[width] duration-1000 ease-out"
                  style={{ width: `${reached}%` }}
                />
              </div>
            </div>
            <dl className="mt-6 grid grid-cols-3 gap-2 pt-1">
              {rates.map((r) => (
                <div key={r.label} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                  <dt className="text-[11px] uppercase tracking-wider text-zinc-500">{r.label}</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums text-white">{r.value}%</dd>
                  <p className="mt-0.5 truncate text-[11px] text-zinc-500">{r.hint}</p>
                </div>
              ))}
            </dl>
          </section>
        </ConsoleCard>

        <Panel title="Engagement over time" className="lg:col-span-7">
          <EngagementChart timeline={timeline} />
        </Panel>

        <Panel title="Funnel" className="lg:col-span-4">
          <LiveFunnel counts={funnel} live={live} heading="Sent to clicked" />
        </Panel>
        <Panel title="Audience mix" className="lg:col-span-4">
          <SegmentBars personas={personaBreakdown} />
        </Panel>
        <Panel title="Revenue by segment" className="lg:col-span-4">
          <SegmentBars personas={personaBreakdown} revenue={revenue} />
        </Panel>

        {insights.learnings.length > 0 && (
          <ConsoleCard className={next?.title ? 'lg:col-span-7' : 'lg:col-span-12'}>
            <section className="p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <BotAvatar type="pill" state="default" size={40} interactive={false} />
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-white">What the agent learned</h2>
                  <p className="text-xs text-zinc-500">From this campaign&apos;s results</p>
                </div>
              </div>
              <ul className="space-y-3">
                {insights.learnings.slice(0, 3).map((text) => (
                  <li key={text} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-sm leading-relaxed text-zinc-300">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-indigo-400" aria-hidden />
                    {text}
                  </li>
                ))}
              </ul>
            </section>
          </ConsoleCard>
        )}
        {next?.title && (
          <BorderBeam size="md" theme="dark" colorVariant="ocean" strength={1} className={insights.learnings.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'}>
            <ConsoleCard glow className="h-full">
              <section className="flex h-full flex-col p-5 sm:p-6">
                <ConsoleLabel className="text-indigo-300">Suggested next move</ConsoleLabel>
                <h3 className="mt-2 text-lg font-semibold leading-snug tracking-tight text-white">{next.title}</h3>
                <p className="mt-1.5 text-sm text-zinc-400">{next.description}</p>
                <p className="mt-3 font-mono text-xs text-zinc-500">
                  Worth about <span className="text-white">{formatCurrency(next.potentialRevenue)}</span> at {next.confidence}% confidence
                </p>
                <PrimaryAction href="/opportunities" className="mt-5 self-start">
                  Review opportunity <ArrowRight className="size-4" aria-hidden />
                </PrimaryAction>
              </section>
            </ConsoleCard>
          </BorderBeam>
        )}
      </div>
    </>
  );
}

function AnalyticsContent() {
  const campaignId = useSearchParams().get('campaignId');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async (id: string) => {
    try {
      const res = await getCampaignAnalytics(id);
      if (res.success && res.data) setData(res.data);
      else setError(res.error ?? 'Campaign not found');
    } catch {
      setError('Failed to load analytics');
    }
  }, []);

  useEffect(() => {
    if (!campaignId) return;
    void fetchAnalytics(campaignId);
  }, [campaignId, fetchAnalytics]);

  const status = data?.campaign.status;
  useEffect(() => {
    if (!campaignId || status !== 'Launched') return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    openAuthedSse(`/campaigns/${encodeURIComponent(campaignId)}/events`, () => void fetchAnalytics(campaignId))
      .then((close) => (cancelled ? close() : (stop = close)))
      .catch(() => undefined);
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [campaignId, status, fetchAnalytics]);

  let body: ReactNode;
  if (!campaignId) {
    body = <CampaignPicker />;
  } else if (error) {
    body = (
      <StatePanel tone="error" title="We could not load this campaign" message={error}>
        <Link href="/analytics" className={statePanelActionClass}>
          Pick another campaign
        </Link>
      </StatePanel>
    );
  } else if (!data || data.campaign.id !== campaignId) {
    body = <AnalyticsSkeleton />;
  } else {
    body = <AnalyticsView data={data} />;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      {!campaignId && (
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose a launched campaign to see how it performed.</p>
        </header>
      )}
      {body}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={null}>
      <AnalyticsContent />
    </Suspense>
  );
}
