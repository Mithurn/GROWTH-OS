'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Gauge, Gem, Target, Users, Wallet, X } from 'lucide-react';
import { StatePanel, statePanelActionClass } from '@/components/ui/state-panel';
import { AiLoader } from '@/components/ui/ai-loader';
import { MetricStrip } from '@/components/ui/metric-strip';
import { SECTION_LABEL_CLASS, SURFACE_CLASS } from '@/components/ui/surface';
import { AgentAvatar } from '@/components/agent/agent-avatar';
import { AgentPromptInput } from '@/components/agent/agent-prompt-input';
import { ConfidenceMeter } from '@/components/agent/confidence-meter';
import { PrimaryAction } from '@/components/agent/primary-action';
import { StatusPill } from '@/components/agent/status-pill';
import { getOpportunityCustomers, prefetchCampaign, refineOpportunity } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Opportunity } from '@/lib/types';
import {
  CHURN_HIGH_DAYS,
  DEFAULT_LTV,
  DEFAULT_RECENCY_DAYS,
  DEFAULT_SEGMENT,
  DEFAULT_VOUCHER,
  FALLBACK_SIGNALS,
  LTV_MULTIPLE,
  MAX_PERSONAS,
  REFINE_PLACEHOLDERS,
  REFINE_SUGGESTIONS,
  SIGNAL_ICONS,
  VOUCHER_SHARE,
  VOUCHER_STEP,
  parseChannel,
  parseSignals,
  playName,
} from './detail-config';

interface Customer {
  customer_id: string;
  customer_name: string;
  total_spent: number;
  total_orders: number;
  avg_order_value: number;
  last_order_date: string | null;
  days_since_last_order: number | null;
  favorite_category: string | null;
  preferred_channel: string | null;
  discount_affinity: string | null;
  persona_name: string | null;
  persona_description: string | null;
}

const rupees = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`${SURFACE_CLASS} p-5 ${className ?? ''}`}>
      <h2 className={SECTION_LABEL_CLASS}>{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[#6B7280]">{label}</span>
      <span className="font-medium text-[#1A1A1A]">{value}</span>
    </div>
  );
}

