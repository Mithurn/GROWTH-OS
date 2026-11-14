'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Crown, DollarSign, ShoppingCart, TrendingUp, Users } from 'lucide-react';
import { AiLoader } from '@/components/ui/ai-loader';
import { StatePanel, statePanelActionClass } from '@/components/ui/state-panel';
import { MetricTile } from '@/components/agent/metric-tile';
import { PageHeader } from '@/components/agent/page-header';
import { PrimaryAction } from '@/components/agent/primary-action';
import { getIntelligencePreview } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

interface IntelligenceCustomer {
  name: string;
  totalSpent: string | number;
}

interface IntelligencePreview {
  totalCustomers?: number;
  totalOrders?: number;
  revenue?: number;
  avgOrderValue?: number;
  customerHealth?: { active: number; dormant: number; atRisk: number };
  topCustomers?: IntelligenceCustomer[];
}

const HEALTH_SEGMENTS = [
  { key: 'active', label: 'Active', hint: 'Engaged customers', bar: 'bg-emerald-500' },
  { key: 'dormant', label: 'Dormant', hint: "Haven't purchased recently", bar: 'bg-amber-500' },
  { key: 'atRisk', label: 'At risk', hint: 'Decreasing engagement', bar: 'bg-red-500' },
] as const;

export default function IntelligencePage() {
  const [data, setData] = useState<IntelligencePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getIntelligencePreview()
      .then(setData)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <AiLoader size="md" title="Reading your customer data" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-8">
        <StatePanel
          tone={failed ? 'error' : 'empty'}
          title={failed ? 'We could not load customer intelligence' : 'No customer data yet'}
          message={failed ? 'Check your connection and try again.' : 'Complete onboarding so the agent can study your customers.'}
        >
          {failed ? (
            <button type="button" onClick={() => window.location.reload()} className={statePanelActionClass}>
              Try again
            </button>
          ) : (
            <Link href="/onboarding" className={statePanelActionClass}>
              Start onboarding <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </StatePanel>
      </div>
    );
  }

  const health = data.customerHealth;
  const healthTotal = health ? health.active + health.dormant + health.atRisk : 0;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader title="Customer intelligence" description="What the agent learned from your customer data" />

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label="Customers" value={(data.totalCustomers ?? 0).toLocaleString()} icon={Users} hint={health && data.totalCustomers ? `${Math.round((health.active / data.totalCustomers) * 100)}% active right now` : undefined} />
        <MetricTile label="Orders" value={(data.totalOrders ?? 0).toLocaleString()} icon={ShoppingCart} hint={data.totalCustomers ? `${((data.totalOrders ?? 0) / data.totalCustomers).toFixed(1)} orders per customer` : undefined} />
        <MetricTile label="Revenue" value={formatCurrency(data.revenue ?? 0)} icon={DollarSign} accent hint="Lifetime, all channels" />
        <MetricTile label="Average order" value={formatCurrency(data.avgOrderValue ?? 0)} icon={TrendingUp} hint="Spend per order" />
      </div>

      {health && (
        <section className="mt-6 rounded-2xl border border-[#E5E7EB] bg-white p-5" aria-label="Customer health">
          <h2 className="text-xs font-medium uppercase tracking-wider text-[#6B7280]">Customer health</h2>
          <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-[#F3F4F6]" aria-hidden>
            {HEALTH_SEGMENTS.map(({ key, bar }) => (
              <span key={key} className={bar} style={{ width: `${healthTotal ? (health[key] / healthTotal) * 100 : 0}%` }} />
            ))}
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            {HEALTH_SEGMENTS.map(({ key, label, hint, bar }) => (
              <div key={key} className="flex items-start gap-2.5">
                <span className={cn('mt-1.5 size-2 rounded-full', bar)} aria-hidden />
                <div>
                  <dt className="text-xs text-[#6B7280]">{label}</dt>
                  <dd className="text-xl font-semibold tabular-nums text-[#1A1A1A]">{health[key].toLocaleString()}</dd>
                  <p className="text-xs text-[#6B7280]">{hint}</p>
                </div>
              </div>
            ))}
          </dl>
        </section>
      )}

      {data.topCustomers && data.topCustomers.length > 0 && (
        <section className="mt-6 rounded-2xl border border-[#E5E7EB] bg-white" aria-label="Top customers">
          <h2 className="border-b border-[#F0F0F2] px-5 py-3 text-xs font-medium uppercase tracking-wider text-[#6B7280]">Top customers</h2>
          <ul className="divide-y divide-[#F0F0F2]">
            {data.topCustomers.map((customer, index) => (
              <li key={customer.name} className="flex items-center justify-between px-5 py-3">
                <span className="flex items-center gap-3 text-sm font-medium text-[#1A1A1A]">
                  <Crown className={cn('size-4', index === 0 ? 'text-amber-500' : 'text-[#D1D5DB]')} aria-hidden />
                  {customer.name}
                </span>
                <span className="text-sm font-semibold tabular-nums text-[#5B4FFF]">
                  ₹{parseFloat(String(customer.totalSpent)).toLocaleString('en-IN')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#C7D2FE] bg-[#FCFBFF] p-5">
        <div>
          <h2 className="text-sm font-semibold text-[#1A1A1A]">The agent is ready to act</h2>
          <p className="mt-0.5 text-sm text-[#6B7280]">It can turn this data into revenue opportunities.</p>
        </div>
        <PrimaryAction href="/opportunities">
          Open opportunities <ArrowRight className="size-4" aria-hidden />
        </PrimaryAction>
      </section>
    </div>
  );
}
