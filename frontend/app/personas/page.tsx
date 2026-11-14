'use client';

import { AiLoader } from '@/components/ui/ai-loader';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { StatePanel, statePanelActionClass } from '@/components/ui/state-panel';
import { MetricTile } from '@/components/agent/metric-tile';
import { PageHeader } from '@/components/agent/page-header';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { generatePersonas, getPersonaCustomers, getPersonaDistribution } from '@/lib/api';

interface PersonaDistributionRow {
  persona_name: string;
  persona_description: string;
  customer_count: number;
  total_spent: number;
  average_spend: number;
  revenue_share: number;
  average_orders: number;
  average_days_since_last_order: number | null;
}

interface PersonaCustomerRow {
  customer_id: string;
  customer_name: string;
  total_spent: number;
  total_orders: number;
  avg_order_value: number;
  days_since_last_order: number | null;
  favorite_category: string | null;
  second_favorite_category: string | null;
  preferred_channel: string | null;
  discount_affinity: string | null;
  dominant_price_band: string | null;
  category_diversity_score: number | null;
  persona_name: string;
  persona_description: string;
  confidence_score: number;
}

interface PersonaReport {
  companyId: string;
  totalCustomers: number;
  totalPersonas: number;
  totalRevenue: number;
  personaDistribution: PersonaDistributionRow[];
}

interface PersonaCustomersResponse {
  personaName: string;
  customers: PersonaCustomerRow[];
  personas: PersonaDistributionRow[];
}

const MIN_SHARE_BAR = 8;

function formatScore(value: number) {
  return `${Math.round(value)}%`;
}