export default function OpportunityDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<{ opportunity: Opportunity | null; customers: Customer[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modifier, setModifier] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const res = await getOpportunityCustomers(params.id);
        if (mounted) setData(res.data);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Failed to load opportunity');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [params.id]);

  const opp = data?.opportunity ?? null;

  useEffect(() => {
    if (opp?.opportunity_id) prefetchCampaign(opp.opportunity_id);
  }, [opp?.opportunity_id]);

  const personas = useMemo(() => {
    const aiPersonas = data?.opportunity?.opportunity_personas;
    if (aiPersonas && aiPersonas.length > 0) {
      return aiPersonas.slice(0, MAX_PERSONAS).map((p) => ({ name: p.name, description: p.description, count: null as number | null }));
    }
    const map = new Map<string, { name: string; description: string; count: number }>();
    (data?.customers ?? []).forEach((c) => {
      if (!c.persona_name) return;
      const entry = map.get(c.persona_name) ?? { name: c.persona_name, description: c.persona_description ?? '', count: 0 };
      entry.count++;
      map.set(c.persona_name, entry);
    });
    return Array.from(map.values()).slice(0, MAX_PERSONAS);
  }, [data]);

  async function refine(text: string) {
    if (!opp || isRefining) return;
    setIsRefining(true);
    setRefineError(null);
    try {
      const res = await refineOpportunity(opp.opportunity_id, text);
      if (res.data) {
        setData((prev) => (prev ? { ...prev, opportunity: prev.opportunity ? { ...prev.opportunity, ...res.data } : null } : null));
      }
      setModifier('');
    } catch {
      setRefineError('The agent could not apply that change. Try rephrasing it.');
    } finally {
      setIsRefining(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <AiLoader size="md" title="Loading opportunity" />
      </div>
    );
  }

  if (error || !opp) {
    return (
      <div className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-8">
        <Link href="/opportunities" className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#4B3FE5]">
          <ArrowLeft className="size-4" aria-hidden /> Opportunities
        </Link>
        <StatePanel
          tone="error"
          title={error ? 'We could not load this opportunity' : 'Opportunity not found'}
          message={error ?? 'It may have been removed, or the link is out of date.'}
        >
          <button type="button" onClick={() => window.location.reload()} className={statePanelActionClass}>
            Try again
          </button>
        </StatePanel>
      </div>
    );
  }

  const customers = data?.customers ?? [];
  const channel = parseChannel(opp.recommended_action);
  const signals = parseSignals(opp.trigger_reason);
  const audienceCount = opp.customer_count || opp.audience_size;
  const voucher = opp.average_spend ? Math.round((opp.average_spend * VOUCHER_SHARE) / VOUCHER_STEP) * VOUCHER_STEP : DEFAULT_VOUCHER;
  const conversion = opp.predicted_conversion_rate != null ? `${opp.predicted_conversion_rate}%` : '-';
  const reasons = signals.length > 0 ? signals : FALLBACK_SIGNALS(formatCurrency(opp.average_spend * LTV_MULTIPLE || DEFAULT_LTV));
  const recency = opp.audience_definition?.max_days_since_last_order;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-8 sm:py-8">
      <Link href="/opportunities" className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] transition-colors hover:text-[#4B3FE5]">
        <ArrowLeft className="size-4" aria-hidden /> Opportunities
      </Link>

      <header className="mt-4 flex items-center gap-4">
        <AgentAvatar state={isRefining ? 'working' : 'idle'} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone="live">{isRefining ? 'Agent is refining' : 'Ready for action'}</StatusPill>
            <StatusPill>{channel}</StatusPill>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#1A1A1A] sm:text-3xl">{opp.title}</h1>
        </div>
      </header>

      <MetricStrip
        className="mt-6"
        items={[
          { label: 'Recoverable', value: opp.potential_revenue, format: formatCurrency, icon: Wallet, accent: true, hint: 'Estimated revenue at stake' },
          { label: 'Audience', value: audienceCount, icon: Users, hint: 'Customers in the target group' },
          { label: 'Predicted conversion', value: opp.predicted_conversion_rate ?? 0, format: (n) => (opp.predicted_conversion_rate != null ? `${n}%` : '-'), icon: Target, hint: 'Of the audience expected to buy' },
          { label: 'Agent confidence', value: Math.round(opp.confidence_score), format: (n) => `${n}%`, icon: Gauge, progress: opp.confidence_score, hint: `Based on ${reasons.length} signals` },
        ]}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Agent reasoning">
            <p className="text-sm leading-relaxed text-[#4B5563]">{opp.ai_summary || opp.description}</p>
            <ul className="mt-4 space-y-2.5 border-t border-[#F0F0F2] pt-4">
              {reasons.map((signal, i) => {
                const Icon = SIGNAL_ICONS[i % SIGNAL_ICONS.length];
                return (
                  <li key={signal} className="flex items-start gap-2.5 text-sm text-[#4B5563]">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-[#EEF2FF] text-[#5B4FFF]">
                      <Icon className="size-3" aria-hidden />
                    </span>
                    {signal}
                  </li>
                );
              })}
            </ul>
          </Card>

          <div className="grid gap-6 sm:grid-cols-2">
            <Card title="Audience">
              <div className="space-y-2.5">
                <Row label="Segment" value={opp.supporting_customer_segment || DEFAULT_SEGMENT} />
                <Row label="Average spend" value={opp.average_spend ? formatCurrency(opp.average_spend) : '-'} />
                <Row label="Last purchase" value={`${recency ?? DEFAULT_RECENCY_DAYS} days ago`} />
              </div>
              {customers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(customers[0])}
                  className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[#5B4FFF] hover:underline"
                >
                  Inspect a customer <ArrowRight className="size-3" aria-hidden />
                </button>
              )}
            </Card>

            <Card title="Personas the agent found">
              {personas.length === 0 ? (
                <p className="text-sm text-[#6B7280]">No personas yet.</p>
              ) : (
                <ul className="space-y-3">
                  {personas.map((p) => (
                    <li key={p.name}>
                      <p className="flex items-center justify-between text-sm font-medium text-[#1A1A1A]">
                        {p.name}
                        {p.count != null && <span className="text-xs text-[#6B7280]">{p.count}</span>}
                      </p>
                      <p className="text-xs leading-relaxed text-[#6B7280]">{p.description}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-[#C7D2FE] bg-[#FCFBFF] p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-[#5B4FFF]">Recommended play</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#1A1A1A]">{playName(opp.title)}</h2>
            <div className="mt-4 space-y-2.5">
              <Row label="Channel" value={channel} />
              <Row label="Offer" value={`₹${voucher} voucher`} />
              <Row label="Expected conversion" value={conversion} />
            </div>
            <PrimaryAction href={`/campaigns?opportunityId=${opp.opportunity_id}`} className="mt-5 w-full">
              Review campaign
              <ArrowRight className="size-4" aria-hidden />
            </PrimaryAction>
          </section>

          {opp.alternative_strategies && opp.alternative_strategies.length > 0 && (
            <Card title="Alternatives considered">
              <ul className="space-y-3">
                {opp.alternative_strategies.map((alt) => (
                  <li key={alt.title} className="rounded-xl bg-[#F9FAFB] p-3">
                    <p className="flex items-center justify-between text-xs font-medium text-[#1A1A1A]">
                      {alt.title}
                      <span className="text-[#6B7280]">{alt.conversion_rate}%</span>
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[#6B7280]">{alt.note}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>

      <div className="sticky bottom-4 z-30 mt-8 rounded-2xl bg-[#FAFAFA]/90 p-1 backdrop-blur">
        <AgentPromptInput
          value={modifier}
          onChange={setModifier}
          onSubmit={refine}
          busy={isRefining}
          placeholders={REFINE_PLACEHOLDERS}
          suggestions={REFINE_SUGGESTIONS}
          error={refineError}
          label="Change this opportunity"
        />
      </div>

      {selectedCustomer && <CustomerDrawer customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />}
    </div>
  );
}

function CustomerDrawer({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const stats = [
    { label: 'Lifetime spend', value: rupees(customer.total_spent) },
    { label: 'Orders', value: String(customer.total_orders) },
    { label: 'Last purchase', value: customer.days_since_last_order != null ? `${customer.days_since_last_order}d ago` : '-' },
    { label: 'Average order', value: rupees(customer.avg_order_value) },
  ];
  const traits = [
    { label: 'Favorite category', value: customer.favorite_category ?? '-' },
    { label: 'Preferred channel', value: customer.preferred_channel ?? 'WhatsApp' },
    { label: 'Discount affinity', value: customer.discount_affinity ?? 'Low' },
    { label: 'Churn risk', value: (customer.days_since_last_order ?? 0) > CHURN_HIGH_DAYS ? 'High' : 'Medium' },
  ];

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={customer.customer_name}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-sm overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#5B4FFF]">
              <Gem className="size-5" aria-hidden />
            </span>
            <h2 className="mt-3 text-lg font-semibold text-[#1A1A1A]">{customer.customer_name}</h2>
            <p className="text-sm font-medium text-[#5B4FFF]">{customer.persona_name ?? 'Premium customer'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-3">
          {stats.map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-[#E5E7EB] p-3">
              <dt className="text-[13px] font-medium text-[#6B7280]">{label}</dt>
              <dd className="mt-1 text-base font-semibold tabular-nums text-[#1A1A1A]">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 space-y-3 rounded-xl border border-[#E5E7EB] p-4">
          {traits.map(({ label, value }) => (
            <Row key={label} label={label} value={value} />
          ))}
        </div>
      </aside>
    </div>
  );
}
