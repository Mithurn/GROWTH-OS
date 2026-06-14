'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Sparkles,
  Lightbulb,
  TrendingUp,
  Rocket,
  Check,
  Send,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';

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

interface IntelligenceBrief {
  generatedAt: string;
  summary: string[];
  keyInsights: string[];
  recommendation: {
    action: string;
    potentialRevenue: number;
  };
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
  if (hour >= 17 && hour < 21) return 'Good Evening.';
  return 'Good Night.';
};

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export default function HomePage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [intelligenceBrief, setIntelligenceBrief] = useState<IntelligenceBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [processing, setProcessing] = useState(false);
  const [mode, setMode] = useState<'operator' | 'autonomous'>('operator');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // Rotating placeholder animation
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_SUGGESTIONS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Fetch opportunities
  useEffect(() => {
    const fetchOpportunities = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/opportunities');
        const data = await res.json();
        if (data.success && data.data.topOpportunities) {
          setOpportunities(data.data.topOpportunities);
        }
      } catch (err) {
        console.error('Failed to fetch opportunities:', err);
        setError('Unable to load opportunities. Check backend connection.');
      } finally {
        setLoading(false);
      }
    };
    fetchOpportunities();
  }, []);

  // Fetch intelligence brief
  useEffect(() => {
    const fetchIntelligenceBrief = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/analytics/intelligence-brief');
        const data = await res.json();
        if (data.success && data.data) {
          setIntelligenceBrief(data.data);
        }
      } catch (err) {
        console.error('Failed to fetch intelligence brief:', err);
      } finally {
        setInsightsLoading(false);
      }
    };
    fetchIntelligenceBrief();
  }, []);

  const handleSubmitQuery = async () => {
    if (!query.trim()) return;
    setProcessing(true);
    try {
      const res = await fetch('http://localhost:3001/api/opportunities/create-from-goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: query }),
      });
      if (res.ok) {
        // Refetch opportunities
        const oppRes = await fetch('http://localhost:3001/api/opportunities');
        const data = await oppRes.json();
        if (data.success && data.data.topOpportunities) {
          setOpportunities(data.data.topOpportunities);
        }
      }
    } catch (err) {
      console.error('Failed to create opportunity:', err);
    } finally {
      setProcessing(false);
      setQuery('');
    }
  };

  const featuredOpportunity = opportunities[0];
  const otherOpportunities = opportunities.slice(1, 4);

  // Parse trigger reason into bullet points
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

    // Fallback if no specific reasons
    if (reasons.length === 0 && opp.trigger_reason) {
      return opp.trigger_reason.split('.').filter(s => s.trim()).slice(0, 3);
    }

    return reasons.length > 0 ? reasons : ['High-value customer pattern detected'];
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* ── Top Navigation ── */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#E5E7EB]">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="relative h-6 w-24">
              <Image src="/logo.png" alt="Xeno" fill className="object-contain object-left" />
            </Link>
            <nav className="flex items-center gap-1">
              {[
                { label: 'Overview', href: '/', active: true },
                { label: 'Opportunities', href: '/opportunities', active: false },
                { label: 'Campaigns', href: '/campaigns', active: false },
                { label: 'Intelligence', href: '/intelligence', active: false },
                { label: 'Analytics', href: '/analytics', active: false },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    item.active
                      ? 'text-[#5B4FFF] bg-[#F0EEFF]'
                      : 'text-[#6B7280] hover:text-[#1A1A1A] hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {/* Operator / Autonomous Toggle */}
            <div className="flex items-center bg-[#F3F4F6] rounded-full p-0.5">
              <button
                onClick={() => setMode('operator')}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                  mode === 'operator'
                    ? 'bg-[#1A1A1A] text-white'
                    : 'text-[#6B7280] hover:text-[#1A1A1A]'
                }`}
              >
                Operator
              </button>
              <button
                onClick={() => setMode('autonomous')}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all flex items-center gap-1.5 ${
                  mode === 'autonomous'
                    ? 'bg-[#1A1A1A] text-white'
                    : 'text-[#6B7280] hover:text-[#1A1A1A]'
                }`}
              >
                Autonomous
              </button>
            </div>
            {/* User Avatar */}
            <div className="h-8 w-8 rounded-full bg-[#5B4FFF] flex items-center justify-center text-white text-xs font-semibold">
              U
            </div>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="max-w-[1400px] mx-auto px-6 py-12">
        {/* ── Hero / Greeting Section ── */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-[#1A1A1A] mb-3">
            {getGreeting()}
          </h1>
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

          {/* AI Command Bar */}
          <div className="max-w-2xl mx-auto">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-[#5B4FFF] to-[#8B5CF6] rounded-2xl opacity-0 group-focus-within:opacity-20 blur transition-opacity" />
              <div className="relative flex items-center gap-3 p-4 bg-white rounded-2xl border border-[#E5E7EB] shadow-sm group-focus-within:border-[#5B4FFF] transition-all">
                <div className="relative flex-shrink-0">
                  <Sparkles className="h-5 w-5 text-[#5B4FFF]" />
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitQuery()}
                  placeholder={PLACEHOLDER_SUGGESTIONS[placeholderIndex]}
                  className="flex-1 bg-transparent text-sm text-[#1A1A1A] placeholder:text-[#9CA3AF] outline-none transition-all"
                  disabled={processing}
                />
                {processing ? (
                  <div className="h-9 w-9 rounded-xl bg-[#5B4FFF] flex items-center justify-center flex-shrink-0">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <button
                    onClick={handleSubmitQuery}
                    disabled={!query.trim()}
                    className="h-9 w-9 rounded-xl bg-[#5B4FFF] text-white disabled:opacity-40 transition-all hover:bg-[#4B3FE5] flex items-center justify-center flex-shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Suggestion Chips */}
            <div className="flex items-center justify-center gap-2 mt-4">
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => setQuery(chip)}
                  className="px-3 py-1.5 text-xs text-[#6B7280] bg-white border border-[#E5E7EB] rounded-full hover:border-[#5B4FFF] hover:text-[#5B4FFF] transition-all"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Error State ── */}
        {error && (
          <div className="text-center py-12">
            <p className="text-red-500 mb-4">{error}</p>
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#5B4FFF] text-white rounded-lg hover:bg-[#4B3FE5] transition-colors"
            >
              Go to Onboarding
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* ── No Opportunities State ── */}
        {!loading && !error && opportunities.length === 0 && (
          <div className="text-center py-16">
            <Sparkles className="h-12 w-12 mx-auto mb-4 text-[#9CA3AF]" />
            <h2 className="text-xl font-semibold text-[#1A1A1A] mb-2">No opportunities yet</h2>
            <p className="text-[#6B7280] mb-6">Upload customer data to discover growth opportunities</p>
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#5B4FFF] text-white rounded-xl hover:bg-[#4B3FE5] transition-colors font-medium"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* ── Two Column Layout ── */}
        {!loading && featuredOpportunity && (
          <div className="grid grid-cols-12 gap-8">
            {/* ── Left Column: Featured Opportunity ── */}
            <div className="col-span-8">
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 shadow-sm">
                {/* Badge */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#5B4FFF] text-white text-[10px] font-bold uppercase tracking-wider rounded-full mb-6">
                  <Sparkles className="h-3 w-3" />
                  Highest Impact Opportunity
                </div>

                {/* Title & Description */}
                <h2 className="text-3xl font-bold text-[#1A1A1A] mb-3">
                  {featuredOpportunity.title}
                </h2>
                <p className="text-[#6B7280] text-base leading-relaxed mb-8 max-w-2xl">
                  {featuredOpportunity.ai_summary || featuredOpportunity.description}
                </p>

                {/* Metrics Row */}
                <div className="grid grid-cols-3 gap-8 mb-10">
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
                  <div>
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-2">
                      Confidence
                    </p>
                    <p className="text-3xl font-bold text-[#1A1A1A]">
                      {Math.round(featuredOpportunity.confidence_score)}%
                    </p>
                  </div>
                </div>

                {/* Three Column Info Section */}
                <div className="grid grid-cols-3 gap-6 pt-8 border-t border-[#E5E7EB]">
                  {/* Why Xeno Found This */}
                  <div>
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-4">
                      Why Xeno Found This
                    </p>
                    <ul className="space-y-2.5">
                      {parseTriggerReasons(featuredOpportunity).map((reason, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[#4B5563]">
                          <Check className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Predicted Outcome */}
                  <div>
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-4">
                      Predicted Outcome
                    </p>
                    <ul className="space-y-2.5">
                      <li className="flex items-start gap-2 text-sm text-[#4B5563]">
                        <TrendingUp className="h-4 w-4 text-[#5B4FFF] flex-shrink-0 mt-0.5" />
                        <span>{formatCurrency(featuredOpportunity.potential_revenue)} Revenue Recovery</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-[#4B5563]">
                        <TrendingUp className="h-4 w-4 text-[#5B4FFF] flex-shrink-0 mt-0.5" />
                        <span>~{Math.round(featuredOpportunity.audience_size * (featuredOpportunity.confidence_score / 100) * 0.4)} Expected Orders</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-[#4B5563]">
                        <TrendingUp className="h-4 w-4 text-[#5B4FFF] flex-shrink-0 mt-0.5" />
                        <span>{Math.round(featuredOpportunity.confidence_score * 0.4)}% Conversion Rate</span>
                      </li>
                    </ul>
                  </div>

                  {/* Recommended Action */}
                  <div>
                    <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-4">
                      Recommended Action
                    </p>
                    <div className="bg-[#F9FAFB] rounded-xl p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#6B7280]">Channel</span>
                        <span className="font-medium text-[#1A1A1A]">{parseChannel(featuredOpportunity.recommended_action)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#6B7280]">Segment</span>
                        <span className="font-medium text-[#1A1A1A]">{featuredOpportunity.supporting_customer_segment || 'General'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-[#6B7280]">Priority</span>
                        <span className={`font-medium ${featuredOpportunity.priority_score >= 70 ? 'text-[#5B4FFF]' : featuredOpportunity.priority_score >= 40 ? 'text-amber-600' : 'text-gray-600'}`}>
                          {getPriorityLabel(featuredOpportunity.priority_score).label.replace(' Priority', '')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CTA Buttons */}
                <div className="flex items-center gap-3 mt-8">
                  <Link
                    href={`/campaigns?opportunityId=${featuredOpportunity.opportunity_id || featuredOpportunity.id}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#5B4FFF] text-white rounded-xl hover:bg-[#4B3FE5] transition-colors font-medium"
                  >
                    <Rocket className="h-4 w-4" />
                    Plan Campaign
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`/opportunities/${featuredOpportunity.opportunity_id || featuredOpportunity.id}`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-[#1A1A1A] border border-[#E5E7EB] rounded-xl hover:border-[#5B4FFF] hover:text-[#5B4FFF] transition-colors font-medium"
                  >
                    Review Strategy
                  </Link>
                </div>
              </div>
            </div>

            {/* ── Right Column: AI Insights ── */}
            <div className="col-span-4">
              <h3 className="text-lg font-bold text-[#1A1A1A] mb-4">AI Insights</h3>

              {insightsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white rounded-xl border border-[#E5E7EB] p-5 animate-pulse">
                      <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
                      <div className="h-4 w-full bg-gray-100 rounded mb-2" />
                      <div className="h-4 w-3/4 bg-gray-100 rounded" />
                    </div>
                  ))}
                </div>
              ) : intelligenceBrief ? (
                <div className="space-y-4">
                  {/* Key Insights */}
                  {intelligenceBrief.keyInsights?.slice(0, 2).map((insight, i) => (
                    <div key={i} className="bg-white rounded-xl border border-[#E5E7EB] p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Lightbulb className="h-4 w-4 text-[#5B4FFF]" />
                        <span className="text-[10px] font-bold text-[#5B4FFF] uppercase tracking-wider">
                          Key Insight
                        </span>
                      </div>
                      <p className="text-sm text-[#4B5563] leading-relaxed">
                        {insight}
                      </p>
                    </div>
                  ))}

                  {/* Recommendation */}
                  {intelligenceBrief.recommendation && (
                    <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                          Next Action
                        </span>
                      </div>
                      <p className="text-sm text-[#4B5563] leading-relaxed mb-2">
                        {intelligenceBrief.recommendation.action}
                      </p>
                      {intelligenceBrief.recommendation.potentialRevenue > 0 && (
                        <p className="text-sm font-medium text-[#5B4FFF]">
                          Potential: {formatCurrency(intelligenceBrief.recommendation.potentialRevenue)}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Fallback to summary if no insights */}
                  {(!intelligenceBrief.keyInsights || intelligenceBrief.keyInsights.length < 2) &&
                    intelligenceBrief.summary?.map((item, i) => (
                      <div key={`summary-${i}`} className="bg-white rounded-xl border border-[#E5E7EB] p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <Lightbulb className="h-4 w-4 text-[#5B4FFF]" />
                          <span className="text-[10px] font-bold text-[#5B4FFF] uppercase tracking-wider">
                            Summary
                          </span>
                        </div>
                        <p className="text-sm text-[#4B5563] leading-relaxed">{item}</p>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 text-center">
                  <p className="text-sm text-[#6B7280]">
                    AI insights will appear once campaigns are running.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Other Opportunities Section ── */}
        {!loading && otherOpportunities.length > 0 && (
          <div className="mt-12">
            <h3 className="text-lg font-bold text-[#1A1A1A] mb-6">Other Opportunities</h3>
            <div className="grid grid-cols-3 gap-6">
              {otherOpportunities.map((opp) => {
                const priority = getPriorityLabel(opp.priority_score);
                return (
                  <Link
                    key={opp.id}
                    href={`/opportunities/${opp.opportunity_id || opp.id}`}
                    className="bg-white rounded-xl border border-[#E5E7EB] p-6 hover:border-[#5B4FFF] hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="text-base font-semibold text-[#1A1A1A] group-hover:text-[#5B4FFF] transition-colors">
                        {opp.title}
                      </h4>
                      <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${priority.color}`}>
                        {priority.label.replace(' Priority', '')}
                      </span>
                    </div>
                    <p className="text-xl font-bold text-[#5B4FFF] mb-2">
                      {formatCurrency(opp.potential_revenue)}
                      <span className="text-xs font-normal text-[#9CA3AF] ml-1">Est. Value</span>
                    </p>
                    <p className="text-sm text-[#6B7280] line-clamp-2">
                      {opp.description}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
