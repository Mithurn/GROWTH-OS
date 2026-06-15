'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ArrowRight,
  RotateCcw,
  ShieldAlert,
  TrendingUp,
  Star,
  LayoutGrid,
  Loader2,
} from 'lucide-react';
import {
  generateOpportunities,
  getOpportunityDashboard,
  createOpportunityFromGoal,
  getCampaigns,
} from '@/lib/api';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface Opportunity {
  opportunity_id: string;
  id?: string;
  title: string;
  opportunity_type: string;
  description: string;
  trigger_reason: string;
  ai_summary: string;
  audience_size: number;
  potential_revenue: number;
  confidence_score: number;
  priority_score: number;
  recommended_action: string;
  supporting_customer_segment: string;
  status: string;
  customer_count?: number;
}

interface OpportunityReport {
  totalOpportunities: number;
  totalRevenuePotential: number;
  totalCustomers: number;
  topOpportunities: Opportunity[];
  opportunityDistribution: Opportunity[];
}

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────
const formatCurrency = (amount: number) => {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
  return `₹${amount}`;
};

const parseChannel = (action: string): string => {
  if (!action) return 'WhatsApp';
  if (action.toLowerCase().includes('whatsapp')) return 'WhatsApp';
  if (action.toLowerCase().includes('email')) return 'Email';
  if (action.toLowerCase().includes('sms')) return 'SMS';
  return 'WhatsApp';
};

const getCategoryForType = (type: string): string => {
  const t = (type ?? '').toLowerCase();
  if (t.includes('recov') || t.includes('churn') || t.includes('dormant') || t.includes('winback')) return 'Recovery';
  if (t.includes('retention') || t.includes('retain') || t.includes('at-risk') || t.includes('risk')) return 'Retention';
  if (t.includes('expansion') || t.includes('growth') || t.includes('revenue') || t.includes('upsell') || t.includes('cross')) return 'Expansion';
  if (t.includes('loyalty') || t.includes('vip') || t.includes('reward') || t.includes('tier')) return 'Loyalty';
  return 'Expansion';
};

const normalizeStatus = (status: string): string => {
  if (!status) return 'new';
  return status.toLowerCase();
};

const CATEGORY_FILTERS = [
  { key: 'Recovery', icon: RotateCcw, color: 'text-blue-500' },
  { key: 'Retention', icon: ShieldAlert, color: 'text-amber-500' },
  { key: 'Expansion', icon: TrendingUp, color: 'text-emerald-500' },
  { key: 'Loyalty', icon: Star, color: 'text-purple-500' },
];

const STATUS_FILTERS = [
  { key: 'new', label: 'No Campaign Yet' },
  { key: 'awaiting_review', label: 'Campaign Draft' },
  { key: 'completed', label: 'Campaign Launched' },
];

