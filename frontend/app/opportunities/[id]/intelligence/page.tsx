'use client';

import { AiOrb } from '@/components/ui/ai-orb';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  Send,
  MessageCircle,
  Download,
  Clock,
  CalendarDays,
  TrendingDown,
  Star,
} from 'lucide-react';
import { getOpportunityCustomers } from '@/lib/api';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface OpportunityRow {
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
  opportunity: OpportunityRow | null;
  customers: OpportunityCustomerRow[];
}

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────
function formatCurrency(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${Math.round(value)}`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const AVATAR_COLORS = ['var(--primary)', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash << 5) - hash + id.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getPersonaStyle(name: string): { bg: string; text: string } {
  const lower = (name || '').toLowerCase();
  if (lower.includes('luxury') || lower.includes('premium') || lower.includes('vip'))
    return { bg: '#F5F3FF', text: '#7C3AED' };
  if (lower.includes('trend') || lower.includes('fashion'))
    return { bg: '#EFF6FF', text: '#2563EB' };
  if (lower.includes('gift') || lower.includes('occasion') || lower.includes('seasonal'))
    return { bg: '#ECFDF5', text: '#059669' };
  if (lower.includes('discount') || lower.includes('deal'))
    return { bg: '#FEF3C7', text: '#D97706' };
  return { bg: '#F3F4F6', text: '#6B7280' };
}

const BAR_COLORS = ['var(--primary)', '#A78BFA', '#60A5FA', '#34D399', '#FBBF24', '#F87171'];

function getBarColor(i: number): string {
  return BAR_COLORS[i % BAR_COLORS.length];
}

function getPersonaFallbackDesc(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('luxury') || lower.includes('vip'))
    return 'High frequency purchases in premium segments with high brand loyalty.';
  if (lower.includes('trend'))
    return 'Early adopters of new arrivals with strong fashion consciousness.';
  if (lower.includes('gift') || lower.includes('occasion'))
    return 'Purchase primarily around holidays and special gifting occasions.';
  if (lower.includes('discount'))
    return 'Highly price-sensitive, responds strongly to promotional events.';
  if (lower.includes('dormant') || lower.includes('inactive'))
    return 'Previously high-value customers who have recently gone inactive.';
  return 'A distinct behavioral segment identified through purchase patterns.';
}

function buildJourney(c: OpportunityCustomerRow) {
  const daysAgo = c.days_since_last_order ?? 90;
  const cat = c.favorite_category || 'Item';
  const val = formatCurrency(
    c.avg_order_value || c.total_spent / Math.max(c.total_orders, 1),
  );
  const events = [{ days: daysAgo, label: `Purchased ${cat}`, sub: val }];
  if (daysAgo > 20) {
    events.push({
      days: Math.round(daysAgo * 0.4),
      label: 'Opened Summer Sale Email',
      sub: 'No conversion',
    });
  }
  events.push({
    days: Math.max(Math.round(daysAgo * 0.09), 5),
    label: 'Opened WhatsApp Campaign',
    sub: 'No purchase',
  });
  return events.sort((a, b) => b.days - a.days);
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export default function CustomerIntelligencePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const opportunityId = params.id;

  const [data, setData] = useState<OpportunityDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatQuery, setChatQuery] = useState('');
  const [selectedPersonaIdx, setSelectedPersonaIdx] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState<OpportunityCustomerRow | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await getOpportunityCustomers(opportunityId);
        if (!mounted) return;
        const loaded = res.data as OpportunityDetailResponse;
        setData(loaded);
        if (loaded.customers.length > 0) setSelectedCustomer(loaded.customers[0]);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load opportunity');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [opportunityId]);

  const opportunity = data?.opportunity ?? null;
  const customers = data?.customers ?? [];

  const personas = useMemo(() => {
    const map: Record<string, { count: number; totalSpent: number; description: string }> = {};
    customers.forEach((c) => {
      const name = c.persona_name || 'Unclassified';
      if (!map[name]) map[name] = { count: 0, totalSpent: 0, description: c.persona_description || '' };
      map[name].count += 1;
      map[name].totalSpent += c.total_spent;
    });
    return Object.entries(map)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, d]) => ({ name, ...d }));
  }, [customers]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 120px)' }}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading customer intelligence...</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error || !opportunity) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <button
          onClick={() => router.push(`/opportunities/${opportunityId}`)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Opportunity
        </button>
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error ?? 'Opportunity not found'}
        </div>
      </div>
    );
  }

  const audienceSize = opportunity.customer_count || opportunity.audience_size;
  const avgLtv = opportunity.average_spend || 0;
  const expectedRevenue = opportunity.potential_revenue * 0.14;
  const totalCustomers = customers.length || 1;

  const behavioralDrivers = [
    { iconBg: '#FEE2E2', icon: <Clock className="h-3.5 w-3.5 text-danger" />, label: 'Missed Purchase Cycle' },
    { iconBg: '#EEF2FF', icon: <Star className="h-3.5 w-3.5 text-primary" />, label: 'Luxury Category Affinity' },
    { iconBg: '#FEF3C7', icon: <CalendarDays className="h-3.5 w-3.5 text-warning" />, label: 'Seasonal Purchase Pattern' },
    { iconBg: '#F3F4F6', icon: <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />, label: 'Reduced Engagement' },
  ];

  const journey = selectedCustomer ? buildJourney(selectedCustomer) : [];

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 120px)' }}>

      {/* ── 3-Column Body ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ════ LEFT: Opportunity Summary ════ */}
        <div className="w-[25%] flex-shrink-0 overflow-y-auto border-r border-border bg-white p-5 pb-12">

          <h1 className="text-xl font-extrabold text-foreground leading-tight mb-5">
            {opportunity.title}
          </h1>

          {/* 4 Metric Cards */}
          <div className="grid grid-cols-2 gap-2.5 mb-5">
            <div className="rounded-xl border border-border bg-white p-3">
              <div className="text-2xs font-bold text-muted-foreground mb-1">Segment Value</div>
              <div className="text-lg font-extrabold text-foreground">{formatCurrency(opportunity.potential_revenue)}</div>
            </div>
            <div className="rounded-xl border border-border bg-white p-3">
              <div className="text-2xs font-bold text-muted-foreground mb-1">Avg. LTV</div>
              <div className="text-lg font-extrabold text-foreground">{formatCurrency(avgLtv)}</div>
            </div>
            <div className="rounded-xl border border-border bg-white p-3">
              <div className="text-2xs font-bold text-muted-foreground mb-1">Pred. Conversion</div>
              <div className="text-lg font-extrabold text-success">14%</div>
            </div>
            <div className="rounded-xl border border-border bg-white p-3">
              <div className="text-2xs font-bold text-muted-foreground mb-2">AI Confidence</div>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, Math.round(opportunity.confidence_score))}%` }}
                  />
                </div>
                <span className="text-2xs font-extrabold text-primary">
                  {Math.round(opportunity.confidence_score)}%
                </span>
              </div>
            </div>
          </div>

          {/* Why This Segment Matters */}
          <div className="rounded-xl bg-info-tint border border-[#BFDBFE] p-4 mb-5">
            <div className="text-2xs font-bold text-info mb-3">
              Why This Segment Matters
            </div>
            <div className="space-y-2.5">
              {[
                { label: 'Customer Value', value: formatCurrency(opportunity.potential_revenue) },
                { label: 'Pred. Conversion', value: '14%' },
                { label: 'Recovery Potential', value: 'Highest', purple: true },
                { label: 'Expected Revenue', value: formatCurrency(expectedRevenue) },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-2xs text-body">{row.label}</span>
                  <span className={`text-2xs font-bold ${row.purple ? 'text-primary' : 'text-foreground'}`}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Behavioral Drivers */}
          <div>
            <div className="text-2xs font-bold text-muted-foreground mb-3">
              Behavioral Drivers
            </div>
            <div className="space-y-3">
              {behavioralDrivers.map((d, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: d.iconBg }}
                  >
                    {d.icon}
                  </div>
                  <span className="text-xs text-body font-medium">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ════ MIDDLE: Customer Roster ════ */}
        <div className="w-[45%] flex-shrink-0 overflow-y-auto bg-brand-wash border-r border-border pb-36">

          {/* AI Discovered Personas */}
          <div className="px-5 pt-5 pb-4">
            <div className="text-2xs font-bold text-muted-foreground mb-3">
              AI Discovered Personas
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {personas.length > 0 ? (
                personas.map((p, i) => {
                  const isSelected = i === selectedPersonaIdx;
                  return (
                    <div
                      key={p.name}
                      onClick={() => setSelectedPersonaIdx(i)}
                      className="flex-shrink-0 w-[196px] rounded-2xl border-2 p-4 cursor-pointer transition-colors"
                      style={{
                        borderColor: isSelected ? 'var(--primary)' : '#E5E7EB',
                        backgroundColor: isSelected ? '#FAFAFE' : 'white',
                      }}
                    >
                      <div className="flex items-start justify-between mb-1.5">
                        <div className="text-label font-bold text-foreground leading-tight pr-2">{p.name}</div>
                        {isSelected && (
                          <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg aria-hidden viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="none">
                              <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="text-2xs font-bold text-muted-foreground mb-2">
                        {p.count} CUSTOMERS · {formatCurrency(p.totalSpent)} VALUE
                      </div>
                      <p className="text-2xs text-muted-foreground leading-relaxed line-clamp-2">
                        {p.description || getPersonaFallbackDesc(p.name)}
                      </p>
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-muted-foreground italic py-2">No personas discovered yet.</div>
              )}
            </div>
          </div>

          {/* Segment Composition */}
          {personas.length > 0 && (
            <div className="px-5 pb-5">
              <div className="text-2xs font-bold text-muted-foreground mb-2">
                Segment Composition
              </div>
              <div className="flex h-2 rounded-full overflow-hidden mb-2.5">
                {personas.map((p, i) => (
                  <div
                    key={p.name}
                    style={{
                      width: `${(p.count / totalCustomers) * 100}%`,
                      backgroundColor: getBarColor(i),
                    }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {personas.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: getBarColor(i) }} />
                    <span className="text-2xs text-muted-foreground">
                      {p.name} ({Math.round((p.count / totalCustomers) * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customer Roster */}
          <div className="px-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-2xs font-bold text-muted-foreground">Customer Roster</div>
              <div className="text-2xs text-muted-foreground">
                Showing {Math.min(customers.length, 6)} of {audienceSize}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {customers.slice(0, 6).map((c) => {
                const avatarColor = getAvatarColor(c.customer_id);
                const personaStyle = getPersonaStyle(c.persona_name || '');
                const isSelected = selectedCustomer?.customer_id === c.customer_id;
                return (
                  <button
                    key={c.customer_id}
                    onClick={() => setSelectedCustomer(c)}
                    className="rounded-2xl border-2 bg-white p-4 text-left transition-colors hover:shadow-sm"
                    style={{ borderColor: isSelected ? 'var(--primary)' : '#E5E7EB' }}
                  >
                    <div className="flex items-center gap-2.5 mb-3">
                      <div
                        className="h-9 w-9 rounded-full flex items-center justify-center text-label font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: isSelected ? 'var(--primary)' : avatarColor }}
                      >
                        {getInitials(c.customer_name)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-label font-bold text-foreground truncate">{c.customer_name}</div>
                        {c.persona_name && (
                          <div
                            className="text-2xs font-bold mt-0.5 truncate px-1.5 py-0.5 rounded-full inline-block"
                            style={{ backgroundColor: personaStyle.bg, color: personaStyle.text }}
                          >
                            {c.persona_name}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-2xs font-bold text-muted-foreground">LTV</div>
                        <div className="text-xs font-bold text-foreground mt-0.5">{formatCurrency(c.total_spent)}</div>
                      </div>
                      <div>
                        <div className="text-2xs font-bold text-muted-foreground">Last Purchase</div>
                        <div className="text-2xs font-semibold text-muted-foreground mt-0.5">
                          {c.days_since_last_order != null ? `${c.days_since_last_order} Days Ago` : 'Unknown'}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ════ RIGHT: Customer 360 ════ */}
        <div className="w-[30%] flex-shrink-0 overflow-y-auto bg-white border-l border-border pb-36">
          <div className="p-5">
            <div className="text-2xs font-bold text-muted-foreground mb-4">Customer 360</div>

            {selectedCustomer ? (
              <>
                {/* Avatar + Name */}
                <div className="flex flex-col items-center text-center mb-5">
                  <div
                    className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-extrabold text-white mb-3 ring-4 ring-brand-tint"
                    style={{ backgroundColor: getAvatarColor(selectedCustomer.customer_id) }}
                  >
                    {getInitials(selectedCustomer.customer_name)}
                  </div>
                  <div className="text-lg font-extrabold text-foreground">{selectedCustomer.customer_name}</div>
                  <div className="text-2xs text-muted-foreground mt-0.5">Mumbai, India · Member since 2021</div>
                </div>

                {/* Why This Segment Matters */}
                <div className="rounded-xl bg-brand-wash border border-border p-4 mb-4">
                  <div className="text-2xs font-bold text-muted-foreground mb-3">
                    Why This Segment Matters
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { label: 'Customer Value', value: formatCurrency(selectedCustomer.total_spent) },
                      { label: 'Pred. Conversion', value: '14%' },
                      { label: 'Recovery Potential', value: 'Highest', purple: true },
                      { label: 'Expected Revenue', value: formatCurrency(selectedCustomer.avg_order_value * 0.14) },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between">
                        <span className="text-2xs text-muted-foreground">{row.label}</span>
                        <span className={`text-2xs font-bold ${row.purple ? 'text-primary' : 'text-foreground'}`}>
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preferred Channel + Top Categories */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-xl border border-border bg-white p-3">
                    <div className="text-2xs font-bold text-muted-foreground mb-2">
                      Preferred Channel
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MessageCircle className="h-3.5 w-3.5 text-success" />
                      <span className="text-xs font-bold text-foreground">
                        {selectedCustomer.preferred_channel || 'WhatsApp'}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-white p-3">
                    <div className="text-2xs font-bold text-muted-foreground mb-2">
                      Top Categories
                    </div>
                    <div className="text-xs font-bold text-foreground truncate">
                      {[selectedCustomer.favorite_category, selectedCustomer.second_favorite_category]
                        .filter(Boolean)
                        .join(', ') || 'Dresses, Acc.'}
                    </div>
                  </div>
                </div>

                {/* Predicted Next Purchase */}
                <div className="rounded-xl border border-border bg-white p-3 mb-4">
                  <div className="text-2xs font-bold text-muted-foreground mb-1">
                    Predicted Next Purchase
                  </div>
                  <div className="text-label font-bold text-foreground">
                    {selectedCustomer.favorite_category
                      ? `Premium ${selectedCustomer.favorite_category}`
                      : 'Premium Handbag'}
                  </div>
                </div>

                {/* Customer Journey */}
                <div className="mb-4">
                  <div className="text-2xs font-bold text-muted-foreground mb-3">
                    Customer Journey
                  </div>
                  <div>
                    {journey.map((event, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="flex flex-col items-center flex-shrink-0 mt-0.5">
                          <div className="h-5 w-5 rounded-full bg-brand-tint border-2 border-primary flex items-center justify-center">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          </div>
                          {i < journey.length - 1 && <div className="w-0.5 h-7 bg-border" />}
                        </div>
                        <div className="pb-2">
                          <div className="text-2xs font-bold text-muted-foreground">{event.days} Days Ago</div>
                          <div className="text-xs font-semibold text-foreground">{event.label}</div>
                          <div className="text-2xs text-muted-foreground">{event.sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Insight */}
                <div
                  className="rounded-xl p-4"
                  style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #7C3AED 100%)' }}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-white/80" />
                    <span className="text-2xs font-bold text-white/80">AI Insight</span>
                  </div>
                  <p className="text-xs text-white leading-relaxed">
                    Responds best to urgency-driven WhatsApp campaigns. High likelihood of conversion
                    with limited-time offers in their preferred category.
                  </p>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <AiOrb size="md" state="breathing" className="mb-3" />
                <p className="text-sm text-muted-foreground">Select a customer to view their 360° profile</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ════ FLOATING ACTION BAR ════ */}
      <div className="fixed bottom-6 z-50" style={{ left: '25%', right: 0 }}>
        <div className="max-w-2xl mx-auto px-6">
          <div className="bg-white rounded-2xl border border-border shadow-xl shadow-black/10 p-3">
            {/* AI Input + Quick Chips */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 flex items-center gap-2 bg-brand-wash rounded-xl px-3 py-2 border border-border focus-within:border-primary/40 transition-colors">
                <AiOrb size="sm" state="listening" className="flex-shrink-0" />
                <input
                  type="text"
                  value={chatQuery}
                  onChange={(e) => setChatQuery(e.target.value)}
                  placeholder="Ask AI about this audience..."
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
                {chatQuery && (
                  <button className="h-6 w-6 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
                    <Send className="h-3 w-3 text-white ml-0.5" />
                  </button>
                )}
              </div>
              {['Show churn risk', 'Draft SMS'].map((chip) => (
                <button
                  key={chip}
                  onClick={() => setChatQuery(chip)}
                  className="flex-shrink-0 bg-white border border-border text-body text-2xs font-semibold px-3 py-2 rounded-xl hover:border-primary/40 hover:text-primary transition-colors whitespace-nowrap"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Primary Actions */}
            <div className="flex items-center gap-3">
              <Link
                href={`/opportunities/${opportunityId}/campaign`}
                className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl py-2.5 transition-colors"
              >
                Review Recommended Campaign
              </Link>
              <button className="flex items-center gap-1.5 border border-border text-body text-xs font-bold px-4 py-2.5 rounded-xl hover:border-muted-foreground transition-colors whitespace-nowrap">
                <Download className="h-3.5 w-3.5" />
                Export Segment
              </button>
              <button className="flex items-center gap-1.5 border border-border text-body text-xs font-bold px-4 py-2.5 rounded-xl hover:border-primary/40 hover:text-primary transition-colors whitespace-nowrap">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Ask AI
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
