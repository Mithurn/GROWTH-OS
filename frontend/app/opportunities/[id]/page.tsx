'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronRight,
  Gem,
  Loader2,
  MessageSquareText,
  Send,
  Sparkles,
  TrendingUp,
  UserRound,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getOpportunityCustomers } from '@/lib/api';

interface OpportunityRow {
  opportunity_id: string;
  opportunity_key: string;
  opportunity_type: string;
  title: string;
  description: string;
  audience_size: number;
  potential_revenue: number;
  confidence_score: number;
  priority_score: number;
  supporting_customer_segment: string;
  recommended_action: string;
  audience_definition: Record<string, unknown>;
  trigger_reason: string;
  ai_summary: string;
  status: string;
  customer_count: number;
  average_spend: number;
  average_orders: number;
  revenue_share: number;
}

interface OpportunityCustomerRow {
  customer_id: string;
  customer_name: string;
  total_spent: number;
  total_orders: number;
  avg_order_value: number;
  last_order_date: string | null;
  days_since_last_order: number | null;
  favorite_category: string | null;
  second_favorite_category: string | null;
  preferred_channel: string | null;
  discount_affinity: string | null;
  dominant_price_band: string | null;
  category_diversity_score: number | null;
  persona_name: string | null;
  persona_description: string | null;
  confidence_score: number | null;
}

interface OpportunityDetailResponse {
  opportunity: OpportunityRow | null;
  customers: OpportunityCustomerRow[];
}

