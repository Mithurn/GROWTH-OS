'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BarChart2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Gem,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { getOpportunityCustomers, refineOpportunity } from '@/lib/api';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface AltStrategy {
  title: string;
  conversion_rate: number;
  note: string;
}

interface OpportunityPersona {
  name: string;
  description: string;
}

interface Opportunity {
  opportunity_id: string;
  title: string;
  description: string;
  opportunity_type: string;
  audience_size: number;
  potential_revenue: number;
  confidence_score: number;
  priority_score: number;
  supporting_customer_segment: string;
  recommended_action: string;
  audience_definition: Record<string, unknown>;
  trigger_reason: string;
  ai_summary: string;
  predicted_conversion_rate?: number | null;
  alternative_strategies?: AltStrategy[] | null;
  opportunity_personas?: OpportunityPersona[] | null;
  status: string;
  customer_count: number;
  average_spend: number;
  average_orders: number;
}

interface Customer {
  customer_id: string;
  customer_name: string;
  total_spent: number;
  total_orders: number;
  avg_order_value: number;
  last_order_date: string | null;
  days_since_last_order: number | null;
  favorite_category: string | null;
  preferred_channel: string | null;
  discount_affinity: string | null;
  persona_name: string | null;
  persona_description: string | null;
}

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────
const formatCurrency = (amount: number) => {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(0)}K`;
  return `₹${Math.round(amount)}`;
};

const parseChannel = (action: string): string => {
  if (!action) return 'WhatsApp';
  const a = action.toLowerCase();
  if (a.includes('whatsapp')) return 'WhatsApp';
  if (a.includes('email')) return 'Email';
  if (a.includes('sms')) return 'SMS';
  return 'WhatsApp';
};

const parseSignals = (triggerReason: string): string[] => {
  if (!triggerReason) return [];
  return triggerReason
    .split(/[.;]/)
    .map(s => s.trim())
    .filter(s => s.length > 10)
    .slice(0, 4);
};

const SIGNAL_ICONS = [Clock, TrendingUp, TrendingDown, Calendar];

function useTypewriter(text: string, speed = 18) {
  const [displayed, setDisplayed] = useState('');
  const prev = useRef('');
  useEffect(() => {
    if (!text || text === prev.current) return;
    prev.current = text;
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

const MODIFIER_CHIPS = [
  'Focus only on VIP customers',
  'Increase projected revenue',
  'Use Email instead',
];

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export default function OpportunityDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<{ opportunity: Opportunity | null; customers: Customer[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modifier, setModifier] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const res = await getOpportunityCustomers(params.id);
        if (!mounted) return;
        setData(res.data);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : 'Failed to load opportunity');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [params.id]);

  const opp = data?.opportunity ?? null;
  const customers = data?.customers ?? [];
  const whySummary = opp ? (opp.ai_summary || opp.description) : '';
  const typedSummary = useTypewriter(whySummary);

  const personas = useMemo(() => {
    if (opp?.opportunity_personas && opp.opportunity_personas.length > 0) {
      return opp.opportunity_personas.slice(0, 3).map(p => ({ name: p.name, description: p.description, count: null as number | null }));
    }
    const map = new Map<string, { name: string; description: string; count: number }>();
    customers.forEach(c => {
      if (!c.persona_name) return;
      if (!map.has(c.persona_name)) {
        map.set(c.persona_name, { name: c.persona_name, description: c.persona_description ?? '', count: 0 });
      }
      map.get(c.persona_name)!.count++;
    });
    return Array.from(map.values()).slice(0, 3);
  }, [customers, opp?.opportunity_personas]);

  async function handleRefine(text?: string) {
    const query = (text ?? modifier).trim();
    if (!query || !opp || isRefining) return;
    setIsRefining(true);
    try {
      const res = await refineOpportunity(opp.opportunity_id, query);
      if (res.data) {
        setData(prev => prev ? {
          ...prev,
          opportunity: prev.opportunity ? { ...prev.opportunity, ...res.data } : null,
        } : null);
      }
      setModifier('');
    } catch (e) {
      console.error('[refine]', e);
    } finally {
      setIsRefining(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA]">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
          Loading opportunity…
        </div>
      </div>
    );
  }

  if (error || !opp) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] p-8">
        <button onClick={() => router.push('/opportunities')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Opportunities
        </button>
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error ?? 'Opportunity not found'}
        </div>
      </div>
    );
  }

  const channel = parseChannel(opp.recommended_action);
  const signals = parseSignals(opp.trigger_reason);
  const audienceCount = opp.customer_count || opp.audience_size;
  const voucherAmount = opp.average_spend ? Math.round(opp.average_spend * 0.05 / 50) * 50 : 500;

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-28">
      <div className="max-w-6xl mx-auto px-6 py-6">

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push('/opportunities')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Opportunities
          </button>
          <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 rounded-full border border-indigo-200">
            Ready For Action
          </span>
        </div>

        {/* ── Title ── */}
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-6">{opp.title}</h1>

        {/* ── Stat pills ── */}
        <div className="flex items-center gap-3 flex-wrap mb-8">
          <StatPill icon={BarChart2} label={`${formatCurrency(opp.potential_revenue)} Potential Revenue`} />
          <StatPill icon={Users} label={`${audienceCount} Customers`} />
          <StatPill icon={Zap} label={`Recommended: ${channel}`} />
        </div>

        {/* ── Why Xeno Found This ── */}
        <div className="mb-8">
          <div className="flex items-center gap-1.5 mb-3">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-500">Why Xeno Found This</span>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed max-w-3xl min-h-[3rem]">
            {typedSummary}
            {typedSummary.length < whySummary.length && (
              <span className="inline-block w-0.5 h-3.5 bg-indigo-400 ml-0.5 animate-pulse align-middle" />
            )}
            {typedSummary === whySummary && opp.potential_revenue > 0 && (
              <> The estimated recovery value of this audience is{' '}
                <span className="font-bold text-indigo-600">{formatCurrency(opp.potential_revenue)}</span>.
              </>
            )}
          </p>
        </div>

        {/* ── 2-column layout ── */}
        <div className="grid grid-cols-3 gap-6">

          {/* ── LEFT: 2/3 width ── */}
          <div className="col-span-2 space-y-6">

            {/* Audience Intel + Key Signals */}
            <div className="grid grid-cols-2 gap-5">

              {/* Audience Intelligence */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Audience Intelligence</h3>
                <div className="space-y-3">
                  <AudienceRow label="Segment" value={opp.supporting_customer_segment || 'Dormant VIPs'} />
                  <AudienceRow label="Avg. LTV" value={opp.average_spend ? formatCurrency(opp.average_spend) : '—'} />
                  <AudienceRow
                    label="Last Purchase"
                    value={
                      opp.audience_definition?.max_days_since_last_order
                        ? `${opp.audience_definition.max_days_since_last_order} Days Ago`
                        : '60+ Days Ago'
                    }
                  />
                  <AudienceRow label="Predicted Conv." value={opp.predicted_conversion_rate != null ? `${opp.predicted_conversion_rate}%` : '—'} />
                </div>
                <button
                  onClick={() => customers.length > 0 && setSelectedCustomer(customers[0])}
                  className="mt-4 text-xs font-semibold text-indigo-500 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                >
                  View Customer Intelligence <ChevronRight className="h-3 w-3" />
                </button>
              </div>

              {/* Key Customer Signals */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Key Customer Signals</h3>
                <div className="space-y-3">
                  {(signals.length > 0 ? signals : [
                    `Purchase inactivity > 60 days`,
                    `Lifetime value above ${formatCurrency(opp.average_spend * 3 || 12000)}`,
                    'Declining overall engagement',
                    'Missed seasonal purchase cycle',
                  ]).map((signal, i) => {
                    const Icon = SIGNAL_ICONS[i % SIGNAL_ICONS.length];
                    return (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className="mt-0.5 h-5 w-5 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                          <Icon className="h-3 w-3 text-indigo-500" />
                        </div>
                        <span className="text-sm text-gray-600 leading-snug">{signal}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Personas Discovered */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-3">Personas Discovered</h3>
              <div className="grid grid-cols-3 gap-4">
                {personas.map((p, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-bold text-gray-900 leading-snug">{p.name}</span>
                      {p.count != null && (
                        <span className="ml-2 shrink-0 text-xs font-bold text-indigo-500 bg-indigo-50 rounded-full px-2 py-0.5">{p.count}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{p.description}</p>
                  </div>
                ))}
              </div>

            </div>
          </div>

          {/* ── RIGHT sidebar: 1/3 width ── */}
          <div className="col-span-1 space-y-4">

            {/* Recommended Play */}
            <div className="bg-white rounded-xl border-2 border-indigo-300 p-5 shadow-md hover:shadow-indigo-200 hover:shadow-lg hover:border-indigo-500 transition-all duration-300" style={{ boxShadow: '0 4px 24px 0 rgba(99,102,241,0.10)' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Recommended Play</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">
                {opp.title.toLowerCase().includes('recovery') || opp.title.toLowerCase().includes('dormant')
                  ? 'Win-Back Campaign'
                  : opp.title.toLowerCase().includes('loyalty')
                  ? 'Loyalty Upsell'
                  : 'Targeted Campaign'}
              </h3>

              {/* Channel badge */}
              <div className="flex items-center gap-1.5 mb-4">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-semibold text-gray-600">{channel} Channel</span>
              </div>

              {/* Stats table */}
              <div className="space-y-2.5 mb-4">
                <PlayRow label="Offer Core" value={`₹${voucherAmount} Voucher`} />
                <PlayRow label="Expected Conv." value={opp.predicted_conversion_rate != null ? `${opp.predicted_conversion_rate}%` : '—'} />
                <PlayRow label="Est. Revenue" value={formatCurrency(opp.potential_revenue)} accent />
              </div>

              {/* AI quote */}
              <p className="text-xs text-gray-400 italic leading-relaxed mb-5 border-l-2 border-indigo-100 pl-3">
                "Historically this audience responds best to urgency-driven {channel} campaigns with limited-time incentives."
              </p>

              <button
                onClick={() => router.push(`/campaigns?opportunityId=${opp.opportunity_id}`)}
                className="w-full bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all duration-200"
                style={{ boxShadow: '0 4px 16px 0 rgba(99,102,241,0.4)' }}
              >
                Review Campaign <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Alternative Strategies */}
            {opp.alternative_strategies && opp.alternative_strategies.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center gap-1.5 mb-3">
                  <BarChart2 className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Alternative Strategies</span>
                </div>
                <div className="space-y-3">
                  {opp.alternative_strategies.map((alt, i) => (
                    <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-gray-800">{alt.title}</span>
                        <span className="text-xs font-bold text-gray-500">{alt.conversion_rate}%</span>
                      </div>
                      <p className="text-[11px] text-gray-400 leading-relaxed">{alt.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Floating bottom modifier bar ── */}
      <div className="fixed bottom-6 left-0 right-0 z-40 pointer-events-none">
        <div className="max-w-2xl mx-auto px-6 pointer-events-auto">
          {/* Suggestion chips */}
          <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
            {MODIFIER_CHIPS.map(chip => (
              <button
                key={chip}
                onClick={() => handleRefine(chip)}
                disabled={isRefining}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-full shadow-sm hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-40 transition-all"
              >
                {chip}
              </button>
            ))}
          </div>
          {/* Floating input */}
          <div className={`flex items-center gap-3 bg-white border rounded-2xl px-5 py-3.5 shadow-xl transition-all ${isRefining ? 'border-indigo-300 opacity-80' : 'border-gray-200 focus-within:border-indigo-400'}`}>
            {isRefining
              ? <Loader2 className="h-4 w-4 text-indigo-400 shrink-0 animate-spin" />
              : <Sparkles className="h-4 w-4 text-indigo-400 shrink-0" />}
            <input
              value={modifier}
              onChange={e => setModifier(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRefine()}
              disabled={isRefining}
              placeholder={isRefining ? 'AI is refining your strategy…' : 'How would you like to modify this opportunity?'}
              className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none disabled:cursor-not-allowed"
            />
            <button
              onClick={() => handleRefine()}
              disabled={!modifier.trim() || isRefining}
              className="h-8 w-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center disabled:opacity-30 transition-all shrink-0"
            >
              {isRefining
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Customer drawer ── */}
      {selectedCustomer && (
        <CustomerDrawer customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────
function StatPill({ icon: Icon, label, accent }: { icon: React.ElementType; label: string; accent?: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium shadow-sm ${
      accent
        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
        : 'bg-white border-gray-200 text-gray-700'
    }`}>
      <Icon className={`h-4 w-4 ${accent ? 'text-indigo-500' : 'text-gray-400'}`} />
      {label}
    </div>
  );
}

function AudienceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function PlayRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className={`font-bold ${accent ? 'text-indigo-600' : 'text-gray-900'}`}>{value}</span>
    </div>
  );
}


function CustomerDrawer({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const formatCurr = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;
  return (
    <div className="fixed inset-0 z-50">
      <button className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl overflow-y-auto p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-3">
              <Gem className="h-5 w-5 text-indigo-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">{customer.customer_name}</h2>
            <p className="text-sm text-indigo-500 font-medium">{customer.persona_name ?? 'Premium Customer'}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: 'Lifetime Spend', value: formatCurr(customer.total_spent) },
            { label: 'Orders', value: String(customer.total_orders) },
            { label: 'Last Purchase', value: customer.days_since_last_order != null ? `${customer.days_since_last_order}d ago` : '—' },
            { label: 'Avg Order', value: formatCurr(customer.avg_order_value) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{label}</p>
              <p className="text-base font-bold text-gray-900">{value}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-gray-200 p-4 space-y-3">
          {[
            { label: 'Favorite Category', value: customer.favorite_category ?? '—' },
            { label: 'Preferred Channel', value: customer.preferred_channel ?? 'WhatsApp' },
            { label: 'Discount Affinity', value: customer.discount_affinity ?? 'Low' },
            { label: 'Churn Risk', value: (customer.days_since_last_order ?? 0) > 90 ? 'High' : 'Medium' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="text-gray-400">{label}</span>
              <span className="font-semibold text-gray-900">{value}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
