'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, Download, ListChecks } from 'lucide-react';
import { getCampaigns } from '@/lib/api';
import type { CampaignWithMetrics } from '@/lib/types';
import { CHANNEL_META, formatNumber, type Channel } from '@/components/campaign/config';
import { StatusBadge } from '@/components/campaign/status-badge';
import { statePanelSecondaryClass } from '@/components/ui/state-panel';
import { cn } from '@/lib/utils';
import { ALL_CAMPAIGNS_PATH, EXPORT } from './config';
import { toCsv, type AnalyticsData } from './model';

const REPORTABLE = ['Launched', 'Completed'];
const compact = 'px-3 py-1.5';

function CampaignSwitcher({ currentId }: { currentId: string }) {
  const router = useRouter();
  const [list, setList] = useState<CampaignWithMetrics[]>([]);

  useEffect(() => {
    getCampaigns()
      .then((res) => setList((res.data ?? []).filter((c: CampaignWithMetrics) => REPORTABLE.includes(c.status))))
      .catch(() => setList([]));
  }, []);

  if (list.length < 2) return null;
  return (
    <label className="relative inline-flex">
      <span className="sr-only">Switch campaign</span>
      <select
        value={currentId}
        onChange={(e) => router.push(`${ALL_CAMPAIGNS_PATH}?campaignId=${encodeURIComponent(e.target.value)}`)}
        className={cn(statePanelSecondaryClass, compact, 'max-w-[220px] appearance-none truncate pr-8')}
      >
        {list.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-[#6B7280]" aria-hidden />
    </label>
  );
}

function downloadTimeline(data: AnalyticsData) {
  const blob = new Blob([toCsv(EXPORT.columns, data.timeline)], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = EXPORT.filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CampaignHeader({ data }: { data: AnalyticsData }) {
  const { campaign, funnel } = data;
  const Icon = CHANNEL_META[campaign.channel as Channel]?.icon;

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <nav aria-label="Breadcrumb" className="mb-2 text-[13px] text-[#6B7280]">
          <Link href={ALL_CAMPAIGNS_PATH} className="hover:text-[#5B4FFF]">
            Analytics
          </Link>
          <span className="mx-1.5" aria-hidden>
            /
          </span>
          <span aria-current="page">Campaign results</span>
        </nav>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">{campaign.name}</h1>
          <StatusBadge status={campaign.status} />
        </div>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sm text-[#6B7280]">
          {Icon && <Icon className="size-3.5" aria-hidden />}
          <span>{campaign.channel}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{formatNumber(funnel.targeted)} customers targeted</span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <CampaignSwitcher currentId={campaign.id} />
        <button type="button" onClick={() => downloadTimeline(data)} className={cn(statePanelSecondaryClass, compact)}>
          <Download className="size-4" aria-hidden />
          Export CSV
        </button>
        <Link href="/campaigns" className={cn(statePanelSecondaryClass, compact)}>
          <ListChecks className="size-4" aria-hidden />
          All campaigns
        </Link>
      </div>
    </header>
  );
}
