'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DollarSign,
  RefreshCw,
  Sparkles,
  Target,
  Users,
  Zap,
  Rocket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { generateOpportunities, getOpportunityCustomers, getOpportunityDashboard } from '@/lib/api';

interface OpportunityDistributionRow {
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
  opportunity: OpportunityDistributionRow | null;
  customers: OpportunityCustomerRow[];
}

interface OpportunityReport {
  companyId: string;
  totalCustomers: number;
  totalOpportunities: number;
  totalRevenuePotential: number;
  opportunityDistribution: OpportunityDistributionRow[];
  topOpportunities: OpportunityDistributionRow[];
  validation?: {
    everyOpportunityHasAudience: boolean;
    everyOpportunityHasSummary: boolean;
    confidenceScoresPopulated: boolean;
    opportunityCountReasonable: boolean;
  };
}

function formatCurrency(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function statusStyles(status: string) {
  switch (status) {
    case 'Accepted':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'Rejected':
      return 'border-red-200 bg-red-50 text-red-800';
    case 'Campaign Created':
      return 'border-blue-200 bg-blue-50 text-blue-800';
    case 'Completed':
      return 'border-stone-200 bg-stone-100 text-stone-700';
    case 'Archived':
      return 'border-stone-200 bg-stone-50 text-stone-500';
    default:
      return 'border-amber-200 bg-amber-50 text-amber-800';
  }
}

export default function OpportunitiesPage() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | undefined>(undefined);
  const [report, setReport] = useState<OpportunityReport | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<OpportunityDistributionRow | null>(null);
  const [selectedCustomers, setSelectedCustomers] = useState<OpportunityCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companyIdLoaded, setCompanyIdLoaded] = useState(false);

  useEffect(() => {
    const storedCompanyId = window.localStorage.getItem('xeno_company_id') ?? undefined;
    setCompanyId(storedCompanyId);
    setCompanyIdLoaded(true);
  }, []);

  useEffect(() => {
    if (!companyIdLoaded) return;

    let mounted = true;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError(null);

        const response = await getOpportunityDashboard(companyId);
        const data = response.data as OpportunityReport;

        if (!mounted) return;

        if (data.totalOpportunities > 0) {
          setReport(data);
          setSelectedOpportunity(data.opportunityDistribution[0] ?? null);
          return;
        }

        setGenerating(true);
        const generated = await generateOpportunities(companyId);
        const generatedReport = generated.data as OpportunityReport;

        if (!mounted) return;

        setReport(generatedReport);
        setSelectedOpportunity(generatedReport.opportunityDistribution[0] ?? null);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load opportunities');
      } finally {
        if (mounted) {
          setLoading(false);
          setGenerating(false);
        }
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, [companyId, companyIdLoaded]);

  useEffect(() => {
    let mounted = true;

    async function loadCustomers() {
      if (!selectedOpportunity?.opportunity_id) {
        setSelectedCustomers([]);
        setCustomerLoading(false);
        return;
      }

      try {
        setCustomerLoading(true);
        const response = await getOpportunityCustomers(selectedOpportunity.opportunity_id);
        const data = response.data as OpportunityDetailResponse;

        if (!mounted) return;

        setSelectedCustomers(data.customers);
        if (data.opportunity) {
          setSelectedOpportunity(data.opportunity);
        }
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load opportunity customers');
      } finally {
        if (mounted) {
          setCustomerLoading(false);
        }
      }
    }

    loadCustomers();

    return () => {
      mounted = false;
    };
  }, [selectedOpportunity?.opportunity_id]);

  const summary = useMemo(() => {
    if (!report) return null;

    const averageConfidence = report.opportunityDistribution.length
      ? report.opportunityDistribution.reduce((sum, opportunity) => sum + opportunity.confidence_score, 0) / report.opportunityDistribution.length
      : 0;

    return {
      averageConfidence,
    };
  }, [report]);

  async function handleRegenerate() {
    try {
      setGenerating(true);
      setError(null);
      const response = await generateOpportunities(companyId);
      const generatedReport = response.data as OpportunityReport;
      setReport(generatedReport);
      setSelectedOpportunity(generatedReport.opportunityDistribution[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate opportunities');
    } finally {
      setGenerating(false);
    }
  }

  if (loading && !report) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.22),_transparent_35%),linear-gradient(180deg,#fff9ed_0%,#ffffff_40%,#fffdf8_100%)] flex items-center justify-center">
        <p className="text-stone-600">Loading growth opportunities...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.22),_transparent_35%),linear-gradient(180deg,#fff9ed_0%,#ffffff_40%,#fffdf8_100%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-8">
        <div className="rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-100 via-white to-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="mb-2 text-sm font-medium uppercase tracking-[0.24em] text-amber-700">Growth Opportunities</p>
              <h1 className="text-4xl font-semibold tracking-tight text-stone-950">What should the CRM manager do today?</h1>
              <p className="mt-3 text-base text-stone-600">
                The engine turns deterministic customer intelligence into ranked revenue opportunities with AI summaries for quick review.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleRegenerate} disabled={generating}>
                <RefreshCw className={`mr-2 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
                {generating ? 'Generating...' : 'Regenerate'}
              </Button>
              <Button variant="outline" onClick={() => router.push('/intelligence')}>
                Customer Intelligence
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
                  <CardTitle>Open Opportunities</CardTitle>
                  <CardDescription>Ranked actions detected by the engine</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold text-stone-950">{report.totalOpportunities}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Total Audience</CardTitle>
                  <CardDescription>Customer assignments across opportunities</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold text-stone-950">{report.opportunityDistribution.reduce((sum, row) => sum + row.customer_count, 0)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Revenue Potential</CardTitle>
                  <CardDescription>Deterministic estimate across all opportunities</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold text-stone-950">{formatCurrency(report.totalRevenuePotential)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Average Confidence</CardTitle>
                  <CardDescription>Model confidence across the opportunity set</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold text-stone-950">{formatPercent(summary?.averageConfidence ?? 0)}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle>Opportunity Queue</CardTitle>
                  <CardDescription>Ranked by priority score and expected impact</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {report.opportunityDistribution.map((opportunity) => {
                    const isSelected = selectedOpportunity?.opportunity_id === opportunity.opportunity_id;

                    return (
                      <button
                        key={opportunity.opportunity_id}
                        onClick={() => setSelectedOpportunity(opportunity)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          isSelected
                            ? 'border-amber-400 bg-amber-50 shadow-sm'
                            : 'border-stone-200 bg-white hover:border-amber-200 hover:bg-amber-50/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-semibold text-stone-950">{opportunity.title}</div>
                              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusStyles(opportunity.status)}`}>
                                {opportunity.status}
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-stone-600">{opportunity.opportunity_type}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-stone-950">{formatPercent(opportunity.priority_score)}</div>
                            <div className="text-xs text-stone-500">priority</div>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-stone-500">
                          <div>
                            <div className="uppercase tracking-wide">Audience</div>
                            <div className="mt-1 text-sm font-medium text-stone-900">{opportunity.customer_count} customers</div>
                          </div>
                          <div>
                            <div className="uppercase tracking-wide">Revenue</div>
                            <div className="mt-1 text-sm font-medium text-stone-900">{formatCurrency(opportunity.potential_revenue)}</div>
                          </div>
                        </div>

                        <div className="mt-3 h-2 rounded-full bg-stone-100">
                          <div
                            className="h-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                            style={{ width: `${Math.max(8, opportunity.revenue_share)}%` }}
                          />
                        </div>

                        <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
                          <span>{formatPercent(opportunity.confidence_score)} confidence</span>
                          <span>{formatPercent(opportunity.revenue_share)} of revenue pool</span>
                        </div>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{selectedOpportunity?.title ?? 'Select an opportunity'}</CardTitle>
                    <CardDescription>
                      {selectedOpportunity?.description ?? 'Opportunity details will appear here'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {selectedOpportunity ? (
                      <>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-stone-500">
                              <Target className="h-3.5 w-3.5" />
                              Type
                            </div>
                            <div className="mt-2 text-sm font-medium text-stone-950">{selectedOpportunity.opportunity_type}</div>
                          </div>
                          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-stone-500">
                              <Users className="h-3.5 w-3.5" />
                              Audience
                            </div>
                            <div className="mt-2 text-sm font-medium text-stone-950">{selectedOpportunity.customer_count} customers</div>
                          </div>
                          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-stone-500">
                              <DollarSign className="h-3.5 w-3.5" />
                              Revenue
                            </div>
                            <div className="mt-2 text-sm font-medium text-stone-950">{formatCurrency(selectedOpportunity.potential_revenue)}</div>
                          </div>
                          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-stone-500">
                              <Sparkles className="h-3.5 w-3.5" />
                              Confidence
                            </div>
                            <div className="mt-2 text-sm font-medium text-stone-950">{formatPercent(selectedOpportunity.confidence_score)}</div>
                          </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="rounded-2xl border border-stone-200 bg-white p-4">
                            <div className="text-xs font-medium uppercase tracking-wide text-stone-500">Trigger Reason</div>
                            <p className="mt-2 text-sm leading-6 text-stone-700">{selectedOpportunity.trigger_reason}</p>
                          </div>
                          <div className="rounded-2xl border border-stone-200 bg-white p-4">
                            <div className="text-xs font-medium uppercase tracking-wide text-stone-500">AI Summary</div>
                            <p className="mt-2 text-sm leading-6 text-stone-700">{selectedOpportunity.ai_summary}</p>
                          </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="rounded-2xl border border-stone-200 bg-white p-4">
                            <div className="text-xs font-medium uppercase tracking-wide text-stone-500">Audience Definition</div>
                            <pre className="mt-2 overflow-auto rounded-xl bg-stone-950 p-3 text-xs leading-5 text-stone-100">
                              {JSON.stringify(selectedOpportunity?.audience_definition ?? {}, null, 2)}
                            </pre>
                          </div>
                          <div className="rounded-2xl border border-stone-200 bg-white p-4">
                            <div className="text-xs font-medium uppercase tracking-wide text-stone-500">Recommended Action</div>
                            <p className="mt-2 text-sm leading-6 text-stone-700">{selectedOpportunity.recommended_action}</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusStyles(selectedOpportunity.status)}`}>
                                {selectedOpportunity.status}
                              </span>
                              <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600">
                                {selectedOpportunity.supporting_customer_segment}
                              </span>
                            </div>
                            <div className="mt-4">
                              <Button
                                onClick={() => router.push(`/campaigns?opportunityId=${selectedOpportunity.opportunity_id}`)}
                                className="w-full"
                              >
                                <Rocket className="mr-2 h-4 w-4" />
                                Create Campaign
                              </Button>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-8 text-sm text-stone-500">
                        No opportunities detected yet.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Audience Customers</CardTitle>
                    <CardDescription>
                      {selectedOpportunity
                        ? `Customers in ${selectedOpportunity.title}`
                        : 'Customer list for the selected opportunity'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {customerLoading ? (
                      <p className="text-sm text-stone-500">Loading customers...</p>
                    ) : selectedCustomers.length > 0 ? (
                      <div className="overflow-hidden rounded-2xl border border-stone-200">
                        <table className="min-w-full divide-y divide-stone-200 text-sm">
                          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
                            <tr>
                              <th className="px-4 py-3">Customer</th>
                              <th className="px-4 py-3">Spend</th>
                              <th className="px-4 py-3">Orders</th>
                              <th className="px-4 py-3">Favorite Category</th>
                              <th className="px-4 py-3">Recency</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-200 bg-white">
                            {selectedCustomers.map((customer) => (
                              <tr key={customer.customer_id} className="align-top">
                                <td className="px-4 py-3">
                                  <div className="font-medium text-stone-950">{customer.customer_name}</div>
                                  <div className="text-xs text-stone-500">
                                    {customer.preferred_channel ?? 'Unknown'} · {customer.discount_affinity ?? 'Unknown'} affinity
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-medium text-stone-950">
                                  {formatCurrency(customer.total_spent)}
                                </td>
                                <td className="px-4 py-3 text-stone-700">{customer.total_orders}</td>
                                <td className="px-4 py-3 text-stone-700">
                                  {customer.favorite_category ?? 'No orders yet'}
                                </td>
                                <td className="px-4 py-3 text-stone-700">
                                  {customer.days_since_last_order === null ? 'No orders yet' : `${customer.days_since_last_order} days ago`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-8 text-sm text-stone-500">
                        No customers found for this opportunity.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No opportunities yet</CardTitle>
              <CardDescription>The engine will generate opportunities from your customer intelligence.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button onClick={handleRegenerate} disabled={generating}>
                <Zap className="mr-2 h-4 w-4" />
                {generating ? 'Generating...' : 'Generate Opportunities'}
              </Button>
              <Button variant="outline" onClick={() => router.push('/personas')}>
                Review Personas
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
