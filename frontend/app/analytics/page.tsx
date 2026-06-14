'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  AlertTriangle, ArrowLeft, Brain, Clock, Loader2,
  Mail, MailOpen, MessageSquare, MousePointerClick,
  Send, ShoppingCart, Smartphone, Sparkles, Target,
  TrendingUp, Users, Zap,
} from 'lucide-react';

// ─── Config ──────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://xeno-crm-backend-n6d8.onrender.com/api';
const PERSONA_COLORS = ['#6366F1', '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B'];
const LEARNING_ICONS = [Brain, Clock, ShoppingCart];

// ─── Types ───────────────────────────────────────────────────────────────────

interface Funnel {
  targeted: number;
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
  failed: number;
}

interface PersonaBreakdown {
  persona_name: string;
  count: number;
  percentage: number;
}

interface TimelinePoint {
  hour: number;
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
}

interface NextAction {
  title: string;
  description: string;
  potentialRevenue: number;
  confidence: number;
}

interface CampaignAnalyticsData {
  campaign: {
    id: string;
    name: string;
    objective: string;
    channel: string;
    status: string;
    reasoning: string;
    launched_at: string | null;
    opportunity_title: string;
    potential_revenue: number;
    confidence_score: number;
  };
  funnel: Funnel;
  personaBreakdown: PersonaBreakdown[];
  timeline: TimelinePoint[];
  insights: {
    learnings: string[];
    nextAction: NextAction;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRevenue(v: number): string {
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${Math.round(v)}`;
}

function dropPct(from: number, to: number): string {
  if (!from) return '';
  const d = Math.round((1 - to / from) * 100);
  return d > 0 ? `-${d}%` : '—';
}

function channelIcon(channel: string) {
  if (channel === 'WhatsApp') return { Icon: MessageSquare, color: '#10B981' };
  if (channel === 'Email') return { Icon: Mail, color: '#3B82F6' };
  return { Icon: Smartphone, color: '#8B5CF6' };
}

// ─── Primitive components ─────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[#1E2545] bg-[#141929] p-6 ${className}`}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B92A5] mb-4">{children}</p>;
}

