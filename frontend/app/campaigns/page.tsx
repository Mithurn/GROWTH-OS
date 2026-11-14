'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { PAGE_SHELL_CLASS } from '@/components/ui/surface';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { BorderBeam } from 'border-beam';
import { ArrowRight, Check, Clock, Mail, Megaphone, Radio, Target, Users, X } from 'lucide-react';
import { approveCampaign, getCampaigns, rejectCampaign } from '@/lib/api';
import type { CampaignWithMetrics } from '@/lib/types';
import { AgentAvatar } from '@/components/agent/agent-avatar';
import { MetricStrip } from '@/components/ui/metric-strip';
import { PrimaryAction } from '@/components/agent/primary-action';
import { CampaignBuilder } from '@/components/campaign/campaign-builder';
import { ChannelTabs } from '@/components/campaign/channel-tabs';
import { CHANNEL_META, LAUNCH_REQUEST, PHONE, formatNumber, type Channel } from '@/components/campaign/config';
import { LiveFunnel } from '@/components/campaign/live-funnel';
import { MessagePreview } from '@/components/campaign/message-preview';
import { Panel, PanelLabel, Stat, alertClass, outlineButtonClass } from '@/components/campaign/panel';
import { StatusBadge } from '@/components/campaign/status-badge';
import { StatePanel, statePanelActionClass, statePanelSecondaryClass } from '@/components/ui/state-panel';
import { cn } from '@/lib/utils';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'PendingApproval', label: 'Pending' },
  { key: 'Approved', label: 'Approved' },
  { key: 'Launched', label: 'Live' },
] as const;

const SKELETON_ROWS = 4;

function ListSkeleton() {
  return (
    <div className="grid animate-pulse gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="space-y-2">
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <div key={i} className="h-[76px] rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-[520px] rounded-2xl bg-muted" />
    </div>
  );
}

function CampaignRow({ c, selected, onSelect }: { c: CampaignWithMetrics; selected: boolean; onSelect: () => void }) {
  const Icon = CHANNEL_META[c.channel as Channel]?.icon ?? Target;
  const row = (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'w-full rounded-xl border bg-white p-3.5 text-left transition-colors',
        selected ? 'border-primary/40 ring-1 ring-primary/15' : 'border-border hover:border-primary/30',
      )}
    >
      <span className="line-clamp-2 text-sm font-medium leading-snug text-foreground">{c.name}</span>
      <span className="mt-2.5 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">
            {c.channel} · {formatNumber(c.audience_size ?? 0)}
          </span>
        </span>
        <StatusBadge status={c.status} />
      </span>
    </button>
  );
  if (c.status !== 'Launched') return row;
  return (
    <BorderBeam size="sm" theme="light" colorVariant="ocean" strength={0.7}>
      {row}
    </BorderBeam>
  );
}

