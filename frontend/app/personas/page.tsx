'use client';

import { AiLoader } from '@/components/ui/ai-loader';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

function formatCurrency(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

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
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <AiLoader size="md" title="Loading personas" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-8">
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#5B4FFF]">AI Persona Layer</p>
              <h1 className="text-4xl font-semibold tracking-tight text-[#1A1A1A]">Customer Personas</h1>
              <p className="mt-3 text-base text-[#6B7280]">
                AI interprets customer metrics and attributes into marketer-friendly personas you can review, edit, and activate.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleGeneratePersonas} disabled={generating}>
                {generating ? 'Generating personas...' : 'Generate Personas'}
              </Button>
              <Button variant="outline" onClick={() => router.push('/opportunities')}>
                Back to Opportunities
              </Button>
            </div>
          </div>

          {error ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}
        </div>

        {report ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardTitle>Total Personas</CardTitle>
                  <CardDescription>Distinct persona groups generated</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold text-[#1A1A1A]">{report.totalPersonas}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Total Customers</CardTitle>
                  <CardDescription>Customers assigned to personas</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold text-[#1A1A1A]">{report.totalCustomers}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Average Spend / Persona</CardTitle>
                  <CardDescription>Weighted average revenue per persona</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold text-[#1A1A1A]">
                    {formatCurrency(totals?.averageSpendPerPersona ?? 0)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Total Revenue</CardTitle>
                  <CardDescription>Contribution from all persona groups</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold text-[#1A1A1A]">
                    {formatCurrency(totals?.revenueContribution ?? 0)}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle>Persona Distribution</CardTitle>
                  <CardDescription>Click a persona to inspect the customer list</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {report.personaDistribution.map((persona) => {
                    const isSelected = selectedPersona?.persona_name === persona.persona_name;
                    return (
                      <button
                        key={persona.persona_name}
                        onClick={() => setSelectedPersona(persona)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          isSelected
                            ? 'border-[#5B4FFF] bg-[#EEF2FF]'
                            : 'border-[#E5E7EB] bg-white hover:border-[#5B4FFF]/40 hover:bg-[#F8F7FF]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-[#1A1A1A]">{persona.persona_name}</div>
                            <div className="mt-1 text-sm text-[#6B7280]">{persona.persona_description}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-[#1A1A1A]">{persona.customer_count}</div>
                            <div className="text-xs text-[#6B7280]">customers</div>
                          </div>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-[#F3F4F6]">
                          <div
                            className="h-2 rounded-full bg-[#5B4FFF]"
                            style={{
                              width: `${Math.max(8, persona.revenue_share)}%`,
                            }}
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-[#6B7280]">
                          <span>{formatCurrency(persona.average_spend)} avg spend</span>
                          <span>{formatScore(persona.revenue_share)} of revenue</span>
                        </div>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{selectedPersona?.persona_name ?? 'Select a persona'}</CardTitle>
                  <CardDescription>
                    {selectedPersona?.persona_description ?? 'Persona details will appear here'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {customerLoading ? (
                    <p className="text-sm text-[#6B7280]">Loading customers...</p>
                  ) : selectedCustomers.length > 0 ? (
                    <div className="overflow-hidden rounded-2xl border border-[#E5E7EB]">
                      <table className="min-w-full divide-y divide-[#E5E7EB] text-sm">
                        <thead className="bg-[#F9FAFB] text-left text-xs uppercase tracking-wide text-[#6B7280]">
                          <tr>
                            <th className="px-4 py-3">Customer</th>
                            <th className="px-4 py-3">Spend</th>
                            <th className="px-4 py-3">Orders</th>
                            <th className="px-4 py-3">Favorite Category</th>
                            <th className="px-4 py-3">Last Purchase</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5E7EB] bg-white">
                          {selectedCustomers.map((customer) => (
                            <tr key={customer.customer_id} className="align-top">
                              <td className="px-4 py-3">
                                <div className="font-medium text-[#1A1A1A]">{customer.customer_name}</div>
                                <div className="text-xs text-[#6B7280]">
                                  {customer.preferred_channel ?? 'Unknown channel'} · {customer.discount_affinity ?? 'Unknown'} affinity
                                </div>
                              </td>
                              <td className="px-4 py-3 font-medium text-[#1A1A1A]">
                                {formatCurrency(customer.total_spent)}
                              </td>
                              <td className="px-4 py-3 text-[#374151]">{customer.total_orders}</td>
                              <td className="px-4 py-3 text-[#374151]">
                                {customer.favorite_category ?? 'No orders yet'}
                              </td>
                              <td className="px-4 py-3 text-[#374151]">
                                {customer.days_since_last_order === null ? 'No orders yet' : `${customer.days_since_last_order} days ago`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[#D1D5DB] bg-[#F9FAFB] p-8 text-sm text-[#6B7280]">
                      No customers found for this persona.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No personas yet</CardTitle>
              <CardDescription>
                Generate personas from the deterministic customer intelligence we already built.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleGeneratePersonas} disabled={generating}>
                {generating ? 'Generating personas...' : 'Generate Personas'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