const SUGGESTIONS = [
  'Find customers likely to churn',
  'Find dormant VIP customers',
  'Increase denim sales',
];

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export default function OpportunitiesPage() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | undefined>(undefined);
  const [companyIdLoaded, setCompanyIdLoaded] = useState(false);
  const [report, setReport] = useState<OpportunityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingGoal, setCreatingGoal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [goal, setGoal] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<string | null>(null);
  const [campaignMap, setCampaignMap] = useState<Record<string, string>>({}); // opportunityId → campaign status

  useEffect(() => {
    const id = window.localStorage.getItem('xeno_company_id') ?? undefined;
    setCompanyId(id);
    setCompanyIdLoaded(true);
  }, []);

  useEffect(() => {
    if (!companyIdLoaded) return;
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await getOpportunityDashboard(companyId);
        const data = res.data as OpportunityReport;
        if (!mounted) return;
        if (data.totalOpportunities > 0) {
          setReport(data);
        } else {
          const gen = await generateOpportunities(companyId);
          if (!mounted) return;
          setReport(gen.data as OpportunityReport);
        }
        // Load campaign statuses to show cues on each opportunity
        try {
          const campRes = await getCampaigns(companyId);
          const map: Record<string, string> = {};
          (campRes.data ?? []).forEach((c: any) => {
            if (c.opportunity_id) map[c.opportunity_id] = c.status;
          });
          if (mounted) setCampaignMap(map);
        } catch { /* non-critical */ }
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load opportunities');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [companyId, companyIdLoaded]);

  const allOpportunities = useMemo<Opportunity[]>(() => {
    const dist = report?.opportunityDistribution ?? [];
    const top = report?.topOpportunities ?? [];
    const merged = [...dist, ...top];
    const seen = new Set<string>();
    return merged.filter(o => {
      const key = o.opportunity_id || o.id || o.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [report]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, { count: number; revenue: number }> = {};
    allOpportunities.forEach(o => {
      const cat = getCategoryForType(o.opportunity_type);
      if (!counts[cat]) counts[cat] = { count: 0, revenue: 0 };
      counts[cat].count++;
      counts[cat].revenue += o.potential_revenue ?? 0;
    });
    return counts;
  }, [allOpportunities]);

  const getCampaignStatus = (oppId: string) => campaignMap[oppId] ?? null;

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { new: 0, awaiting_review: 0, completed: 0 };
    allOpportunities.forEach(o => {
      const id = o.opportunity_id || o.id || '';
      const cs = campaignMap[id];
      if (!cs) counts.new++;
      else if (cs === 'Launched') counts.completed++;
      else counts.awaiting_review++;
    });
    return counts;
  }, [allOpportunities, campaignMap]);

  const filtered = useMemo(() => {
    return allOpportunities.filter(o => {
      if (activeCategory && getCategoryForType(o.opportunity_type) !== activeCategory) return false;
      if (activeStatus) {
        const id = o.opportunity_id || o.id || '';
        const cs = campaignMap[id];
        if (activeStatus === 'new' && cs) return false;
        if (activeStatus === 'awaiting_review' && (cs === 'Launched' || !cs)) return false;
        if (activeStatus === 'completed' && cs !== 'Launched') return false;
      }
      return true;
    });
  }, [allOpportunities, activeCategory, activeStatus, campaignMap]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = goal.trim();
    if (!trimmed || creatingGoal) return;
    try {
      setCreatingGoal(true);
      setGoal('');
      await createOpportunityFromGoal(trimmed, companyId);
      const res = await getOpportunityDashboard(companyId);
      setReport(res.data as OpportunityReport);
    } catch {
      setError('Failed to create opportunity. Try again.');
    } finally {
      setCreatingGoal(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
          <p className="text-sm text-gray-500">Loading opportunities…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F9FAFB] overflow-hidden">
      {/* ── Left Sidebar ── */}
      <aside className="w-64 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
        <div className="p-5 space-y-6">
          {/* All Opportunities */}
          <div>
            <button
              onClick={() => { setActiveCategory(null); setActiveStatus(null); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                !activeCategory && !activeStatus
                  ? 'bg-indigo-500 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              All Opportunities
            </button>
          </div>

          {/* Categories */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">Categories</p>
            <div className="space-y-0.5">
              {CATEGORY_FILTERS.map(({ key, icon: Icon, color }) => {
                const data = categoryCounts[key];
                const isActive = activeCategory === key && !activeStatus;
                return (
                  <button
                    key={key}
                    onClick={() => { setActiveCategory(key); setActiveStatus(null); }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                      isActive ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-indigo-500' : color}`} />
                      {key}
                    </div>
                    {data && (
                      <span className="text-[11px] text-gray-400">
                        {data.count} · {formatCurrency(data.revenue)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">Status</p>
            <div className="space-y-0.5">
              {STATUS_FILTERS.map(({ key, label }) => {
                const count = key === 'new'
                  ? (statusCounts['new'] ?? 0) + (statusCounts[''] ?? 0) + (statusCounts['detected'] ?? 0)
                  : statusCounts[key] ?? 0;
                const isActive = activeStatus === key;
                return (
                  <button
                    key={key}
                    onClick={() => { setActiveStatus(key); setActiveCategory(null); }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
                      isActive ? 'bg-indigo-50 text-indigo-600 font-semibold' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>{label}</span>
                    {count > 0 && (
                      <span className="text-[11px] text-gray-400">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8 space-y-6">

          {/* ── AI Command Bar — hero element ── */}
          <div className="mb-12">
            <form onSubmit={handleSubmit}>
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md focus-within:border-indigo-300 focus-within:shadow-md transition-all">
                <div className="flex items-center gap-4 px-8 py-7">
                  <Sparkles className="h-7 w-7 text-indigo-400 shrink-0" />
                  <input
                    value={goal}
                    onChange={e => setGoal(e.target.value)}
                    placeholder="Ask Xeno to discover an opportunity..."
                    disabled={creatingGoal}
                    className="flex-1 bg-transparent text-2xl font-medium text-gray-800 placeholder:text-gray-300 outline-none"
                  />
                  <span className="text-xs font-medium text-gray-300 border border-gray-200 rounded px-2 py-1 shrink-0">⌘ K</span>
                </div>
              </div>
            </form>

            {/* Suggestions */}
            <div className="flex items-center gap-2 mt-4 px-2">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest shrink-0">TRY:</span>
              {SUGGESTIONS.map((s, i) => (
                <span key={s} className="flex items-center gap-2">
                  {i > 0 && <span className="text-gray-300">·</span>}
                  <button
                    onClick={() => setGoal(s)}
                    className="text-sm text-gray-400 hover:text-indigo-500 transition-colors"
                  >
                    {s}
                  </button>
                </span>
              ))}
            </div>

            {/* Generating state */}
            {creatingGoal && (
              <div className="mt-4 flex items-center gap-4 bg-white border border-gray-100 rounded-xl px-6 py-4 shadow-sm">
                <Loader2 className="h-5 w-5 text-indigo-400 animate-spin shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-700">Analyzing purchase patterns…</p>
                  <p className="text-xs text-gray-400 mt-0.5">Building audience &amp; estimating impact</p>
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Opportunity Rows */}
          <div className="space-y-4">
            {filtered.length === 0 && (
              <div className="text-center py-16 text-gray-400 text-sm">
                No opportunities match the current filter.
              </div>
            )}
            {filtered.map(opp => (
              <OpportunityRow
                key={opp.opportunity_id || opp.id || opp.title}
                opportunity={opp}
                campaignStatus={getCampaignStatus(opp.opportunity_id || opp.id || '')}
                onClick={() => router.push(`/opportunities/${opp.opportunity_id || opp.id}`)}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Opportunity Row
// ─────────────────────────────────────────────────────────────
function OpportunityRow({
  opportunity: opp,
  campaignStatus,
  onClick,
}: {
  opportunity: Opportunity;
  campaignStatus: string | null;
  onClick: () => void;
}) {
  const channel = parseChannel(opp.recommended_action);
  const isLaunched = campaignStatus === 'Launched';
  const hasDraft = !!campaignStatus && !isLaunched;

  const accentColor = isLaunched ? 'bg-emerald-500' : hasDraft ? 'bg-amber-400' : 'bg-indigo-500';

  const campaignBadge = () => {
    if (isLaunched) {
      return <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 rounded-full border border-emerald-200">● Campaign Live</span>;
    }
    if (hasDraft) {
      return <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600 rounded-full border border-amber-200">◐ Campaign Draft</span>;
    }
    return <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-500 rounded-full border border-indigo-200">✦ AI Generated</span>;
  };

  const ctaLabel = isLaunched ? 'View Analytics →' : hasDraft ? `${channel} → Review Campaign` : `${channel} → Create Campaign`;

  return (
    <div
      onClick={onClick}
      className="group relative flex items-center justify-between bg-white rounded-xl border border-gray-200 pl-5 pr-6 py-5 hover:shadow-lg hover:border-indigo-100 cursor-pointer transition-all duration-200 overflow-hidden"
    >
      {/* Left accent border — colour-coded by campaign state */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor} rounded-l-xl`} />

      {/* Left content */}
      <div className="min-w-0 flex-1 pl-4 pr-8">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-[15px] font-bold text-gray-900 group-hover:text-indigo-600 transition-colors leading-snug">
            {opp.title}
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-500 font-medium">
            {formatCurrency(opp.potential_revenue)} · {(opp.customer_count ?? opp.audience_size).toLocaleString()} customers · {opp.confidence_score}%
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-1.5 leading-relaxed line-clamp-1">
          {opp.trigger_reason || opp.description}
        </p>
      </div>

      {/* Right content */}
      <div className="flex flex-col items-end gap-2 shrink-0 min-w-[160px]">
        {campaignBadge()}
        <button
          onClick={e => { e.stopPropagation(); onClick(); }}
          className={`text-xs font-bold transition-colors ${isLaunched ? 'text-emerald-600 hover:text-emerald-800' : 'text-indigo-500 hover:text-indigo-700'}`}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
