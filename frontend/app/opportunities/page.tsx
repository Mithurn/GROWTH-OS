'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  TrendingUp,
  Users,
  Activity,
  Zap,
  Sparkles,
  BrainCircuit,
  Lightbulb,
  X,
  Target,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from 'lucide-react';
import { generateOpportunities, getOpportunityDashboard, createOpportunityFromGoal, getActivityStream, getIntelligenceBrief } from '@/lib/api';

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

function normalizeStatus(status: string, index: number) {
  if (status) return status;
  return 'Detected';
}

function getAudienceSize(opportunity: OpportunityCardItem) {
  return 'customer_count' in opportunity && opportunity.customer_count
    ? opportunity.customer_count
    : opportunity.audience_size;
}

interface ActivityItem {
  id: string;
  timestamp: string;
  action_type: string;
  description: string;
  details?: Record<string, unknown>;
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
  const [activities, setActivities] = useState<ActivityItem[]>([]);

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

  // Load real activity feed
  useEffect(() => {
    if (!companyId) return;

    let mounted = true;

    async function loadActivities() {
      try {
        const response = await getActivityStream(companyId as string, 5);
        if (!mounted) return;
        setActivities(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error('Failed to load activities:', err);
      }
    }

    loadActivities();

    // Refresh activities every 30 seconds
    const interval = setInterval(loadActivities, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [companyId]);

  // Removed currentActivityIndex rotation

  const opportunities = useMemo<OpportunityCardItem[]>(() => {
    const realOpportunities = report?.opportunityDistribution ?? [];
    return realOpportunities.slice(0, 4);
  }, [report]);

  const totalOpportunities = report?.totalOpportunities ?? 0;
  const totalRevenue = report?.totalRevenuePotential ?? 0;
  const totalCustomers = report?.totalCustomers ?? 0;

  async function handleCustomGoalSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const goal = customGoal.trim();
    if (!goal || creatingGoal) return;

    try {
      setCreatingGoal(true);
      setCustomGoal('');

      await createOpportunityFromGoal(goal, companyId);

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
      <main className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-2">
            <div className="h-3 w-3 rounded-full bg-[#5B4FFF] dot-pulse"></div>
            <div className="h-3 w-3 rounded-full bg-[#5B4FFF] dot-pulse"></div>
            <div className="h-3 w-3 rounded-full bg-[#5B4FFF] dot-pulse"></div>
          </div>
          <div className="text-sm font-medium text-[#71717A]">Loading AI insights...</div>
        </div>
      </main>
    );
  }

  // Helper to format time ago
  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <main className="flex h-screen flex-col bg-[#FAFAFA] text-[#1A1A1A]">
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="mx-auto flex max-w-[1000px] flex-col gap-8">
          {/* Header */}
          <header className="flex items-center justify-between border-b border-[#E4E4E7] pb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5B4FFF] shadow-sm">
                <BrainCircuit className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">Active Agents</h1>
            </div>
            <button className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-[#5B4FFF] shadow-sm border border-[#E4E4E7] transition hover:border-[#5B4FFF]/30 hover:shadow-md">
              + Create Agent
            </button>
          </header>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Agent Cards - 1 Column Stack */}
          <section className="flex flex-col gap-4">
            {opportunities.map((opportunity, index) => (
              <OpportunityCard
                key={opportunity.opportunity_id}
                opportunity={opportunity}
                index={index}
                globalActivities={activities}
              />
            ))}

            {totalOpportunities > 4 && (
              <button
                onClick={() => router.push('/opportunities')}
                className="mt-4 self-center rounded-full border border-[#E4E4E7] bg-white px-6 py-2 text-sm font-semibold text-[#5B4FFF] transition-all hover:border-[#5B4FFF]/30 hover:shadow-sm"
              >
                View all {totalOpportunities} agents →
              </button>
            )}
          </section>
        </div>
      </div>

      {/* Fixed Bottom Command Bar */}
      <div className="shrink-0 border-t border-[#E4E4E7] bg-white/80 px-8 py-4 backdrop-blur-xl">
        <form onSubmit={handleCustomGoalSubmit} className="mx-auto max-w-[1200px]">
          {/* Suggestion Chips */}
          <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[#5B4FFF] mr-2">
              <Sparkles className="h-3.5 w-3.5" /> Suggestions:
            </span>
            {['Reduce churn risk', 'Boost repeat purchases', 'Recover dormant VIPs'].map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setCustomGoal(suggestion)}
                className="whitespace-nowrap rounded-full border border-[#E4E4E7] bg-white px-3 py-1.5 text-xs font-medium text-[#52525B] transition-colors hover:border-[#5B4FFF] hover:text-[#5B4FFF]"
              >
                {suggestion}
              </button>
            ))}
          </div>

