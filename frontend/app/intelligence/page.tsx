'use client';

import { useEffect, useState } from 'react';
import { PAGE_SHELL_CLASS } from '@/components/ui/surface';
import Link from 'next/link';
import { ArrowRight, Crown, DollarSign, ShoppingCart, TrendingUp, Users } from 'lucide-react';
import { AiLoader } from '@/components/ui/ai-loader';
import { StatePanel, statePanelActionClass } from '@/components/ui/state-panel';
import { MetricStrip } from '@/components/ui/metric-strip';
import { SECTION_LABEL_CLASS, SURFACE_CLASS } from '@/components/ui/surface';
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
      <div className={PAGE_SHELL_CLASS}>
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
  const activePct = health && data.totalCustomers ? Math.round((health.active / data.totalCustomers) * 100) : 0;

  return (
    <div className={PAGE_SHELL_CLASS}>
      <PageHeader title="Customer intelligence" description="What the agent learned from your customer data" />

      <MetricStrip
        className="mt-6"
        items={[
          { label: 'Customers', value: data.totalCustomers ?? 0, icon: Users, hint: health && data.totalCustomers ? `${activePct}% active right now` : undefined, progress: health && data.totalCustomers ? activePct : undefined },
          { label: 'Orders', value: data.totalOrders ?? 0, icon: ShoppingCart, hint: data.totalCustomers ? `${((data.totalOrders ?? 0) / data.totalCustomers).toFixed(1)} orders per customer` : undefined },
          { label: 'Revenue', value: data.revenue ?? 0, format: formatCurrency, icon: DollarSign, accent: true, hint: 'Lifetime, all channels' },
          { label: 'Average order', value: data.avgOrderValue ?? 0, format: formatCurrency, icon: TrendingUp, hint: 'Spend per order' },
        ]}
      />

      {health && (
        <section className={cn(SURFACE_CLASS, 'mt-6 p-5')} aria-label="Customer health">
          <h2 className={SECTION_LABEL_CLASS}>Customer health</h2>
          <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            {HEALTH_SEGMENTS.map(({ key, bar }) => (
              <span key={key} className={bar} style={{ width: `${healthTotal ? (health[key] / healthTotal) * 100 : 0}%` }} />
            ))}
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            {HEALTH_SEGMENTS.map(({ key, label, hint, bar }) => (
              <div key={key} className="flex items-start gap-2.5">
                <span className={cn('mt-1.5 size-2 rounded-full', bar)} aria-hidden />
                <div>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-xl font-semibold tabular-nums text-foreground">{health[key].toLocaleString()}</dd>
                  <p className="text-xs text-muted-foreground">{hint}</p>
                </div>
              </div>
            ))}
          </dl>
        </section>
      )}

      {data.topCustomers && data.topCustomers.length > 0 && (
        <section className={cn(SURFACE_CLASS, 'mt-6')} aria-label="Top customers">
          <h2 className={cn(SECTION_LABEL_CLASS, 'border-b border-line-soft px-5 py-3')}>Top customers</h2>
          <ul className="divide-y divide-line-soft">
            {data.topCustomers.map((customer, index) => (
              <li key={customer.name} className="flex items-center justify-between px-5 py-3">
                <span className="flex items-center gap-3 text-sm font-medium text-foreground">
                  <Crown className={cn('size-4', index === 0 ? 'text-amber-500' : 'text-[#D1D5DB]')} aria-hidden />
                  {customer.name}
                </span>
                <span className="text-sm font-semibold tabular-nums text-primary">
                  ₹{parseFloat(String(customer.totalSpent)).toLocaleString('en-IN')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#C7D2FE] bg-[#FCFBFF] p-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">The agent is ready to act</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">It can turn this data into revenue opportunities.</p>
        </div>
        <PrimaryAction href="/opportunities">
          Open opportunities <ArrowRight className="size-4" aria-hidden />
        </PrimaryAction>
      </section>
    </div>
  );
}
