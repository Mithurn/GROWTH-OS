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

function Card({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-5 ${className ?? ''}`}>
      <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
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
  const next = insights.nextAction;

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

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Revenue" value={formatCurrency(animated)} hint={`of ${formatCurrency(campaign.potential_revenue)} potential`} />
        <Kpi label="Delivered" value={`${pct(funnel.delivered, funnel.sent)}%`} hint={`${formatNumber(funnel.delivered)} of ${formatNumber(funnel.sent)}`} />
        <Kpi label="Read" value={`${pct(funnel.read, funnel.delivered)}%`} hint={`${formatNumber(funnel.read)} readers`} />
        <Kpi label="Clicked" value={`${pct(funnel.clicked, funnel.read)}%`} hint={`${formatNumber(funnel.clicked)} of those who read`} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card title="Engagement over time" className="lg:col-span-2">
          <EngagementChart timeline={timeline} />
        </Card>
        <Card title="Funnel">
          <LiveFunnel counts={funnel} live={live} />
        </Card>
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <Card title="Audience mix">
          <SegmentBars personas={personaBreakdown} />
        </Card>
        <Card title="Revenue by segment">
          <SegmentBars personas={personaBreakdown} revenue={revenue} />
        </Card>
      </div>

      {(insights.learnings.length > 0 || next?.title) && (
        <section className="grid gap-4 lg:grid-cols-5">
          <div className="rounded-2xl border border-border bg-card p-5 lg:col-span-3">
            <div className="mb-4 flex items-center gap-3">
              <BotAvatar type="pill" state="default" size={36} interactive={false} />
              <div>
                <h2 className="text-sm font-semibold tracking-tight">What the agent learned</h2>
                <p className="text-xs text-muted-foreground">From this campaign&apos;s results</p>
              </div>
            </div>
            <ul className="space-y-2.5">
              {insights.learnings.slice(0, 3).map((text) => (
                <li key={text} className="flex gap-2.5 text-sm leading-relaxed">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  {text}
                </li>
              ))}
            </ul>
          </div>
          {next?.title && (
            <BorderBeam size="md" theme="dark" colorVariant="ocean" strength={1} className="lg:col-span-2">
              <div className="h-full rounded-2xl border border-border bg-card p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-primary">Suggested next move</p>
                <h3 className="mt-2 text-base font-semibold leading-snug tracking-tight">{next.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{next.description}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Worth about <span className="font-semibold text-foreground">{formatCurrency(next.potentialRevenue)}</span> at {next.confidence}% confidence
                </p>
                <Link
                  href="/opportunities"
                  className="mt-4 inline-flex h-9 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Review opportunity <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            </BorderBeam>
          )}
        </section>
      )}
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