          <div className="group relative rounded-2xl border-2 border-[#E4E4E7] bg-white p-4 shadow-sm transition-all focus-within:border-[#5B4FFF] focus-within:shadow-lg focus-within:shadow-[#5B4FFF]/10">
            <input
              value={customGoal}
              onChange={(event) => setCustomGoal(event.target.value)}
              placeholder="What do you want to achieve? Ask your AI Growth Copilot..."
              disabled={creatingGoal}
              className="w-full bg-transparent text-base font-medium outline-none placeholder:text-[#A1A1AA] disabled:opacity-50"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <button
                type="submit"
                disabled={!customGoal.trim() || creatingGoal}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5B4FFF] text-white transition-all hover:bg-[#4B3FE5] hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {creatingGoal ? (
                  <div className="flex gap-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-white dot-pulse"></div>
                    <div className="h-1.5 w-1.5 rounded-full bg-white dot-pulse"></div>
                    <div className="h-1.5 w-1.5 rounded-full bg-white dot-pulse"></div>
                  </div>
                ) : (
                  <ArrowRight className="h-5 w-5" />
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
  globalActivities,
}: {
  opportunity: OpportunityCardItem;
  index: number;
  globalActivities: ActivityItem[];
}) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const status = normalizeStatus(opportunity.status, index);

  const getStatusIndicator = () => {
    if (status === 'Needs Input' || status === 'Review') {
      return (
        <div className="flex items-center gap-1.5 rounded-full bg-[#FEF3C7] px-2.5 py-0.5">
          <div className="h-1.5 w-1.5 rounded-full bg-[#EAB308] animate-pulse-glow"></div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#A16207]">Needs approval</span>
        </div>
      );
    }
    if (status === 'Launched' || status === 'Running') {
      return (
        <div className="flex items-center gap-1.5 rounded-full bg-[#DCFCE7] px-2.5 py-0.5">
          <div className="h-1.5 w-1.5 rounded-full bg-[#22C55E] animate-pulse-success"></div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#166534]">Running</span>
        </div>
      );
    }
    if (status === 'Detected') {
      return (
        <div className="flex items-center gap-1.5 rounded-full bg-[#F0EEFF] px-2.5 py-0.5">
          <Sparkles className="h-3 w-3 text-[#5B4FFF]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B4FFF]">New Insight</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-[#F4F4F5] px-2.5 py-0.5">
        <div className="h-1.5 w-1.5 rounded-full bg-[#71717A]"></div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#52525B]">{status}</span>
      </div>
    );
  };

  // Mocking execution data based on audience size
  const targetAudience = getAudienceSize(opportunity);
  const executed = Math.floor(targetAudience * 0.45); // Fake 45% completion
  const progressPercent = targetAudience > 0 ? Math.round((executed / targetAudience) * 100) : 0;

  // Mocking recent actions specifically for this opportunity
  const recentActions = [
    { id: '1', time: '2 mins ago', desc: `Targeting segment built for ${opportunity.title.toLowerCase()}`, type: 'DATA' },
    { id: '2', time: '15 mins ago', desc: `Analyzed past performance. Recommends focusing on ${opportunity.recommended_action || 'cross-channel'} to maximize engagement.`, type: 'DECISION' }
  ];

  return (
    <article
      className={`group flex flex-col rounded-2xl border border-[#E4E4E7] bg-white p-6 transition-all duration-300 animate-fade-in-up ${isExpanded ? 'ring-2 ring-[#5B4FFF]/20 shadow-lg' : 'hover:border-[#5B4FFF]/40 hover:shadow-md cursor-pointer'}`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div 
        className="flex items-center justify-between"
        onClick={() => !isExpanded && setIsExpanded(true)}
      >
        <div className="flex items-center gap-5">
          <div className="flex flex-col">
            <div className="flex items-center gap-3 mb-1.5">
              <h3 className="text-lg font-bold text-[#1A1A1A] group-hover:text-[#5B4FFF] transition-colors">
                {opportunity.title}
              </h3>
              {getStatusIndicator()}
            </div>
            <p className="text-sm font-medium text-[#71717A]">
              Optimizing for <span className="text-[#1A1A1A] font-semibold">Conversion</span> • {opportunity.recommended_action || 'Cross-channel'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="text-right">
            <div className="text-[11px] font-bold text-[#A1A1AA] uppercase tracking-wider mb-1">Potential Lift</div>
            <div className="text-xl font-bold text-[#22C55E]">
              +{formatCurrency(opportunity.potential_revenue)}
            </div>
          </div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F4F4F5] text-[#71717A] transition hover:bg-[#E4E4E7] hover:text-[#1A1A1A]"
          >
            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-6 border-t border-[#F4F4F5] pt-6 grid grid-cols-2 gap-8 animate-fade-in-up">
          {/* Left Side: Execution Progress & AI Reasoning */}
          <div className="flex flex-col gap-6">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-2 w-2 rounded-full bg-[#5B4FFF] animate-pulse"></div>
                <h4 className="text-sm font-bold text-[#1A1A1A]">Execution Progress</h4>
              </div>
              <div className="rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] p-5 shadow-inner">
                <div className="mb-1 flex items-end gap-2">
                  <span className="text-3xl font-black tracking-tight text-[#1A1A1A]">{executed.toLocaleString()}</span>
                  <span className="text-sm font-bold text-[#A1A1AA] mb-1.5">/ {targetAudience.toLocaleString()}</span>
                </div>
                <p className="text-xs font-medium text-[#71717A] mb-5">Planned actions executed</p>
                
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#E4E4E7]">
                  <div 
                    className="h-full bg-gradient-to-r from-[#5B4FFF] to-[#3B2FD5] transition-all duration-1000 ease-out" 
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
                <div className="mt-2 text-xs font-bold text-[#5B4FFF]">{progressPercent}% complete</div>
              </div>
            </div>

            {opportunity.ai_summary && (
              <div className="rounded-xl bg-[#F0EEFF] p-4 text-sm text-[#4B3FE5] border border-[#5B4FFF]/20">
                <div className="flex items-center gap-2 font-bold mb-2 tracking-wide">
                  <Sparkles className="h-4 w-4" /> WHY THIS DECISION?
                </div>
                <p className="leading-relaxed font-medium">
                  {opportunity.ai_summary}
                </p>
              </div>
            )}
          </div>

          {/* Right Side: Recent Actions */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-[#EAB308]"></div>
                <h4 className="text-sm font-bold text-[#1A1A1A]">Recent actions by agent</h4>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/opportunities/${opportunity.opportunity_id}`);
                }}
                className="text-xs font-bold text-[#5B4FFF] hover:underline"
              >
                View Decisions & Insights →
              </button>
            </div>
            
            <div className="flex-1 rounded-xl border border-[#E4E4E7] bg-white p-5 shadow-sm">
              <div className="space-y-6">
                {recentActions.map((action, idx) => (
                  <div key={action.id} className="relative pl-5 before:absolute before:left-0 before:top-2 before:h-2 before:w-2 before:rounded-full before:bg-[#E4E4E7]">
                    {idx !== recentActions.length - 1 && (
                      <div className="absolute left-[3px] top-4 bottom-[-24px] w-0.5 bg-[#F4F4F5]"></div>
                    )}
                    <div className="flex justify-between items-start mb-1.5">
                      <span className="text-sm font-bold text-[#1A1A1A] leading-snug pr-4">{action.desc}</span>
                      <span className="text-[11px] font-semibold text-[#A1A1AA] whitespace-nowrap pt-0.5">{action.time}</span>
                    </div>
                    <div className="text-[10px] font-bold text-[#71717A] uppercase tracking-wider">{action.type}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