export default function PersonasPage() {
  const router = useRouter();
  const [report, setReport] = useState<PersonaReport | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<PersonaDistributionRow | null>(null);
  const [selectedCustomers, setSelectedCustomers] = useState<PersonaCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadDistribution() {
      try {
        setLoading(true);
        const response = await getPersonaDistribution();
        const data = response.data as PersonaReport;

        if (!mounted) return;

        setReport(data);
        const firstPersona = data.personaDistribution[0] ?? null;
        setSelectedPersona(firstPersona);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load personas');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDistribution();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadCustomers() {
      if (!selectedPersona?.persona_name) {
        setSelectedCustomers([]);
        return;
      }

      try {
        setCustomerLoading(true);
        const response = await getPersonaCustomers(selectedPersona.persona_name);
        const data = response.data as PersonaCustomersResponse;
        if (!mounted) return;
        setSelectedCustomers(data.customers);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load persona customers');
      } finally {
        if (mounted) setCustomerLoading(false);
      }
    }

    loadCustomers();

    return () => {
      mounted = false;
    };
  }, [selectedPersona?.persona_name]);

  const totals = useMemo(() => {
    if (!report) return null;

    const averageSpendPerPersona = report.totalPersonas > 0 ? report.totalRevenue / report.totalPersonas : 0;
    return {
      averageSpendPerPersona,
      revenueContribution: report.totalRevenue,
    };
  }, [report]);

  async function handleGeneratePersonas() {
    try {
      setGenerating(true);
      setError(null);
      const response = await generatePersonas();
      const data = response.data as {
        totalCustomers: number;
        totalPersonas: number;
        personaDistribution: PersonaDistributionRow[];
        generatedAt: string;
      };

      const nextReport: PersonaReport = {
        companyId: response.data.companyId,
        totalCustomers: data.totalCustomers,
        totalPersonas: data.totalPersonas,
        totalRevenue: data.personaDistribution.reduce((sum, item) => sum + item.total_spent, 0),
        personaDistribution: data.personaDistribution,
      };

      setReport(nextReport);
      const firstPersona = data.personaDistribution[0] ?? null;
      setSelectedPersona(firstPersona);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate personas');
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <AiLoader size="md" title="Loading personas" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-8 sm:py-8">
      <PageHeader
        title="Customer personas"
        description="Groups the agent found in your customers, ready to target"
        state={generating ? 'working' : 'idle'}
        actions={
          <>
            <Button variant="outline" onClick={() => router.push('/opportunities')}>
              Opportunities
            </Button>
            <Button onClick={handleGeneratePersonas} disabled={generating}>
              {generating ? 'Generating...' : report ? 'Regenerate' : 'Generate personas'}
            </Button>
          </>
        }
      />

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {report ? (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricTile label="Personas" value={String(report.totalPersonas)} hint="Distinct buying behaviours" />
            <MetricTile label="Customers" value={report.totalCustomers.toLocaleString()} hint="Grouped by the agent" />
            <MetricTile label="Average per persona" value={formatCurrency(totals?.averageSpendPerPersona ?? 0)} hint="Revenue per persona" />
            <MetricTile label="Total revenue" value={formatCurrency(totals?.revenueContribution ?? 0)} accent hint="Across all personas" />
          </div>

          <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
            <ul className="space-y-2" aria-label="Personas">
              {report.personaDistribution.map((persona) => {
                const isSelected = selectedPersona?.persona_name === persona.persona_name;
                return (
                  <li key={persona.persona_name}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedPersona(persona)}
                      className={cn(
                        'w-full rounded-2xl border p-4 text-left transition-colors',
                        isSelected ? 'border-[#C7D2FE] bg-[#EEF2FF]' : 'border-[#E5E7EB] bg-white hover:bg-[#FCFBFF]',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#1A1A1A]">{persona.persona_name}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-[#6B7280]">{persona.persona_description}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-semibold tabular-nums text-[#1A1A1A]">{persona.customer_count}</p>
                          <p className="text-xs text-[#6B7280]">customers</p>
                        </div>
                      </div>
                      <div className="mt-3 h-1.5 rounded-full bg-[#F3F4F6]">
                        <div className="h-1.5 rounded-full bg-[#5B4FFF]" style={{ width: `${Math.max(MIN_SHARE_BAR, persona.revenue_share)}%` }} />
                      </div>
                      <p className="mt-2 flex justify-between text-xs text-[#6B7280]">
                        <span>{formatCurrency(persona.average_spend)} average</span>
                        <span>{formatScore(persona.revenue_share)} of revenue</span>
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>

            <section className="rounded-2xl border border-[#E5E7EB] bg-white" aria-label="Persona customers">
              <div className="border-b border-[#F0F0F2] px-5 py-4">
                <h2 className="text-base font-semibold tracking-tight text-[#1A1A1A]">{selectedPersona?.persona_name ?? 'Select a persona'}</h2>
                <p className="text-sm text-[#6B7280]">{selectedPersona?.persona_description ?? 'Persona details appear here'}</p>
              </div>
              {customerLoading ? (
                <div className="space-y-3 p-5" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-4 animate-pulse rounded bg-[#F3F4F6]" />
                  ))}
                </div>
              ) : selectedCustomers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wider text-[#6B7280]">
                      <tr>
                        <th className="px-5 py-2.5 font-medium">Customer</th>
                        <th className="px-3 py-2.5 font-medium">Spend</th>
                        <th className="px-3 py-2.5 font-medium">Orders</th>
                        <th className="px-3 py-2.5 font-medium">Favorite</th>
                        <th className="px-5 py-2.5 font-medium">Last purchase</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0F0F2]">
                      {selectedCustomers.map((customer) => (
                        <tr key={customer.customer_id}>
                          <td className="px-5 py-3">
                            <p className="font-medium text-[#1A1A1A]">{customer.customer_name}</p>
                            <p className="text-xs text-[#6B7280]">
                              {customer.preferred_channel ?? 'Unknown channel'} · {customer.discount_affinity ?? 'Unknown'} affinity
                            </p>
                          </td>
                          <td className="px-3 py-3 tabular-nums text-[#1A1A1A]">{formatCurrency(customer.total_spent)}</td>
                          <td className="px-3 py-3 tabular-nums text-[#4B5563]">{customer.total_orders}</td>
                          <td className="px-3 py-3 text-[#4B5563]">{customer.favorite_category ?? '-'}</td>
                          <td className="whitespace-nowrap px-5 py-3 text-[#4B5563]">
                            {customer.days_since_last_order === null ? 'No orders yet' : `${customer.days_since_last_order} days ago`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-8 text-center text-sm text-[#6B7280]">No customers found for this persona.</p>
              )}
            </section>
          </div>
        </>
      ) : (
        <StatePanel tone="empty" title="No personas yet" message="Let the agent group your customers by how they buy.">
          <button type="button" onClick={handleGeneratePersonas} disabled={generating} className={statePanelActionClass}>
            {generating ? 'Generating...' : 'Generate personas'}
          </button>
        </StatePanel>
      )}
    </div>
  );
}
