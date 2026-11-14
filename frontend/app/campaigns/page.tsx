'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { BotAvatar } from 'bot-avatars';
import { ArrowRight, Check, Mail, Target, X } from 'lucide-react';
import { approveCampaign, getCampaigns, rejectCampaign } from '@/lib/api';
import type { CampaignWithMetrics } from '@/lib/types';
import { PrimaryAction } from '@/components/agent/primary-action';
import { ConsoleCard } from '@/components/campaign/console';
import { CampaignBuilder } from '@/components/campaign/campaign-builder';
import { CHANNEL_META, LAUNCH_REQUEST, formatNumber, type Channel } from '@/components/campaign/config';
import { LiveFunnel } from '@/components/campaign/live-funnel';
import { MessagePreview } from '@/components/campaign/message-preview';
import { StatusBadge } from '@/components/campaign/status-badge';
import { StatePanel, statePanelActionClass, statePanelSecondaryClass } from '@/components/ui/state-panel';
import { cn } from '@/lib/utils';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'PendingApproval', label: 'Awaiting approval' },
  { key: 'Approved', label: 'Approved' },
  { key: 'Launched', label: 'Live' },
] as const;

const SKELETON_ROWS = 4;

function ListSkeleton() {
  return (
    <div className="grid animate-pulse gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <div className="space-y-2">
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <div key={i} className="h-[72px] rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-96 rounded-2xl bg-muted" />
    </div>
  );
}

function CampaignRow({ c, selected, onSelect }: { c: CampaignWithMetrics; selected: boolean; onSelect: () => void }) {
  const Icon = CHANNEL_META[c.channel as Channel]?.icon ?? Target;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'w-full rounded-xl border bg-card p-3.5 text-left transition-colors',
        selected ? 'border-primary/50 bg-accent/50 ring-1 ring-primary/20' : 'border-border hover:border-primary/30',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 text-sm font-medium leading-snug">{c.name}</span>
        <StatusBadge status={c.status} />
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" aria-hidden />
        {c.channel} · {formatNumber(c.audience_size ?? 0)} customers
      </p>
    </button>
  );
}

function CampaignDetail({ c, onChanged }: { c: CampaignWithMetrics; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <ConsoleCard glow>
        <section className="min-w-0 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight text-white">{c.name}</h2>
              <p className="mt-0.5 text-sm text-zinc-400">{c.objective}</p>
            </div>
            <StatusBadge dark status={c.status} />
          </div>

          <dl className="mt-5 grid grid-cols-3 gap-3">
            {[
              ['Channel', c.channel],
              ['Audience', formatNumber(c.audience_size ?? 0)],
              ['Sent', formatNumber(c.communications_sent ?? 0)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                <dt className="text-[11px] uppercase tracking-wider text-zinc-500">{k}</dt>
                <dd className="mt-0.5 text-sm font-semibold text-white">{v}</dd>
              </div>
            ))}
          </dl>

          {live && (
            <LiveFunnel
              className="mt-6"
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
          )}

          {c.reasoning && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
              <BotAvatar shading="plastic" type="pill" state="default" size={32} interactive={false} />
              <p className="text-sm leading-relaxed text-zinc-400">{c.reasoning}</p>
            </div>
          )}

          {c.case_status === 'BLOCKED' && (
            <p role="alert" className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              The reviewer agent blocked this draft. Edit it to start a new review.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {canDecide && (
              <>
                <PrimaryAction disabled={busy} onClick={() => void act(() => approveCampaign(c.id))}>
                  <Check className="size-4" aria-hidden /> Approve
                </PrimaryAction>
                <button
                  type="button"
                  disabled={busy}
                  onClick={reject}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 px-5 text-sm font-medium text-zinc-300 hover:bg-white/5 disabled:opacity-50"
                >
                  <X className="size-4" aria-hidden /> Reject
                </button>
              </>
            )}
            {c.status === 'Approved' && (
              <a
                href={LAUNCH_REQUEST.href}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-indigo-500 px-5 text-sm font-medium text-white hover:bg-indigo-400"
              >
                <Mail className="size-4" aria-hidden /> Request launch access
              </a>
            )}
            {live && (
              <Link
                href={`/analytics?campaignId=${c.id}`}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-white/10 px-5 text-sm font-medium text-zinc-200 hover:bg-white/5"
              >
                View analytics <ArrowRight className="size-4" aria-hidden />
              </Link>
            )}
          </div>
        </section>
      </ConsoleCard>

      <ConsoleCard glow>
        <div className="flex justify-center px-3 py-6">
          <MessagePreview channel={c.channel as Channel} message={c.message_content} subject={c.name} offer={c.offer} />
        </div>
      </ConsoleCard>
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
    return [
      { label: 'Campaigns', value: formatNumber(list.length) },
      { label: 'Awaiting approval', value: formatNumber(list.filter((c) => c.status === 'PendingApproval' || c.status === 'Draft').length) },
      { label: 'Live', value: formatNumber(list.filter((c) => c.status === 'Launched').length) },
      { label: 'Customers reached', value: formatNumber(list.reduce((n, c) => n + (c.communications_sent ?? 0), 0)) },
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
      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-2">
          {stats.map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <div role="tablist" aria-label="Filter campaigns" className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-0.5">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className={cn(
                  'shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  filter === key ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground',
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
            {visible.length === 0 && <p className="px-1 py-6 text-center text-sm text-muted-foreground">Nothing in this view.</p>}
          </div>
        </div>
        {selected && <CampaignDetail key={selected.id} c={selected} onChanged={() => void load()} />}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Campaigns</h1>
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
