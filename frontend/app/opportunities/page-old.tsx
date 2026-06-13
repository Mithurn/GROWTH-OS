'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Calendar,
  Loader2,
} from 'lucide-react';
import { generateOpportunities, getOpportunityDashboard, createOpportunityFromGoal } from '@/lib/api';

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

interface OpportunityReport {
  companyId: string;
  totalCustomers: number;
  totalOpportunities: number;
  totalRevenuePotential: number;
  opportunityDistribution: OpportunityDistributionRow[];
  topOpportunities: OpportunityDistributionRow[];
}

type OpportunityCardItem = OpportunityDistributionRow;

function formatCurrency(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function normalizeStatus(status: string, index: number) {
  if (status && status !== 'Detected') return status;
  if (index === 2) return 'Analyzing';
  if (index === 4) return 'Needs Input';
  return 'Ready';
}

function getAudienceSize(opportunity: OpportunityCardItem) {
  return 'customer_count' in opportunity && opportunity.customer_count
    ? opportunity.customer_count
    : opportunity.audience_size;
}

export default function OpportunitiesPage() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | undefined>(undefined);
  const [companyIdLoaded, setCompanyIdLoaded] = useState(false);
  const [report, setReport] = useState<OpportunityReport | null>(null);
  const [customGoal, setCustomGoal] = useState('');
  const [loading, setLoading] = useState(true);
  const [creatingGoal, setCreatingGoal] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          return;
        }

        const generated = await generateOpportunities(companyId);
        const generatedReport = generated.data as OpportunityReport;

        if (!mounted) return;
        setReport(generatedReport);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load opportunities');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, [companyId, companyIdLoaded]);

  const opportunities = useMemo<OpportunityCardItem[]>(() => {
    const realOpportunities = report?.opportunityDistribution ?? [];
    return realOpportunities.slice(0, 4);
  }, [report]);

  const totalOpportunities = report?.opportunityDistribution?.length ?? 0;

  const totalRevenue = report?.totalRevenuePotential ?? 0;
  const dateLabel = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date());
  }, []);

  async function handleCustomGoalSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const goal = customGoal.trim();
    if (!goal || creatingGoal) return;

    try {
      setCreatingGoal(true);
      setCustomGoal('');

      // Call the API to create opportunity from goal with AI
      await createOpportunityFromGoal(goal, companyId);

      // Reload the dashboard to show the new opportunity
      const dashboardResponse = await getOpportunityDashboard(companyId);
      const data = dashboardResponse.data as OpportunityReport;
      setReport(data);
    } catch (err) {
      console.error('Error creating opportunity from goal:', err);
      setError(err instanceof Error ? err.message : 'Failed to create opportunity from goal');
    } finally {
      setCreatingGoal(false);
    }
  }

  if (loading && !report) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#faf8f3]">
        <div className="flex items-center gap-3 rounded-xl bg-white px-5 py-4 text-sm font-medium text-[#2d1810] shadow-sm ring-1 ring-[#e8e4da]">
          <Loader2 className="h-4 w-4 animate-spin text-[#c45d3f]" />
          Loading AI Opportunity Command Center...
        </div>
      </main>
    );
  }

  const runningCount = opportunities.filter((_, index) => {
    const status = normalizeStatus(opportunities[index]?.status, index);
    return status === 'Ready';
  }).length;

  return (
    <main className="flex h-screen flex-col bg-[#faf8f3] text-[#2d1810]">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-7 py-8">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-10">
          {/* Header */}
          <header className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-[#2d1810]">Growth Copilot</h1>
            <div className="flex h-9 items-center gap-2.5 rounded-xl border border-[#e8e4da] bg-white px-3.5 text-sm font-medium text-[#2d1810] shadow-sm">
              <Calendar className="h-3.5 w-3.5 text-[#6b5a52]" />
              {dateLabel}
            </div>
          </header>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {/* Top Metrics - 3 Cards */}
          <div className="grid grid-cols-3 gap-4">
            {/* Incremental Revenue */}
            <div className="rounded-2xl border border-[#e8e4da] bg-white p-6 shadow-sm">
              <div className="text-sm font-medium text-[#6b5a52]">Incremental Revenue</div>
              <div className="mt-3 text-3xl font-black tracking-tight text-[#c45d3f]">
                {formatCurrency(totalRevenue)}
              </div>
              <div className="mt-2 text-sm font-semibold text-emerald-600">+23.5% ↑ vs baseline</div>
            </div>

            {/* Conversion Lift */}
            <div className="rounded-2xl border border-[#e8e4da] bg-white p-6 shadow-sm">
              <div className="text-sm font-medium text-[#6b5a52]">Conversion Lift</div>
              <div className="mt-3 text-3xl font-black tracking-tight text-[#c45d3f]">18.4%</div>
              <div className="mt-2 text-sm font-semibold text-emerald-600">vs 14.9% ↑ control</div>
            </div>

            {/* Attributed Orders */}
            <div className="rounded-2xl border border-[#e8e4da] bg-white p-6 shadow-sm">
              <div className="text-sm font-medium text-[#6b5a52]">Attributed Orders</div>
              <div className="mt-3 text-3xl font-black tracking-tight text-[#c45d3f]">2,847</div>
              <div className="mt-2 text-sm font-semibold text-[#6b5a52]">AI driven</div>
            </div>
          </div>

          {/* Status Line */}
          <div className="text-sm text-[#6b5a52]">
            {runningCount} campaign{runningCount !== 1 ? 's' : ''} running
          </div>

          {/* Opportunity Cards - 2x2 Grid */}
          <section className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-5">
              {opportunities.map((opportunity, index) => (
                <OpportunityCard
                  key={opportunity.opportunity_id}
                  opportunity={opportunity}
                  index={index}
                  onOpen={() => {
                    router.push(`/opportunities/${opportunity.opportunity_id}`);
                  }}
                />
              ))}
            </div>

            {/* View All Link */}
            {totalOpportunities > 4 && (
              <button
                onClick={() => router.push('/opportunities')}
                className="self-start text-sm font-semibold text-[#c45d3f] transition-colors hover:text-[#a84d33]"
              >
                View All {totalOpportunities} Opportunities →
              </button>
            )}
          </section>
        </div>
      </div>

      {/* Fixed Bottom Command Bar - Attio Style */}
      <div className="shrink-0 border-t border-[#e8e4da] bg-white px-7 py-4">
        <form onSubmit={handleCustomGoalSubmit} className="mx-auto max-w-[1400px]">
          <div className="relative rounded-2xl border-2 border-[#e8e4da] bg-white p-4 shadow-sm transition-all focus-within:border-[#c45d3f] focus-within:shadow-md focus-within:shadow-[#c45d3f]/10">
            <input
              value={customGoal}
              onChange={(event) => setCustomGoal(event.target.value)}
              placeholder="What do you want to achieve?"
              disabled={creatingGoal}
              className="w-full bg-transparent text-base outline-none placeholder:text-[#6b5a52] disabled:opacity-50"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button
                type="submit"
                disabled={!customGoal.trim() || creatingGoal}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#c45d3f] text-white transition-all hover:bg-[#a84d33] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {creatingGoal ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}

function OpportunityCard({
  opportunity,
  index,
  onOpen,
}: {
  opportunity: OpportunityCardItem;
  index: number;
  onOpen: () => void;
}) {
  const status = normalizeStatus(opportunity.status, index);

  // Status badge emoji with animation
  const getStatusBadge = () => {
    if (status === 'Needs Input') {
      return <span className="text-2xl animate-pulse">🟠</span>;
    }
    if (status === 'Ready') {
      return <span className="text-2xl">🟢</span>;
    }
    return <span className="text-2xl">⚫</span>;
  };

  return (
    <article
      onClick={onOpen}
      className="group cursor-pointer rounded-2xl border border-[#e8e4da] bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#c45d3f]/40 hover:shadow-lg hover:shadow-[#c45d3f]/10"
    >
      {/* Status Badge */}
      <div className="mb-4">
        {getStatusBadge()}
      </div>

      {/* Title */}
      <h3 className="mb-3 text-lg font-bold leading-tight text-[#2d1810]">
        {opportunity.title}
      </h3>

      {/* Revenue - Big and Bold */}
      <div className="mb-4 text-3xl font-black tracking-tight text-[#c45d3f]">
        {formatCurrency(opportunity.potential_revenue)}
      </div>

      {/* Customer Count */}
      <div className="text-sm text-[#6b5a52]">
        {getAudienceSize(opportunity)} customers
      </div>
    </article>
  );
}