function CampaignDetail({ c, onChanged }: { c: CampaignWithMetrics; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewChannel, setPreviewChannel] = useState<Channel>(c.channel as Channel);
  const live = c.status === 'Launched' || c.status === 'Completed';
  const canDecide = c.status === 'PendingApproval' && c.case_status === 'READY_FOR_APPROVAL';

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const reject = () => {
    const reason = window.prompt('Why are you rejecting this campaign?');
    if (reason === null) return;
    void act(() => rejectCampaign(c.id, reason));
  };

  return (
    <div className="grid items-start gap-6 min-[1360px]:grid-cols-[minmax(0,1fr)_372px]">
      <Panel className="min-w-0">
        <section className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">{c.name}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.objective}</p>
            </div>
            <StatusBadge status={c.status} />
          </div>

          <dl className="mt-5 grid grid-cols-3 gap-3">
            <Stat label="Channel">
              <span className="text-base">{c.channel}</span>
            </Stat>
            <Stat label="Audience">{formatNumber(c.audience_size ?? 0)}</Stat>
            <Stat label="Sent">{formatNumber(c.communications_sent ?? 0)}</Stat>
          </dl>

          {live ? (
            <LiveFunnel
              light
              className="mt-7"
              live={c.status === 'Launched'}
              counts={{
                targeted: c.audience_size ?? 0,
                sent: c.communications_sent ?? 0,
                delivered: c.communications_delivered ?? 0,
                read: c.communications_read ?? 0,
                clicked: c.communications_clicked ?? 0,
                failed: c.communications_failed ?? 0,
              }}
            />
          ) : (
            <div className="mt-7">
              <PanelLabel className="mb-2">Message</PanelLabel>
              <p className="whitespace-pre-wrap rounded-xl border border-border bg-surface-inset p-4 text-sm leading-relaxed text-foreground">{c.message_content}</p>
            </div>
          )}

          {c.reasoning && (
            <div className="mt-6 flex items-start gap-3 rounded-xl bg-brand-wash p-4">
              <AgentAvatar size="md" className="shrink-0" />
              <p className="text-sm leading-relaxed text-body">{c.reasoning}</p>
            </div>
          )}

          {c.case_status === 'BLOCKED' && (
            <p role="alert" className={cn('mt-4', alertClass)}>
              The reviewer agent blocked this draft. Edit it to start a new review.
            </p>
          )}
          {error && (
            <p role="alert" className={cn('mt-4', alertClass)}>
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line-soft pt-5">
            {canDecide && (
              <>
                <PrimaryAction disabled={busy} onClick={() => void act(() => approveCampaign(c.id))}>
                  <Check className="size-4" aria-hidden /> Approve
                </PrimaryAction>
                <button type="button" disabled={busy} onClick={reject} className={outlineButtonClass}>
                  <X className="size-4" aria-hidden /> Reject
                </button>
              </>
            )}
            {c.status === 'Approved' && (
              <PrimaryAction href={LAUNCH_REQUEST.href}>
                <Mail className="size-4" aria-hidden /> Request launch access
              </PrimaryAction>
            )}
            {live && (
              <PrimaryAction href={`/analytics?campaignId=${c.id}`}>
                View analytics <ArrowRight className="size-4" aria-hidden />
              </PrimaryAction>
            )}
            {!canDecide && !live && c.status !== 'Approved' && <p className="text-sm text-muted-foreground">No actions available for this campaign.</p>}
          </div>
        </section>
      </Panel>

      <aside className={cn('flex flex-col items-center gap-4 min-[1360px]:sticky', PHONE.stickyTop)} aria-label="Phone preview">
        <ChannelTabs value={previewChannel} onChange={setPreviewChannel} />
        <MessagePreview channel={previewChannel} message={c.message_content} subject={c.name} offer={c.offer} />
      </aside>
    </div>
  );
}

function CampaignList() {
  const [campaigns, setCampaigns] = useState<CampaignWithMetrics[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getCampaigns();
      setCampaigns(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campaigns');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => (campaigns ?? []).filter((c) => filter === 'all' || c.status === filter),
    [campaigns, filter],
  );
  const selected = visible.find((c) => c.id === selectedId) ?? visible[0];

  const stats = useMemo(() => {
    const list = campaigns ?? [];
    const awaiting = list.filter((c) => c.status === 'PendingApproval' || c.status === 'Draft').length;
    const live = list.filter((c) => c.status === 'Launched').length;
    const reached = list.reduce((n, c) => n + (c.communications_sent ?? 0), 0);
    return [
      { label: 'Campaigns', value: list.length, icon: Megaphone, hint: 'Drafted by the agent' },
      { label: 'Awaiting approval', value: awaiting, icon: Clock, hint: awaiting ? 'Waiting for your review' : 'Nothing waiting on you' },
      { label: 'Live', value: live, icon: Radio, hint: live ? 'Sending to customers now' : 'None sending right now' },
      { label: 'Customers reached', value: reached, icon: Users, accent: true, hint: `Across ${list.length} ${list.length === 1 ? 'campaign' : 'campaigns'}` },
    ];
  }, [campaigns]);

  let body;
  if (error) {
    body = (
      <StatePanel tone="error" title="We could not load campaigns" message={error}>
        <button type="button" onClick={() => void load()} className={statePanelActionClass}>
          Try again
        </button>
      </StatePanel>
    );
  } else if (!campaigns) {
    body = <ListSkeleton />;
  } else if (campaigns.length === 0) {
    body = (
      <StatePanel tone="empty" title="No campaigns yet" message="Pick an opportunity and the agent will draft the campaign for you.">
        <Link href="/opportunities" className={statePanelActionClass}>
          View opportunities
        </Link>
      </StatePanel>
    );
  } else {
    body = (
      <div className="space-y-6">
        <MetricStrip items={stats} />
        <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-3">
            <div role="tablist" aria-label="Filter campaigns" className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
              {FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={filter === key}
                  onClick={() => setFilter(key)}
                  className={cn(
                    'shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                    filter === key ? 'bg-white text-foreground shadow-sm ring-1 ring-black/5' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {visible.map((c) => (
                <CampaignRow key={c.id} c={c} selected={c.id === selected?.id} onSelect={() => setSelectedId(c.id)} />
              ))}
              {visible.length === 0 && <p className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">Nothing in this view.</p>}
            </div>
          </div>
          {selected ? (
            <CampaignDetail key={selected.id} c={selected} onChanged={() => void load()} />
          ) : (
            <Panel className="px-6 py-16 text-center text-sm text-muted-foreground">Pick a campaign to see its message and results.</Panel>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE_SHELL_CLASS}>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Campaigns</h1>
          <p className="mt-1 text-sm text-muted-foreground">Drafted by the agent, sent only after you approve.</p>
        </div>
        <Link href="/opportunities" className={statePanelSecondaryClass}>
          <Target className="size-4" aria-hidden /> Opportunities
        </Link>
      </header>
      {body}
    </div>
  );
}

function CampaignsContent() {
  const opportunityId = useSearchParams().get('opportunityId');
  return opportunityId ? <CampaignBuilder opportunityId={opportunityId} /> : <CampaignList />;
}

export default function CampaignsPage() {
  return (
    <Suspense fallback={null}>
      <CampaignsContent />
    </Suspense>
  );
}