function StatusBadge({ status }: { status: string }) {
  const live = status === 'Launched';
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${
      live ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-[#1E2545] text-[#8B92A5] border-[#1E2545]'
    }`}>
      {live && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
      {status}
    </span>
  );
}

// ─── Section 1: Campaign Summary ──────────────────────────────────────────────

function CampaignSummaryCard({ campaign, funnel }: { campaign: CampaignAnalyticsData['campaign']; funnel: Funnel }) {
  const targeted = funnel.targeted || 1;
  const revenue = funnel.clicked * (campaign.potential_revenue / targeted);
  const convRate = ((funnel.clicked / targeted) * 100).toFixed(1);
  const roi = revenue > 0 ? (revenue / (targeted * 10)).toFixed(1) : '—';

  return (
    <Card>
      <SectionLabel>Campaign Summary</SectionLabel>
      <div className="flex items-start justify-between mb-2">
        <h2 className="text-base font-bold text-white leading-snug pr-3">{campaign.name}</h2>
        <StatusBadge status={campaign.status} />
      </div>
      <p className="text-[#8B92A5] text-xs mb-5 line-clamp-2">{campaign.objective}</p>
      <div className="text-3xl font-extrabold text-white mb-0.5">{formatRevenue(revenue)}</div>
      <p className="text-[10px] text-[#4B5069] uppercase tracking-widest mb-5">Estimated Revenue</p>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Orders', value: funnel.clicked },
          { label: 'Conv Rate', value: `${convRate}%` },
          { label: 'ROI', value: `${roi}x` },
        ].map(s => (
          <div key={s.label} className="rounded-xl bg-[#0A0E1A] border border-[#1E2545] p-3 text-center">
            <div className="text-base font-bold text-white">{s.value}</div>
            <div className="text-[10px] text-[#4B5069] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Section 1: Conversion Funnel ────────────────────────────────────────────

function ConversionFunnelCard({ funnel }: { funnel: Funnel }) {
  const rows = [
    { icon: Users, label: 'Targeted', count: funnel.targeted, from: null },
    { icon: Send, label: 'Delivered', count: funnel.delivered, from: funnel.targeted },
    { icon: MailOpen, label: 'Opened', count: funnel.read, from: funnel.delivered },
    { icon: MousePointerClick, label: 'Clicked', count: funnel.clicked, from: funnel.read },
    { icon: AlertTriangle, label: 'Failed', count: funnel.failed, from: null, red: true },
  ];

  return (
    <Card>
      <SectionLabel>Conversion Funnel</SectionLabel>
      {funnel.targeted === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Zap className="h-6 w-6 text-indigo-400 animate-pulse" />
          <p className="text-[#8B92A5] text-sm text-center">No communications yet.<br />Campaign may still be processing.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(({ icon: Icon, label, count, from, red }) => (
            <div key={label} className="flex items-center gap-3">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border ${
                red ? 'bg-red-500/10 border-red-500/20' : 'bg-[#0A0E1A] border-[#1E2545]'
              }`}>
                <Icon className={`h-3.5 w-3.5 ${red ? 'text-red-400' : 'text-[#8B92A5]'}`} />
              </div>
              <span className="text-sm text-[#8B92A5] flex-1">{label}</span>
              <span className={`rounded-lg px-3 py-1 text-sm font-bold ${
                red ? 'bg-red-500/10 text-red-400' : 'bg-[#1E2545] text-white'
              }`}>{count}</span>
              {from !== null ? (
                <span className="text-[10px] text-red-400 w-10 text-right shrink-0">{dropPct(from, count)}</span>
              ) : (
                <span className="w-10" />
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Section 1: Event Timeline ────────────────────────────────────────────────

function TimelineCard({ timeline, isLive }: { timeline: TimelinePoint[]; isLive: boolean }) {
  const chartData = timeline.map(t => ({ ...t, label: `H${t.hour}` }));
  const empty = timeline.length === 0;

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <SectionLabel>Event Timeline</SectionLabel>
        {isLive && (
          <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
        )}
      </div>
      {empty ? (
        <div className="flex flex-col items-center justify-center h-36 gap-3">
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <p className="text-[#4B5069] text-xs">Waiting for events…</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
            <defs>
              {[
                { id: 'gDelivered', color: '#10B981' },
                { id: 'gRead', color: '#3B82F6' },
                { id: 'gClicked', color: '#6366F1' },
              ].map(g => (
                <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={g.color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={g.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E2545" />
            <XAxis dataKey="label" tick={{ fill: '#4B5069', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ backgroundColor: '#141929', border: '1px solid #1E2545', borderRadius: '8px', color: '#fff', fontSize: 11 }}
            />
            <Area type="monotone" dataKey="delivered" stroke="#10B981" strokeWidth={2} fill="url(#gDelivered)" dot={false} name="Delivered" />
            <Area type="monotone" dataKey="read" stroke="#3B82F6" strokeWidth={2} fill="url(#gRead)" dot={false} name="Opened" />
            <Area type="monotone" dataKey="clicked" stroke="#6366F1" strokeWidth={2} fill="url(#gClicked)" dot={false} name="Clicked" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

// ─── Section 2: Channel Card ──────────────────────────────────────────────────

function ChannelCard({ campaign, funnel }: { campaign: CampaignAnalyticsData['campaign']; funnel: Funnel }) {
  const { Icon, color } = channelIcon(campaign.channel);
  const targeted = funnel.targeted || 1;
  const deliveryRate = Math.round((funnel.delivered / targeted) * 100);
  const openRate = funnel.delivered > 0 ? Math.round((funnel.read / funnel.delivered) * 100) : 0;
  const clickRate = funnel.read > 0 ? Math.round((funnel.clicked / funnel.read) * 100) : 0;

  return (
    <Card>
      <SectionLabel>Channel Performance</SectionLabel>
      <div className="flex flex-col items-center justify-center py-4 mb-5">
        <div className="h-16 w-16 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: `${color}15`, border: `1px solid ${color}30` }}>
          <Icon className="h-8 w-8" style={{ color }} />
        </div>
        <span className="text-white font-bold text-base">{campaign.channel}</span>
      </div>
      <div className="space-y-3">
        {[
          { label: 'Delivery Rate', value: `${deliveryRate}%`, color: '#10B981' },
          { label: 'Open Rate', value: `${openRate}%`, color: '#3B82F6' },
          { label: 'Click Rate', value: `${clickRate}%`, color: '#6366F1' },
        ].map(s => (
          <div key={s.label} className="flex items-center justify-between">
            <span className="text-sm text-[#8B92A5]">{s.label}</span>
            <span className="text-sm font-bold" style={{ color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Section 2: Persona Pie ───────────────────────────────────────────────────

function PersonaPieCard({ personas }: { personas: PersonaBreakdown[] }) {
  const total = personas.reduce((s, p) => s + p.count, 0);

  return (
    <Card>
      <SectionLabel>Audience Persona Mix</SectionLabel>
      {personas.length === 0 ? (
        <p className="text-[#4B5069] text-sm text-center py-8">No persona data yet.</p>
      ) : (
        <>
          <div className="relative flex items-center justify-center mb-4">
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie data={personas} dataKey="count" nameKey="persona_name" innerRadius={45} outerRadius={65} cx="50%" cy="50%">
                  {personas.map((_, i) => <Cell key={i} fill={PERSONA_COLORS[i % PERSONA_COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#141929', border: '1px solid #1E2545', borderRadius: '8px', color: '#fff', fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-extrabold text-white">{total}</span>
              <span className="text-[10px] text-[#4B5069]">Total</span>
            </div>
          </div>
          <div className="space-y-2">
            {personas.slice(0, 4).map((p, i) => (
              <div key={p.persona_name} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: PERSONA_COLORS[i % PERSONA_COLORS.length] }} />
                <span className="text-[#8B92A5] flex-1 truncate">{p.persona_name}</span>
                <span className="text-white font-semibold">{p.count}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

// ─── Section 2: Persona Bars ──────────────────────────────────────────────────

function PersonaBarsCard({ personas }: { personas: PersonaBreakdown[] }) {
  const maxCount = Math.max(...personas.map(p => p.count), 1);

  return (
    <Card>
      <SectionLabel>Persona Performance</SectionLabel>
      {personas.length === 0 ? (
        <p className="text-[#4B5069] text-sm text-center py-8">No persona data yet.</p>
      ) : (
        <div className="space-y-4">
          {personas.map((p, i) => (
            <div key={p.persona_name}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-[#8B92A5] truncate pr-2">{p.persona_name}</span>
                <span className="text-xs font-bold text-white shrink-0">{p.count}</span>
              </div>
              <div className="h-1.5 w-full bg-[#1E2545] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(p.count / maxCount) * 100}%`,
                    background: `linear-gradient(90deg, ${PERSONA_COLORS[i % PERSONA_COLORS.length]}, ${PERSONA_COLORS[(i + 1) % PERSONA_COLORS.length]})`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Campaign Selector ────────────────────────────────────────────────────────

function CampaignSelector({ campaigns, onSelect }: { campaigns: any[]; onSelect: (id: string) => void }) {
  const launched = campaigns.filter(c => c.status === 'Launched' || c.status === 'Completed');

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white flex flex-col items-center justify-center px-6 py-12">
      <Sparkles className="h-8 w-8 text-indigo-400 mb-4" />
      <h2 className="text-2xl font-extrabold mb-1">Campaign Analytics</h2>
      <p className="text-[#8B92A5] text-sm mb-8">Select a launched campaign to view its performance</p>
      <div className="w-full max-w-md space-y-3">
        {launched.map(c => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className="w-full rounded-2xl border border-[#1E2545] bg-[#141929] hover:border-indigo-500/50 hover:bg-[#1A1F35] p-5 text-left transition-all"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-white text-sm">{c.name}</span>
              <StatusBadge status={c.status} />
            </div>
            <span className="text-[#4B5069] text-xs">{c.channel} · {c.audience_size ?? 0} customers</span>
          </button>
        ))}
        {launched.length === 0 && (
          <p className="text-center text-[#4B5069] text-sm py-8">No launched campaigns yet. Launch one from Opportunities.</p>
        )}
      </div>
    </div>
  );
}

// ─── Main page content ────────────────────────────────────────────────────────

function AnalyticsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get('campaignId');

  const [data, setData] = useState<CampaignAnalyticsData | null>(null);
  const [allCampaigns, setAllCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiInput, setAiInput] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAnalytics = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/campaigns/${id}/analytics`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) setData(json.data);
      else throw new Error(json.error || 'API error');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!campaignId) {
      const cid = window.localStorage.getItem('xeno_company_id') ?? '';
      fetch(`${API_BASE}/campaigns?companyId=${cid}`)
        .then(r => r.json())
        .then(j => { if (j.success) setAllCampaigns(j.data ?? []); })
        .catch(() => {})
        .finally(() => setLoading(false));
      return;
    }
    fetchAnalytics(campaignId);
  }, [campaignId, fetchAnalytics]);

  useEffect(() => {
    if (!campaignId || data?.campaign.status !== 'Launched') return;
    intervalRef.current = setInterval(() => fetchAnalytics(campaignId), 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [campaignId, data?.campaign.status, fetchAnalytics]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!campaignId) {
    return <CampaignSelector campaigns={allCampaigns} onSelect={id => router.push(`/analytics?campaignId=${id}`)} />;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex flex-col items-center justify-center gap-4 px-6">
        <div className="rounded-2xl border border-red-500/20 bg-[#141929] p-8 max-w-md w-full text-center">
          <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <h2 className="text-white font-bold mb-2">Failed to load analytics</h2>
          <p className="text-red-400 text-sm mb-5">{error}</p>
          <button onClick={() => { setError(null); setLoading(true); fetchAnalytics(campaignId!); }}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { campaign, funnel, personaBreakdown, timeline, insights } = data;
  const isLive = campaign.status === 'Launched';

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-24">
      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[#8B92A5] mb-5">
          <button onClick={() => router.push('/analytics')} className="hover:text-white transition-colors">Analytics</button>
          <span>/</span>
          <span>Campaigns</span>
          <span>/</span>
          <span className="text-white font-medium truncate max-w-xs">{campaign.name}</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">{campaign.name}</h1>
            <p className="text-[#8B92A5] text-sm mt-0.5">{campaign.channel} · {funnel.targeted} customers targeted</p>
          </div>
          <button onClick={() => router.push('/opportunities')}
            className="flex items-center gap-1.5 text-sm text-[#8B92A5] hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" /> Opportunities
          </button>
        </div>

        {/* Empty state — no comms yet */}
        {funnel.targeted === 0 && (
          <div className="mb-6 rounded-2xl border border-indigo-500/20 bg-[#141929] p-6 text-center">
            <Zap className="h-6 w-6 text-indigo-400 mx-auto mb-2 animate-pulse" />
            <p className="text-[#8B92A5] text-sm">No communications yet. Campaign may still be processing.</p>
          </div>
        )}

        {/* Section 1: Top row */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          <CampaignSummaryCard campaign={campaign} funnel={funnel} />
          <ConversionFunnelCard funnel={funnel} />
          <TimelineCard timeline={timeline} isLive={isLive} />
        </div>

        {/* Section 2: Middle row */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          <ChannelCard campaign={campaign} funnel={funnel} />
          <PersonaPieCard personas={personaBreakdown} />
          <PersonaBarsCard personas={personaBreakdown} />
        </div>

        {/* Section 3: Intelligence Learnings */}
        {insights.learnings.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#8B92A5]">Intelligence Learnings</span>
            </div>
            <div className="grid grid-cols-3 gap-6">
              {insights.learnings.slice(0, 3).map((learning, i) => {
                const Icon = LEARNING_ICONS[i % LEARNING_ICONS.length];
                return (
                  <div key={i} className="rounded-2xl bg-[#141929] p-5" style={{ border: '1px solid #1E2545', borderLeft: '2px solid #6366F1' }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-indigo-400" />
                      </div>
                    </div>
                    <p className="text-[#8B92A5] text-xs leading-relaxed">{learning}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 4: AI-detected next action */}
        {insights.nextAction?.title && (
          <div
            className="rounded-2xl p-6 shadow-lg shadow-indigo-500/10"
            style={{ border: '1px solid rgba(99,102,241,0.3)', background: 'linear-gradient(135deg, #141929 0%, #1A1040 100%)' }}
          >
            <div className="flex items-center justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-3">
                  <Zap className="h-3 w-3 text-indigo-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">AI-Detected Next Action</span>
                </div>
                <h3 className="text-xl font-extrabold text-white mb-2">{insights.nextAction.title}</h3>
                <p className="text-[#8B92A5] text-sm max-w-lg leading-relaxed">{insights.nextAction.description}</p>
              </div>
              <div className="flex flex-col items-end gap-4 shrink-0">
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-white">{formatRevenue(insights.nextAction.potentialRevenue)}</div>
                  <div className="text-[10px] text-[#4B5069] uppercase tracking-widest">Potential Revenue</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-emerald-400">{insights.nextAction.confidence}%</div>
                  <div className="text-[10px] text-[#4B5069] uppercase tracking-widest">Confidence</div>
                </div>
                <button onClick={() => router.push('/opportunities')}
                  className="bg-[#10B981] hover:bg-emerald-600 text-white font-bold rounded-xl px-5 py-2.5 text-sm transition-colors">
                  Create Campaign →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0F1225] border-t border-[#1E2545] z-40">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#141929] border border-[#1E2545] text-[#8B92A5] text-xs font-medium hover:border-indigo-500/40 transition-colors">
              <TrendingUp className="h-3 w-3" /> Compare to last month
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#141929] border border-[#1E2545] text-[#8B92A5] text-xs font-medium hover:border-indigo-500/40 transition-colors">
              Export Report
            </button>
          </div>
          <div className="flex items-center gap-2 bg-[#141929] border border-[#1E2545] rounded-xl px-4 py-2 max-w-sm w-full">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
            <input
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              placeholder="Ask AI about campaign performance…"
              className="flex-1 bg-transparent text-xs text-white placeholder:text-[#4B5069] outline-none"
            />
            <button className="h-6 w-6 rounded-lg bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center shrink-0 transition-colors">
              <Send className="h-3 w-3 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    }>
      <AnalyticsContent />
    </Suspense>
  );
}
