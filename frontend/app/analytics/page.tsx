'use client';

import { Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getCampaignAnalytics, getCampaigns, openAuthedSse } from '@/lib/api';
import type { CampaignWithMetrics } from '@/lib/types';
import { CHANNEL_META, formatNumber, type Channel } from '@/components/campaign/config';
import { PageHeader } from '@/components/agent/page-header';
import { StatePanel, statePanelActionClass } from '@/components/ui/state-panel';
import { AnalyticsSkeleton } from '@/components/analytics/analytics-skeleton';
import { AudienceMixPanel, SegmentRevenuePanel } from '@/components/analytics/audience-panels';
import { CampaignHeader } from '@/components/analytics/campaign-header';
import { DeliveryChart } from '@/components/analytics/delivery-chart';
import { FunnelPanel } from '@/components/analytics/funnel-panel';
import { LearningsPanel, NextMoveCard } from '@/components/analytics/insights-panel';
import { KpiStrip } from '@/components/analytics/kpi-strip';
import { estimateRevenue, type AnalyticsData } from '@/components/analytics/model';
import { SendTimeHeatmap } from '@/components/analytics/send-time-heatmap';

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
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((c) => {
        const Icon = CHANNEL_META[c.channel as Channel]?.icon;
        const sent = c.communications_sent ?? 0;
        const rate = sent ? Math.round(((c.communications_clicked ?? 0) / sent) * 100) : 0;
        return (
          <li key={c.id}>
            <Link
              href={`/analytics?campaignId=${c.id}`}
              className="group flex h-full flex-col rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:border-[#C7D2FE]"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-semibold text-[#111827]">{c.name}</span>
                <ArrowRight className="size-4 shrink-0 text-[#6B7280] transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
              <span className="mt-4 flex items-baseline gap-2">
                <span className="text-[28px] font-semibold leading-none tracking-tight tabular-nums text-[#5B4FFF]">{rate}%</span>
                <span className="text-[13px] text-[#6B7280]">click rate</span>
              </span>
              <span className="mt-3 flex items-center gap-1.5 text-[13px] text-[#6B7280]">
                {Icon && <Icon className="size-3.5" aria-hidden />}
                {formatNumber(c.communications_clicked)} clicks from {formatNumber(sent)} sent
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function AnalyticsView({ data }: { data: AnalyticsData }) {
  const { campaign, funnel, personaBreakdown, timeline, insights, sendTimeHeatmap } = data;
  const revenue = estimateRevenue(funnel, campaign.potential_revenue);
  const next = insights.nextAction;
  const hasLearnings = insights.learnings.length > 0;

  return (
    <div className="space-y-4">
      <CampaignHeader data={data} />
      <KpiStrip data={data} />
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <DeliveryChart timeline={timeline} />
        </div>
        <div className="min-w-0 lg:col-span-4">
          <FunnelPanel funnel={funnel} />
        </div>
        <div className="min-w-0 lg:col-span-5">
          <AudienceMixPanel personas={personaBreakdown} />
        </div>
        <div className="min-w-0 lg:col-span-7">
          <SegmentRevenuePanel personas={personaBreakdown} revenue={revenue} />
        </div>
        {hasLearnings && (
          <div className={next?.title ? 'min-w-0 lg:col-span-7' : 'min-w-0 lg:col-span-12'}>
            <LearningsPanel learnings={insights.learnings} />
          </div>
        )}
        {next?.title && <NextMoveCard next={next} className={hasLearnings ? 'min-w-0 lg:col-span-5' : 'min-w-0 lg:col-span-12'} />}
        {sendTimeHeatmap && (
          <div className="min-w-0 lg:col-span-12">
            <SendTimeHeatmap heatmap={sendTimeHeatmap} />
          </div>
        )}
      </div>
    </div>
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

  const retry = () => {
    if (!campaignId) return;
    setError(null);
    void fetchAnalytics(campaignId);
  };

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
        <button type="button" onClick={retry} className={statePanelActionClass}>
          Try again
        </button>
      </StatePanel>
    );
  } else if (!data || data.campaign.id !== campaignId) {
    body = <AnalyticsSkeleton />;
  } else {
    body = <AnalyticsView data={data} />;
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-8 sm:py-8">
      {!campaignId && (
        <div className="mb-6">
          <PageHeader title="Analytics" description="Choose a launched campaign to see how it performed." />
        </div>
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