function formatCurrency(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function normalizeStatus(status?: string) {
  if (!status || status === 'Detected') return 'Ready';
  return status;
}

function statusClasses(status: string) {
  switch (status) {
    case 'Ready':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200/50';
    case 'Analyzing':
      return 'bg-[#fdf5f3] text-[#c45d3f] ring-[#c45d3f]/20';
    case 'Needs Input':
      return 'bg-[#f2efe7] text-[#6b5a52] ring-[#e8e4da]';
    case 'Launched':
      return 'bg-sky-50 text-sky-700 ring-sky-200/50';
    default:
      return 'bg-[#fdf5f3] text-[#c45d3f] ring-[#c45d3f]/20';
  }
}

export default function OpportunityDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const opportunityId = params.id;
  const [data, setData] = useState<OpportunityDetailResponse | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<OpportunityCustomerRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadOpportunity() {
      try {
        setLoading(true);
        setError(null);
        const response = await getOpportunityCustomers(opportunityId);
        if (!mounted) return;
        setData(response.data as OpportunityDetailResponse);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load opportunity');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadOpportunity();

    return () => {
      mounted = false;
    };
  }, [opportunityId]);

  const opportunity = data?.opportunity ?? null;
  const customers = data?.customers ?? [];
  const status = normalizeStatus(opportunity?.status);
  const topCustomer = customers[0];

  const audienceRules = useMemo(() => {
    if (!opportunity?.audience_definition) return [];
    return Object.entries(opportunity.audience_definition).map(([key, value]) => ({
      key: key.replaceAll('_', ' '),
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
    }));
  }, [opportunity?.audience_definition]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#faf8f3]">
        <div className="flex items-center gap-3 rounded-xl bg-white px-5 py-4 text-sm font-medium text-[#2d1810] shadow-sm ring-1 ring-[#e8e4da]">
          <Loader2 className="h-4 w-4 animate-spin text-[#c45d3f]" />
          Loading opportunity...
        </div>
      </main>
    );
  }

  if (error || !opportunity) {
    return (
      <main className="min-h-screen bg-[#faf8f3] p-8">
        <Button variant="outline" onClick={() => router.push('/')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back Home
        </Button>
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error ?? 'Opportunity not found'}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf8f3] px-8 py-8 text-[#2d1810]">
      <div className="mx-auto max-w-[1400px] space-y-7">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-sm font-semibold text-[#6b5a52] transition hover:text-[#c45d3f]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </button>

        <section className="overflow-hidden rounded-2xl border border-[#e8e4da] bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.4fr)_360px]">
            <div className="p-8">
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <span className={`rounded-lg px-3 py-1 text-xs font-bold ring-1 ${statusClasses(status)}`}>
                  {status}
                </span>
                <span className="rounded-lg bg-[#fdf5f3] px-3 py-1 text-xs font-bold text-[#c45d3f] ring-1 ring-[#c45d3f]/20">
                  {opportunity.opportunity_type}
                </span>
              </div>
              <h1 className="text-[42px] font-bold tracking-tight text-[#2d1810]">{opportunity.title}</h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[#4a3228]">{opportunity.description}</p>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <MetricCard label="Potential Revenue" value={formatCurrency(opportunity.potential_revenue)} icon={TrendingUp} />
                <MetricCard label="Audience" value={`${opportunity.customer_count || opportunity.audience_size} Customers`} icon={UserRound} />
                <MetricCard label="Confidence" value={formatPercent(opportunity.confidence_score)} icon={CheckCircle2} />
              </div>
            </div>

            <div className="border-t border-[#e8e4da] bg-gradient-to-br from-[#fdf5f3] via-white to-[#faf8f3] p-8 lg:border-l lg:border-t-0">
              <div className="flex items-center gap-3">
                <Sparkles className="h-6 w-6 text-[#c45d3f]" />
                <h2 className="text-xl font-bold text-[#2d1810]">Why AI found this</h2>
              </div>
              <p className="mt-5 text-sm leading-6 text-[#4a3228]">{opportunity.trigger_reason}</p>
              <div className="mt-6 space-y-3">
                <ReasonPill text={`${customers.length || opportunity.audience_size} customers match the rule`} />
                <ReasonPill text={`Average spend is ${formatCurrency(opportunity.average_spend || 0)}`} />
                <ReasonPill text={opportunity.supporting_customer_segment} />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="rounded-xl border border-[#e8e4da] bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-[#2d1810]">Audience Definition</h2>
              <p className="mt-2 text-sm text-[#6b5a52]">Actual deterministic rule used by the opportunity engine.</p>
              <div className="mt-5 space-y-3">
                {audienceRules.length > 0 ? audienceRules.map((rule) => (
                  <div key={rule.key} className="rounded-xl border border-[#e8e4da] bg-[#faf8f3] p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#6b5a52]">{rule.key}</p>
                    <p className="mt-1 text-sm font-semibold text-[#2d1810]">{rule.value}</p>
                  </div>
                )) : (
                  <div className="rounded-xl border border-[#e8e4da] bg-[#faf8f3] p-4 text-sm text-[#6b5a52]">
                    No rule metadata available.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-[#c45d3f]/20 bg-gradient-to-br from-[#fdf5f3] to-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <Bot className="h-5 w-5 text-[#c45d3f]" />
                <h2 className="text-xl font-bold text-[#2d1810]">AI Recommendation</h2>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#4a3228]">{opportunity.ai_summary || opportunity.recommended_action}</p>
              <Button
                onClick={() => router.push(`/campaigns?opportunityId=${opportunity.opportunity_id}`)}
                className="mt-6 h-12 w-full rounded-xl bg-[#c45d3f] text-sm font-bold shadow-lg shadow-[#c45d3f]/20 hover:bg-[#a84d33] transition-colors"
              >
                <MessageSquareText className="mr-2 h-4 w-4" />
                Generate Campaign Mission Brief
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-[#e8e4da] bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#2d1810]">Audience Customers</h2>
                <p className="mt-1 text-sm text-[#6b5a52]">Click a customer to inspect personalization signals.</p>
              </div>
              <div className="rounded-lg bg-[#fdf5f3] px-3 py-2 text-sm font-bold text-[#c45d3f]">
                {customers.length} matched
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#e8e4da]">
              <table className="min-w-full divide-y divide-[#e8e4da] text-sm">
                <thead className="bg-[#faf8f3] text-left text-xs uppercase tracking-wide text-[#6b5a52]">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Lifetime Spend</th>
                    <th className="px-4 py-3">Orders</th>
                    <th className="px-4 py-3">Last Purchase</th>
                    <th className="px-4 py-3">Persona</th>
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8e4da] bg-white">
                  {customers.map((customer) => (
                    <tr
                      key={customer.customer_id}
                      className="cursor-pointer align-top transition hover:bg-[#fdf5f3]"
                      onClick={() => setSelectedCustomer(customer)}
                    >
                      <td className="px-4 py-4 font-semibold text-[#2d1810]">{customer.customer_name}</td>
                      <td className="px-4 py-4 font-semibold text-[#c45d3f]">{formatCurrency(customer.total_spent)}</td>
                      <td className="px-4 py-4 text-[#4a3228]">{customer.total_orders}</td>
                      <td className="px-4 py-4 text-[#4a3228]">
                        {customer.days_since_last_order === null ? 'Unknown' : `${customer.days_since_last_order} days ago`}
                      </td>
                      <td className="px-4 py-4 text-[#4a3228]">{customer.persona_name ?? 'Unclassified'}</td>
                      <td className="px-4 py-4 text-[#4a3228]">{customer.preferred_channel ?? 'Unknown'}</td>
                      <td className="px-4 py-4 text-right">
                        <ChevronRight className="ml-auto h-4 w-4 text-[#6b5a52]" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {customers.length === 0 ? (
                <div className="p-8 text-sm text-[#6b5a52]">No customers found for this opportunity.</div>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      {selectedCustomer ? (
        <CustomerDrawer
          customer={selectedCustomer}
          fallbackCustomer={topCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      ) : null}
    </main>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-xl border border-[#e8e4da] bg-[#faf8f3] p-5">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#6b5a52]">
        <Icon className="h-4 w-4 text-[#c45d3f]" />
        {label}
      </div>
      <p className="mt-3 text-2xl font-bold text-[#2d1810]">{value}</p>
    </div>
  );
}

function ReasonPill({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-white p-3 ring-1 ring-[#e8e4da]">
      <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
      <p className="text-sm leading-5 text-[#4a3228]">{text}</p>
    </div>
  );
}

function CustomerDrawer({
  customer,
  onClose,
}: {
  customer: OpportunityCustomerRow;
  fallbackCustomer?: OpportunityCustomerRow;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-[#2d1810]/30" onClick={onClose} aria-label="Close customer drawer" />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-white p-7 shadow-2xl">
        <div className="mb-7 flex items-start justify-between">
          <div>
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#fdf5f3] text-[#c45d3f]">
              <UserRound className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-2xl font-bold text-[#2d1810]">{customer.customer_name}</h2>
            <p className="mt-1 text-sm font-medium text-[#c45d3f]">{customer.persona_name ?? 'Premium Loyalist'}</p>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f2efe7] text-[#6b5a52] transition hover:bg-[#e8e4da]">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DrawerMetric label="Lifetime Spend" value={formatCurrency(customer.total_spent)} />
          <DrawerMetric label="Orders" value={String(customer.total_orders)} />
          <DrawerMetric
            label="Last Purchase"
            value={customer.days_since_last_order === null ? 'Unknown' : `${customer.days_since_last_order} days ago`}
          />
          <DrawerMetric label="Avg Order" value={formatCurrency(customer.avg_order_value)} />
        </div>

        <section className="mt-7 rounded-xl border border-[#e8e4da] bg-[#faf8f3] p-5">
          <h3 className="text-base font-bold text-[#2d1810]">Customer Insights</h3>
          <div className="mt-4 space-y-3 text-sm">
            <InsightRow label="Favorite Category" value={customer.favorite_category ?? 'Unknown'} />
            <InsightRow label="Preferred Channel" value={customer.preferred_channel ?? 'WhatsApp'} />
            <InsightRow label="Discount Affinity" value={customer.discount_affinity ?? 'Low'} />
            <InsightRow label="Predicted Churn Risk" value={(customer.days_since_last_order ?? 0) > 90 ? 'High' : 'Medium'} />
          </div>
        </section>

        <section className="mt-5 rounded-xl border border-[#c45d3f]/20 bg-[#fdf5f3] p-5">
          <div className="flex items-center gap-2">
            <Gem className="h-5 w-5 text-[#c45d3f]" />
            <h3 className="text-base font-bold text-[#2d1810]">AI Personalization</h3>
          </div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-[#4a3228]">
            <p>Highlight VIP status and make the customer feel recognized.</p>
            <p>Show premium arrivals from {customer.favorite_category ?? 'their favorite category'}.</p>
            <p>Use {customer.preferred_channel ?? 'WhatsApp'} and avoid heavy discounting unless needed.</p>
          </div>
        </section>
      </aside>
    </div>
  );
}

function DrawerMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e8e4da] bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-[#6b5a52]">{label}</p>
      <p className="mt-2 text-lg font-bold text-[#2d1810]">{value}</p>
    </div>
  );
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[#6b5a52]">{label}</span>
      <span className="font-semibold text-[#2d1810]">{value}</span>
    </div>
  );
}
