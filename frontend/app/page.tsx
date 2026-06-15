'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  TrendingUp,
  Send,
  ArrowRight,
  Check,
  X,
  Activity,
} from 'lucide-react';
import {
  getOpportunityDashboard,
  getActivityStream,
  createOpportunityFromGoal,
} from '@/lib/api';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface Opportunity {
  id: string;
  opportunity_id: string;
  title: string;
  opportunity_type: string;
  audience_size: number;
  potential_revenue: number;
  confidence_score: number;
  priority_score: number;
  description: string;
  ai_summary: string;
  recommended_action: string;
  supporting_customer_segment: string;
  trigger_reason: string;
  audience_definition?: Record<string, string>;
  average_spend?: number;
  average_orders?: number;
  status: string;
}

interface ActivityItem {
  id: string;
  agentId: string;
  actionType: string;
  description: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const PLACEHOLDER_SUGGESTIONS = [
  'Increase repeat purchases',
  'Recover dormant customers',
  'Boost loyalty engagement',
  'Find high-value segments',
  'Reduce customer churn',
];

const SUGGESTION_CHIPS = [
  'Find customers likely to churn',
  'Increase denim sales',
  'Recover dormant VIPs',
];

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────
const formatCurrency = (amount: number) => {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
  return `₹${amount}`;
};

const parseChannel = (action: string): string => {
  if (action.toLowerCase().includes('whatsapp')) return 'WhatsApp';
  if (action.toLowerCase().includes('email')) return 'Email';
  if (action.toLowerCase().includes('sms')) return 'SMS';
  return 'WhatsApp';
};

const getPriorityLabel = (score: number) => {
  if (score >= 70) return { label: 'High Priority', color: 'bg-[#F0EEFF] text-[#5B4FFF]' };
  if (score >= 40) return { label: 'Medium Priority', color: 'bg-amber-50 text-amber-600' };
  return { label: 'Low Priority', color: 'bg-gray-100 text-gray-600' };
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good Morning.';
  if (hour >= 12 && hour < 17) return 'Good Afternoon.';
  if (hour >= 17 || hour < 5) return 'Good Evening.';
};

const timeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const actionTypeLabel: Record<string, string> = {
  discovered_opportunity: 'Discovered opportunity',
  launched_campaign: 'Launched campaign',
  sent_messages: 'Sent messages',
  achieved_milestone: 'Milestone reached',
  generating_opportunity: 'Generating opportunity',
};

const parseTriggerReasons = (opp: Opportunity): string[] => {
  const reasons: string[] = [];
  if (opp.average_spend) {
    reasons.push(`Average Order Value ₹${Math.round(opp.average_spend).toLocaleString()}`);
  }
  if (opp.audience_definition?.days_since_last_order) {
    const days = opp.audience_definition.days_since_last_order.replace('>=', '').trim();
    reasons.push(`Last purchase > ${days} days ago`);
  } else if (opp.trigger_reason?.toLowerCase().includes('days')) {
    reasons.push('Extended purchase gap detected');
  }
  if (opp.supporting_customer_segment) {
    reasons.push(`${opp.supporting_customer_segment} segment`);
  }
  if (reasons.length === 0 && opp.trigger_reason) {
    return opp.trigger_reason.split('.').filter(s => s.trim()).slice(0, 3);
  }
  return reasons.length > 0 ? reasons : ['High-value customer pattern detected'];
};

// ─────────────────────────────────────────────────────────────
// Typewriter hook
// ─────────────────────────────────────────────────────────────
function useTypewriter(text: string, speed = 28) {
  const [displayed, setDisplayed] = useState('');
  const prevText = useRef('');

  useEffect(() => {
    if (!text || text === prevText.current) return;
    prevText.current = text;
    setDisplayed('');
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return displayed;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export default function HomePage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [processing, setProcessing] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [generatingSteps, setGeneratingSteps] = useState<string[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [pinnedOpportunity, setPinnedOpportunity] = useState<Opportunity | null>(null);
  const [cardAnimating, setCardAnimating] = useState(false);
  const stepIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const optimisticIdsRef = useRef<Set<string>>(new Set());

  const newestActivity = activityItems[0];
  const typedText = useTypewriter(newestActivity?.description ?? '');
  const thinkingText = useTypewriter(generatingSteps[currentStepIndex] ?? '');

  // Rotating placeholder
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex(prev => (prev + 1) % PLACEHOLDER_SUGGESTIONS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Fetch opportunities
  useEffect(() => {
    const run = async () => {
      try {
        const companyId = window.localStorage.getItem('xeno_company_id') ?? undefined;
        const data = await getOpportunityDashboard(companyId);
        if (data.success && data.data.topOpportunities) {
          setOpportunities(data.data.topOpportunities);
        }
      } catch {
        setError('Unable to load opportunities. Check backend connection.');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  // Fetch activity stream
  useEffect(() => {
    const run = async () => {
      try {
        const companyId = window.localStorage.getItem('xeno_company_id');
        if (!companyId) return;
        const data = await getActivityStream(companyId, 10);
        if (data.success && Array.isArray(data.data)) {
          setActivityItems(data.data);
        }
      } catch {
        // silently fail — activity stream is non-critical
      } finally {
        setActivityLoading(false);
      }
    };
    run();
    const interval = setInterval(run, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmitQuery = async () => {
    if (!query.trim()) return;

    const submittedQuery = query.trim();
    const steps = [
      `Spawning agent for: "${submittedQuery}"...`,
      'Scanning customer database...',
      'Calculating revenue potential...',
      'Mapping audience segments...',
      'Finalizing opportunity strategy...',
    ];

    setGeneratingSteps(steps);
    setCurrentStepIndex(0);
    setProcessing(true);
    setQuery('');

    // Push first optimistic activity item
    const pushOptimistic = (idx: number) => {
      const id = `optimistic-${crypto.randomUUID()}`;
      optimisticIdsRef.current.add(id);
      setActivityItems(prev => [
        {
          id,
          agentId: 'xeno',
          actionType: 'generating_opportunity',
          description: steps[idx],
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    };

    pushOptimistic(0);

    stepIntervalRef.current = setInterval(() => {
      setCurrentStepIndex(prev => {
        const next = prev + 1;
        if (next < steps.length) {
          pushOptimistic(next);
          return next;
        }
        clearInterval(stepIntervalRef.current!);
        stepIntervalRef.current = null;
        return prev;
      });
    }, 2000);

    setQueryError(null);
    try {
      const companyId = window.localStorage.getItem('xeno_company_id') ?? undefined;
      const result = await createOpportunityFromGoal(submittedQuery, companyId);
      const data = await getOpportunityDashboard(companyId);
      if (data.success && data.data.topOpportunities) {
        setOpportunities(data.data.topOpportunities);
      }
      if (result.success && result.data) {
        setCardAnimating(true);
        setTimeout(() => {
          setPinnedOpportunity(result.data);
          setCardAnimating(false);
        }, 300);
      }
    } catch {
      setQueryError('Xeno couldn\'t generate that opportunity right now. Try a different query.');
      setTimeout(() => setQueryError(null), 4000);
    } finally {
      if (stepIntervalRef.current) {
        clearInterval(stepIntervalRef.current);
        stepIntervalRef.current = null;
      }
      setCurrentStepIndex(0);
      setGeneratingSteps([]);
      // Remove optimistic items — real activity poll will fill in
      setActivityItems(prev => prev.filter(item => !optimisticIdsRef.current.has(item.id)));
      optimisticIdsRef.current.clear();
      setProcessing(false);
    }
  };

  const handleShowTopOpportunity = () => {
    setCardAnimating(true);
    setTimeout(() => {
      setPinnedOpportunity(null);
      setCardAnimating(false);
    }, 300);
  };

  // When processing: featured slot shows skeleton, full list shifts down to grid
  const featuredOpportunity = processing ? null : (pinnedOpportunity ?? opportunities[0]);
  const gridOpportunities = processing ? opportunities.slice(0, 3) : opportunities.slice(1, 4);

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* ── Main ── */}
      <main className="max-w-[1400px] mx-auto px-6 py-12">
        {/* ── Greeting + Command Bar ── */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-[#1A1A1A] mb-3">{getGreeting()}</h1>
          <p className="text-[#6B7280] text-base max-w-xl mx-auto mb-8">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-[#5B4FFF] border-t-transparent rounded-full animate-spin" />
                Scanning for opportunities…
              </span>
            ) : (
              'Xeno analyzed customer behavior, campaign performance, and revenue signals while you were away.'
            )}
          </p>

          <div className="max-w-2xl mx-auto">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#5B4FFF] to-[#8B5CF6] rounded-2xl opacity-0 group-focus-within:opacity-20 blur transition-opacity" />
              <div className="relative flex items-center gap-3 p-4 bg-white rounded-2xl border border-[#E5E7EB] shadow-sm group-focus-within:border-[#5B4FFF] transition-all">
                <Sparkles className="h-5 w-5 text-[#5B4FFF] shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmitQuery()}
                  placeholder={PLACEHOLDER_SUGGESTIONS[placeholderIndex]}
                  className="flex-1 bg-transparent text-sm text-[#1A1A1A] placeholder:text-[#9CA3AF] outline-none"
                  disabled={processing}
                />
                {processing ? (
                  <div className="h-9 w-9 rounded-xl bg-[#5B4FFF] flex items-center justify-center shrink-0">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <button
                    onClick={handleSubmitQuery}
                    disabled={!query.trim()}
                    className="h-9 w-9 rounded-xl bg-[#5B4FFF] text-white disabled:opacity-40 hover:bg-[#4B3FE5] transition-all flex items-center justify-center shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 mt-4">
              {SUGGESTION_CHIPS.map(chip => (
                <button
                  key={chip}
                  onClick={() => setQuery(chip)}
                  className="px-3 py-1.5 text-xs text-[#6B7280] bg-white border border-[#E5E7EB] rounded-full hover:border-[#5B4FFF] hover:text-[#5B4FFF] transition-all"
                >
                  {chip}
                </button>
              ))}
            </div>
            {queryError && (
              <p className="text-center text-xs text-red-500 mt-3">{queryError}</p>
            )}
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="text-center py-12">
            <p className="text-red-500 mb-4">{error}</p>
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#5B4FFF] text-white rounded-lg hover:bg-[#4B3FE5] transition-colors"
            >
              Go to Onboarding <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && !error && opportunities.length === 0 && (
          <div className="text-center py-16">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-[#9CA3AF]" />
            <h2 className="text-xl font-semibold text-[#1A1A1A] mb-2">No opportunities yet</h2>
            <p className="text-[#6B7280] mb-6">Upload customer data to discover growth opportunities</p>
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#5B4FFF] text-white rounded-xl hover:bg-[#4B3FE5] transition-colors font-medium"
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* ── Two Column Layout ── */}
        {!loading && (featuredOpportunity || processing) && (
          <div className="grid grid-cols-12 gap-8">
            {/* ── Left: Featured Opportunity or Thinking Skeleton ── */}
            <div className="col-span-8">
              {processing ? (
                /* ── Thinking Skeleton Card ── */
                <div className="relative bg-white rounded-2xl border border-[#5B4FFF]/20 p-8 shadow-sm overflow-hidden">
                  {/* Shimmer overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#5B4FFF]/[0.03] to-transparent animate-pulse pointer-events-none" />

                  {/* Pulsing badge */}
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F0EEFF] text-[#5B4FFF] text-[10px] font-bold uppercase tracking-wider rounded-full mb-6">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#5B4FFF] opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#5B4FFF]" />
                    </span>
                    Xeno is analyzing your request
                  </div>

                  <h2 className="text-3xl font-bold text-[#1A1A1A] mb-3">
                    Generating Opportunity...
                  </h2>
                  <p className="text-[#5B4FFF] text-base mb-2 min-h-[1.5rem]">
                    {thinkingText}
                    <span className="inline-block w-0.5 h-4 bg-[#5B4FFF] ml-0.5 animate-pulse align-middle" />
                  </p>
                  <p className="text-[#9CA3AF] text-sm mb-10">
                    Step {currentStepIndex + 1} of {generatingSteps.length}
                  </p>

                  {/* Skeleton metric bars */}
                  <div className="flex gap-16 mb-10">
                    {['Recoverable Revenue', 'Audience Size'].map(label => (
                      <div key={label}>
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-2">{label}</p>
                        <div className="h-9 w-28 bg-gray-100 rounded-lg animate-pulse" />
                      </div>
                    ))}
                  </div>

                  {/* Skeleton info rows */}
                  <div className="grid grid-cols-3 gap-6 pt-8 border-t border-[#E5E7EB]">
                    {['Why Xeno Found This', 'Predicted Outcome', 'Recommended Action'].map(col => (
                      <div key={col}>
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-4">{col}</p>
                        <div className="space-y-2.5">
                          <div className="h-3 w-full bg-gray-100 rounded animate-pulse" />
                          <div className="h-3 w-4/5 bg-gray-100 rounded animate-pulse" />
                          <div className="h-3 w-3/5 bg-gray-100 rounded animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : featuredOpportunity ? (
              <div
                className={`bg-white rounded-2xl border border-[#E5E7EB] p-8 shadow-sm transition-all duration-300 ${
                  cardAnimating ? 'opacity-0 translate-y-3' : 'opacity-100 translate-y-0'
                }`}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#5B4FFF] text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                    <Sparkles className="h-3 w-3" />
                    {pinnedOpportunity ? 'Generated for You' : 'Highest Impact Opportunity'}
                  </div>
                  {pinnedOpportunity && (
                    <button
                      onClick={handleShowTopOpportunity}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-[#6B7280] bg-[#F3F4F6] hover:bg-[#E5E7EB] rounded-full transition-all"
                    >
                      <TrendingUp className="h-3 w-3" />
                      Show Top Opportunity
                    </button>
                  )}
                </div>

                <h2 className="text-3xl font-bold text-[#1A1A1A] mb-3">
                  {featuredOpportunity.title}
                </h2>
                <p className="text-[#6B7280] text-base leading-relaxed mb-8 max-w-2xl">
                  {featuredOpportunity.ai_summary || featuredOpportunity.description}
                </p>

                {/* 2-metric row */}
                <div className="flex gap-16 mb-10">
                  <div>
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-2">
                      Recoverable Revenue
                    </p>
                    <p className="text-3xl font-bold text-[#5B4FFF]">
                      {formatCurrency(featuredOpportunity.potential_revenue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-2">
                      Audience Size
                    </p>
                    <p className="text-3xl font-bold text-[#1A1A1A]">
                      {featuredOpportunity.audience_size.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* 2-column info */}
                <div className="grid grid-cols-2 gap-8 pt-8 border-t border-[#E5E7EB]">
                  <div>
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-4">
                      Why Xeno Found This
                    </p>
                    <ul className="space-y-2.5">
                      {parseTriggerReasons(featuredOpportunity).map((reason, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[#4B5563]">
                          <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-4">
                      Recommended Action
                    </p>
                    <div className="bg-[#F9FAFB] rounded-xl p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#6B7280]">Channel</span>
                        <span className="font-medium text-[#1A1A1A]">
                          {parseChannel(featuredOpportunity.recommended_action)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#6B7280]">Segment</span>
                        <span className="font-medium text-[#1A1A1A]">
                          {featuredOpportunity.supporting_customer_segment || 'General'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#6B7280]">Priority</span>
                        <span
                          className={`font-medium ${
                            featuredOpportunity.priority_score >= 70
                              ? 'text-[#5B4FFF]'
                              : featuredOpportunity.priority_score >= 40
                              ? 'text-amber-600'
                              : 'text-gray-600'
                          }`}
                        >
                          {getPriorityLabel(featuredOpportunity.priority_score).label.replace(' Priority', '')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CTA Buttons */}
                <div className="flex items-center gap-4 mt-8">
                  <Link
                    href={`/opportunities/${featuredOpportunity.opportunity_id || featuredOpportunity.id}`}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#5B4FFF] text-white text-sm font-semibold rounded-full hover:bg-[#4B3FE5] transition-colors"
                  >
                    Review Opportunity →
                  </Link>
                  <Link
                    href="/opportunities"
                    className="text-sm font-medium text-[#6B7280] hover:text-[#1A1A1A] transition-colors"
                  >
                    View All Opportunities
                  </Link>
                </div>
              </div>
              ) : null}
            </div>

            {/* ── Right: AI Activity Stream ── */}
            <div className="col-span-4 space-y-4">
              {/* Activity Stream Card */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <div className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#5B4FFF] opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#5B4FFF]" />
                    </div>
                    <h3 className="text-sm font-bold text-[#1A1A1A]">Xeno Activity</h3>
                  </div>
                  {activityItems.length > 0 && (
                    <button
                      onClick={() => setModalOpen(true)}
                      className="text-[10px] font-medium text-[#5B4FFF] hover:underline"
                    >
                      See all
                    </button>
                  )}
                </div>

                {activityLoading ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <div className="h-8 w-8 rounded-full border-2 border-[#E5E7EB] border-t-[#5B4FFF] animate-spin" />
                    <p className="text-xs text-[#9CA3AF]">Loading activity…</p>
                  </div>
                ) : activityItems.length === 0 ? (
                  <div className="text-center py-6">
                    <Activity className="h-8 w-8 mx-auto mb-2 text-[#D1D5DB]" />
                    <p className="text-xs text-[#9CA3AF]">
                      Xeno is discovering opportunities…
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activityItems.slice(0, 5).map((item, idx) => (
                      <div key={item.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                              idx === 0 ? 'bg-[#5B4FFF]' : 'bg-[#D1D5DB]'
                            }`}
                          />
                          {idx < activityItems.slice(0, 5).length - 1 && (
                            <div className="w-px flex-1 bg-[#E5E7EB] mt-1" />
                          )}
                        </div>
                        <div className="pb-4 flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[#5B4FFF] uppercase tracking-wide mb-0.5">
                            {actionTypeLabel[item.actionType] ?? item.actionType}
                          </p>
                          <p className="text-sm text-[#1A1A1A] leading-snug">
                            {idx === 0 ? (
                              <>
                                {typedText}
                                {typedText.length < (item.description?.length ?? 0) && (
                                  <span className="inline-block w-0.5 h-3.5 bg-[#5B4FFF] ml-0.5 animate-pulse align-middle" />
                                )}
                              </>
                            ) : (
                              item.description
                            )}
                          </p>
                          <p className="text-[10px] text-[#9CA3AF] mt-1">{timeAgo(item.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ── Other Opportunities ── */}
        {!loading && gridOpportunities.length > 0 && (
          <div className="mt-12">
            <h3 className="text-lg font-bold text-[#1A1A1A] mb-6">
              {processing ? 'Current Opportunities' : 'Other Opportunities'}
            </h3>
            <div className="grid grid-cols-3 gap-6">
              {gridOpportunities.map((opp, i) => {
                const priority = getPriorityLabel(opp.priority_score);
                return (
                  <Link
                    key={opp.opportunity_id || opp.id || i}
                    href={`/opportunities/${opp.opportunity_id || opp.id}`}
                    className="bg-white rounded-xl border border-[#E5E7EB] p-6 hover:border-[#5B4FFF] hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="text-base font-semibold text-[#1A1A1A] group-hover:text-[#5B4FFF] transition-colors">
                        {opp.title}
                      </h4>
                      <span
                        className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${priority.color}`}
                      >
                        {priority.label.replace(' Priority', '')}
                      </span>
                    </div>
                    <p className="text-xl font-bold text-[#5B4FFF] mb-2">
                      {formatCurrency(opp.potential_revenue)}
                      <span className="text-xs font-normal text-[#9CA3AF] ml-1">Est. Value</span>
                    </p>
                    <p className="text-sm text-[#6B7280] line-clamp-2">{opp.description}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ── Activity Modal ── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col m-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
              <div className="flex items-center gap-2">
                <div className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#5B4FFF] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#5B4FFF]" />
                </div>
                <h2 className="text-base font-bold text-[#1A1A1A]">Xeno Agent Activity Log</h2>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="h-8 w-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <X className="h-4 w-4 text-[#6B7280]" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {activityItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-[#E5E7EB] overflow-hidden"
                >
                  <div className="flex items-start justify-between px-4 py-3 bg-[#F9FAFB]">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full shrink-0 mt-0.5 ${
                          idx === 0 ? 'bg-[#5B4FFF]' : 'bg-[#D1D5DB]'
                        }`}
                      />
                      <span className="text-xs font-semibold text-[#5B4FFF] uppercase tracking-wide">
                        {actionTypeLabel[item.actionType] ?? item.actionType}
                      </span>
                    </div>
                    <span className="text-[10px] text-[#9CA3AF]">{timeAgo(item.createdAt)}</span>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-sm text-[#1A1A1A] mb-2">{item.description}</p>
                    {item.details && Object.keys(item.details).length > 0 && (
                      <pre className="text-[11px] text-[#6B7280] bg-[#F3F4F6] rounded-lg p-3 overflow-x-auto font-mono leading-relaxed">
                        {JSON.stringify(item.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}

              {activityItems.length === 0 && (
                <div className="text-center py-12">
                  <Activity className="h-10 w-10 mx-auto mb-3 text-[#D1D5DB]" />
                  <p className="text-sm text-[#9CA3AF]">No activity logged yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
