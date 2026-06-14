'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  LineChart, Line, PieChart, Pie, Cell,
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ArrowLeft, Brain, ChevronRight, Loader2, Mail, MailOpen,
  MessageSquare, MousePointerClick, Send, Smartphone,
  Sparkles, Target, TrendingUp, Users, Zap, Activity,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://xeno-crm-backend-n6d8.onrender.com/api';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:     '#070A11',
  card:   '#0C1018',
  border: '#1B2438',
  text:   '#DDE5F0',
  muted:  '#566075',
  dim:    '#1A2438',
  green:  '#10B981',
  blue:   '#3B82F6',
  purple: '#8B5CF6',
  amber:  '#F59E0B',
  red:    '#F87171',
} as const;

const SEG_COLORS = [C.green, C.blue, C.purple, C.amber, '#EC4899'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  campaign: {
    id: string; name: string; objective: string; channel: string;
    status: string; launched_at: string | null;
    potential_revenue: number; confidence_score: number;
  };
  funnel: { targeted: number; sent: number; delivered: number; read: number; clicked: number; failed: number };
  personaBreakdown: { persona_name: string; count: number; percentage: number }[];
  timeline: { hour: number; sent: number; delivered: number; read: number; clicked: number }[];
  insights: {
    learnings: string[];
    nextAction: { title: string; description: string; potentialRevenue: number; confidence: number };
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number) { return n.toLocaleString('en-IN'); }
function fmtRev(v: number) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
  if (v >= 1000)   return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${Math.round(v)}`;
}
function dropPct(from: number, to: number) {
  if (!from) return '';
  return `-${Math.round((1 - to / from) * 100)}%`;
}
function channelMeta(ch: string) {
  if (ch === 'WhatsApp') return { Icon: MessageSquare, color: C.green };
  if (ch === 'Email')    return { Icon: Mail, color: C.blue };
  return { Icon: Smartphone, color: C.purple };
}
function hourLabel(h: number) {
  if (h < 0) return 'Start';
  if (h === 0) return '12a';
  if (h < 12) return `${h}a`;
  if (h === 12) return '12p';
  return `${h - 12}p`;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useCountUp(target: number, ms = 900) {
  const [val, setVal] = useState(target);
  const fromRef = useRef(target);
  const rafRef  = useRef<number>(0);

  useEffect(() => {
    if (target === fromRef.current) return;
    const from = fromRef.current;
    fromRef.current = target;
    cancelAnimationFrame(rafRef.current);
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / ms, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (target - from) * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, ms]);
  return val;
}

function useTypewriter(text: string, speed = 22) {
  const [out, setOut] = useState('');
  const seen = useRef('');
  useEffect(() => {
    if (!text || text === seen.current) return;
    seen.current = text;
    setOut('');
    let i = 0;
    const id = setInterval(() => {
      i++;
      setOut(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return out;
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function Card({ children, className = '', accent }: { children: React.ReactNode; className?: string; accent?: string }) {
  return (
    <div
      className={`rounded-xl p-5 ${className}`}
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        ...(accent ? { borderTop: `2px solid ${accent}` } : {}),
      }}
    >
      {children}
    </div>
  );
}

function Label({ children, pulse }: { children: React.ReactNode; pulse?: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {pulse && <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: pulse }} />}
      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>{children}</p>
    </div>
  );
}

// ─── KPI Hero ─────────────────────────────────────────────────────────────────

function KpiHero({ campaign, funnel }: { campaign: AnalyticsData['campaign']; funnel: AnalyticsData['funnel'] }) {
  const revenue    = funnel.targeted > 0 ? Math.round((funnel.clicked / funnel.targeted) * campaign.potential_revenue) : 0;
  const convRate   = funnel.targeted > 0 ? ((funnel.clicked / funnel.targeted) * 100).toFixed(1) : '0.0';
  const roi        = revenue > 0 && funnel.targeted > 0 ? (revenue / (funnel.targeted * 8)).toFixed(1) : '—';
  const animRev    = useCountUp(revenue);
  const animOrders = useCountUp(funnel.clicked);

  return (
    <Card>
      <Label>Revenue Generated</Label>
      <div className="text-5xl font-black mb-1 tracking-tight" style={{ color: C.text }}>
        {fmtRev(animRev)}
      </div>
      <p className="text-xs mb-5" style={{ color: C.muted }}>
        of {fmtRev(campaign.potential_revenue)} opportunity potential
      </p>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Orders',    value: fmtNum(animOrders), color: C.text },
          { label: 'Conv Rate', value: `${convRate}%`,     color: C.green },
          { label: 'ROI',       value: `${roi}x`,          color: C.blue },
        ].map(s => (
          <div key={s.label} className="rounded-lg p-3" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
            <div className="text-base font-bold mb-0.5" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[9px] uppercase tracking-widest" style={{ color: C.muted }}>{s.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Conversion Funnel ────────────────────────────────────────────────────────

function ConversionFunnel({ funnel }: { funnel: AnalyticsData['funnel'] }) {
  const steps = [
    { Icon: Users,             label: 'Targeted',  value: funnel.targeted,  from: null },
    { Icon: Send,              label: 'Delivered', value: funnel.delivered, from: funnel.targeted },
    { Icon: MailOpen,          label: 'Opened',    value: funnel.read,      from: funnel.delivered },
    { Icon: MousePointerClick, label: 'Clicked',   value: funnel.clicked,   from: funnel.read },
  ];
  const max = funnel.targeted || 1;

  return (
    <Card>
      <Label>Conversion Flow</Label>
      <div className="space-y-3">
        {steps.map(({ Icon, label, value, from }, i) => {
          const isLast = i === steps.length - 1;
          const widthPct = Math.round((value / max) * 100);
          const drop = from ? dropPct(from, value) : null;
          return (
            <div key={label} className="flex items-center gap-3">
              <div
                className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
                style={{
                  background: isLast ? `${C.green}1A` : C.bg,
                  border: `1px solid ${isLast ? C.green + '40' : C.border}`,
                }}
              >
                <Icon className="h-3 w-3" style={{ color: isLast ? C.green : C.muted }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px]" style={{ color: isLast ? C.text : C.muted }}>{label}</span>
                  <div className="flex items-center gap-2">
                    {drop && <span className="text-[10px]" style={{ color: C.red }}>{drop}</span>}
                    <span className="text-sm font-bold" style={{ color: isLast ? C.green : C.text }}>{fmtNum(value)}</span>
                  </div>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: C.dim }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${widthPct}%`,
                      background: isLast ? C.green : C.blue,
                      transition: 'width 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Revenue Velocity ─────────────────────────────────────────────────────────

function VelocityChart({
  timeline, potential_revenue, targeted,
}: { timeline: AnalyticsData['timeline']; potential_revenue: number; targeted: number }) {
  const data = timeline.map(pt => ({
    t: hourLabel(pt.hour),
    Revenue: targeted > 0 ? Math.round((pt.clicked / targeted) * potential_revenue) : 0,
    Engaged: pt.read,
  }));
  const empty = data.length === 0 || data.every(d => d.Revenue === 0 && d.Engaged === 0);

  return (
    <Card>
      <Label pulse={C.green}>Revenue Velocity</Label>
      {empty ? (
        <div className="h-[162px] flex flex-col items-center justify-center gap-2">
          <Activity className="h-5 w-5" style={{ color: C.dim }} />
          <p className="text-xs" style={{ color: C.muted }}>Waiting for events…</p>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="t" tick={{ fill: C.muted, fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 11 }}
                formatter={(v: number, name: string) => [name === 'Revenue' ? fmtRev(v) : fmtNum(v), name]}
              />
              <Line type="monotone" dataKey="Revenue" stroke={C.green} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Engaged" stroke={C.blue} strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2">
            {([['Revenue', C.green, false], ['Engaged', C.blue, true]] as [string, string, boolean][]).map(([l, color, dashed]) => (
              <div key={l} className="flex items-center gap-1.5 text-[10px]" style={{ color: C.muted }}>
                <span className="h-px w-4" style={{ background: color, ...(dashed ? { backgroundImage: `repeating-linear-gradient(90deg, ${color} 0, ${color} 3px, transparent 3px, transparent 6px)` } : {}) }} />
                {l}
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

// ─── Audience Mix Donut ───────────────────────────────────────────────────────

function AudienceDonut({ personas, targeted }: { personas: AnalyticsData['personaBreakdown']; targeted: number }) {
  const data = personas.map(p => ({ name: p.persona_name, value: p.count }));
  return (
    <Card>
      <Label>Audience Mix</Label>
      {data.length === 0 ? (
        <div className="h-[200px] flex items-center justify-center">
          <p className="text-xs" style={{ color: C.muted }}>No persona data yet.</p>
        </div>
      ) : (
        <>
          <div className="relative flex justify-center">
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={42} outerRadius={62} cx="50%" cy="50%" paddingAngle={2} stroke="none">
                  {data.map((_, i) => <Cell key={i} fill={SEG_COLORS[i % SEG_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-lg font-black" style={{ color: C.text }}>{fmtNum(targeted)}</span>
              <span className="text-[9px] uppercase tracking-wider" style={{ color: C.muted }}>Total</span>
            </div>
          </div>
          <div className="space-y-2 mt-1">
            {data.slice(0, 4).map((p, i) => (
              <div key={p.name} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: SEG_COLORS[i % SEG_COLORS.length] }} />
                <span className="text-xs flex-1 truncate" style={{ color: C.muted }}>{p.name}</span>
                <span className="text-xs font-semibold" style={{ color: C.text }}>
                  {targeted > 0 ? Math.round((p.value / targeted) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

// ─── Channel Performance ──────────────────────────────────────────────────────

function ChannelPerf({ campaign, funnel }: { campaign: AnalyticsData['campaign']; funnel: AnalyticsData['funnel'] }) {
  const { Icon, color } = channelMeta(campaign.channel);
  const bars = [
    { label: 'Delivery Rate',  pct: funnel.targeted  > 0 ? Math.round((funnel.delivered / funnel.targeted)  * 100) : 0, color: C.green  },
    { label: 'Open Rate',      pct: funnel.delivered > 0 ? Math.round((funnel.read       / funnel.delivered) * 100) : 0, color: C.blue   },
    { label: 'Click-Through',  pct: funnel.read      > 0 ? Math.round((funnel.clicked    / funnel.read)      * 100) : 0, color: C.purple },
  ];

  return (
    <Card>
      <Label>Channel Performance</Label>
      <div className="flex items-center gap-3 mb-5">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
        <div>
          <div className="text-sm font-bold" style={{ color: C.text }}>{campaign.channel}</div>
          <div className="text-[10px]" style={{ color: C.muted }}>Primary channel</div>
        </div>
      </div>
      <div className="space-y-4">
        {bars.map(b => (
          <div key={b.label}>
            <div className="flex justify-between mb-1.5">
              <span className="text-xs" style={{ color: C.muted }}>{b.label}</span>
              <span className="text-xs font-bold" style={{ color: b.color }}>{b.pct}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.dim }}>
              <div className="h-full rounded-full" style={{ width: `${b.pct}%`, background: b.color, transition: 'width 1.2s cubic-bezier(0.16, 1, 0.3, 1)' }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Revenue by Segment ───────────────────────────────────────────────────────

function RevenueBySegment({ personas, revenue }: { personas: AnalyticsData['personaBreakdown']; revenue: number }) {
  const total = personas.reduce((s, p) => s + p.count, 0) || 1;
  const items = personas
    .map((p, i) => ({ name: p.persona_name, rev: Math.round((p.count / total) * revenue), color: SEG_COLORS[i % SEG_COLORS.length] }))
    .sort((a, b) => b.rev - a.rev);

  return (
    <Card>
      <Label>Revenue by Segment</Label>
      {items.length === 0 ? (
        <p className="text-xs" style={{ color: C.muted }}>No data yet.</p>
      ) : (
        <div className="space-y-3.5">
          {items.map(item => (
            <div key={item.name} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: item.color }} />
                <span className="text-xs truncate" style={{ color: C.muted }}>{item.name}</span>
              </div>
              <span className="text-sm font-bold shrink-0" style={{ color: C.text }}>{fmtRev(item.rev)}</span>
            </div>
          ))}
          <div className="pt-2 mt-1 flex items-center justify-between" style={{ borderTop: `1px solid ${C.border}` }}>
            <span className="text-xs font-bold" style={{ color: C.muted }}>Total</span>
            <span className="text-sm font-black" style={{ color: C.green }}>{fmtRev(revenue)}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Intelligence Learnings ───────────────────────────────────────────────────

function IntelligenceSection({ learnings }: { learnings: string[] }) {
  if (learnings.length === 0) return null;
  const meta = [
    { Icon: MessageSquare, color: C.blue,   tag: 'Message Resonance' },
    { Icon: Target,        color: C.purple, tag: 'Timing Optimization' },
    { Icon: Users,         color: C.amber,  tag: 'Cart Behaviour' },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-3.5 w-3.5" style={{ color: C.blue }} />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.muted }}>
          Intelligence Learnings
        </span>
        <span className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${C.blue}18`, color: C.blue }}>
          ✦ AI
        </span>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {learnings.slice(0, 3).map((text, i) => {
          const { Icon, color, tag } = meta[i % meta.length];
          return (
            <div key={i} className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `2px solid ${color}` }}>
              <div className="flex items-center gap-2 mb-2.5">
                <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color }}>{tag}</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: C.muted }}>{text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── AI Opportunity Card ──────────────────────────────────────────────────────

function OpportunityCard({ nextAction }: { nextAction: AnalyticsData['insights']['nextAction'] }) {
  const router = useRouter();
  const title  = useTypewriter(nextAction?.title ?? '', 22);
  const typing = title.length < (nextAction?.title ?? '').length;
  if (!nextAction?.title) return null;

  return (
    <div className="rounded-xl p-6" style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: `2px solid ${C.green}` }}>
      <div className="flex items-center gap-2 mb-4">
        <Brain className="h-3.5 w-3.5" style={{ color: C.green }} />
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.green }}>
          ✦ Based on Campaign Performance
        </span>
      </div>
      <div className="flex items-start justify-between gap-8">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest mb-2 font-bold" style={{ color: C.muted }}>
            New Opportunity Detected:
          </p>
          <h3 className="text-2xl font-black mb-3 leading-tight" style={{ color: C.text }}>
            {title}
            {typing && <span className="animate-pulse ml-0.5" style={{ color: C.green }}>|</span>}
          </h3>
          <p className="text-sm leading-relaxed max-w-xl" style={{ color: C.muted }}>
            {nextAction.description}
          </p>
          <button
            onClick={() => router.push('/opportunities')}
            className="mt-5 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-opacity hover:opacity-80"
            style={{ background: C.green, color: '#020A06' }}
          >
            Create Campaign <Zap className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex gap-6 shrink-0">
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: C.muted }}>Potential Revenue</div>
            <div className="text-3xl font-black" style={{ color: C.text }}>{fmtRev(nextAction.potentialRevenue)}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-widest mb-1" style={{ color: C.muted }}>Confidence</div>
            <div className="text-3xl font-black" style={{ color: C.green }}>{nextAction.confidence}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function AnalyticsContent() {
  const router   = useRouter();
  const params   = useSearchParams();
  const campaignId = params.get('campaignId');

  const [data,    setData]    = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [aiInput, setAiInput] = useState('');
  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAnalytics = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/campaigns/${id}/analytics`);
      const j   = await res.json();
      if (j.success && j.data) setData(j.data);
      else setError(j.error ?? 'Campaign not found');
    } catch {
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!campaignId) { setLoading(false); return; }
    fetchAnalytics(campaignId);
  }, [campaignId, fetchAnalytics]);

  useEffect(() => {
    if (!campaignId || data?.campaign.status !== 'Launched') return;
    pollerRef.current = setInterval(() => fetchAnalytics(campaignId), 5000);
    return () => { if (pollerRef.current) clearInterval(pollerRef.current); };
  }, [campaignId, data?.campaign.status, fetchAnalytics]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
      <Loader2 className="h-7 w-7 animate-spin" style={{ color: C.green }} />
    </div>
  );

  if (!campaignId || !data) return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: C.bg }}>
      <div className="rounded-xl p-8 max-w-sm w-full text-center" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <Sparkles className="h-7 w-7 mx-auto mb-3" style={{ color: C.blue }} />
        <h2 className="font-bold mb-2" style={{ color: C.text }}>{error ?? 'No campaign selected'}</h2>
        <p className="text-sm mb-5" style={{ color: C.muted }}>Launch a campaign from Opportunities first.</p>
        <button onClick={() => router.push('/opportunities')}
          className="px-5 py-2 rounded-lg text-sm font-bold hover:opacity-80 transition-opacity"
          style={{ background: C.green, color: '#020A06' }}>
          Go to Opportunities
        </button>
      </div>
    </div>
  );

  const { campaign, funnel, personaBreakdown, timeline, insights } = data;
  const isLive  = campaign.status === 'Launched';
  const revenue = funnel.targeted > 0 ? Math.round((funnel.clicked / funnel.targeted) * campaign.potential_revenue) : 0;

  return (
    <div className="min-h-screen pb-24" style={{ background: C.bg, color: C.text }}>
      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 text-[11px] mb-5" style={{ color: C.muted }}>
          <button onClick={() => router.push('/analytics')} className="hover:text-white transition-colors">Analytics</button>
          <ChevronRight className="h-3 w-3" />
          <span>Campaigns</span>
          <ChevronRight className="h-3 w-3" />
          <span style={{ color: C.text }}>{campaign.name}</span>
        </div>

        {/* Title row */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              {isLive && (
                <span className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${C.green}18`, color: C.green, border: `1px solid ${C.green}30` }}>
                  <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: C.green }} /> LIVE
                </span>
              )}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: C.dim, color: C.muted, border: `1px solid ${C.border}` }}>
                {campaign.status}
              </span>
            </div>
            <h1 className="text-xl font-black tracking-tight" style={{ color: C.text }}>{campaign.name}</h1>
            <p className="text-sm mt-0.5" style={{ color: C.muted }}>
              {campaign.channel} · {fmtNum(funnel.targeted)} customers targeted
            </p>
          </div>
          <button onClick={() => router.push('/opportunities')}
            className="flex items-center gap-1.5 text-xs hover:text-white transition-colors" style={{ color: C.muted }}>
            <ArrowLeft className="h-3.5 w-3.5" /> Opportunities
          </button>
        </div>

        {/* Row 1 */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <KpiHero campaign={campaign} funnel={funnel} />
          <ConversionFunnel funnel={funnel} />
          <VelocityChart timeline={timeline} potential_revenue={campaign.potential_revenue} targeted={funnel.targeted} />
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <AudienceDonut personas={personaBreakdown} targeted={funnel.targeted} />
          <ChannelPerf campaign={campaign} funnel={funnel} />
          <RevenueBySegment personas={personaBreakdown} revenue={revenue} />
        </div>

        {/* Intelligence */}
        <div className="mb-4">
          <IntelligenceSection learnings={insights.learnings} />
        </div>

        {/* Opportunity */}
        <OpportunityCard nextAction={insights.nextAction} />
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40" style={{ background: C.card, borderTop: `1px solid ${C.border}` }}>
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {['Compare to last month', 'Export Report'].map(label => (
              <button key={label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:text-white transition-colors"
                style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.muted }}>
                {label === 'Compare to last month' && <TrendingUp className="h-3 w-3" />}
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-lg px-4 py-2 max-w-sm w-full"
            style={{ background: C.bg, border: `1px solid ${C.border}` }}>
            <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: C.blue }} />
            <input
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              placeholder="Ask AI about campaign performance…"
              className="flex-1 bg-transparent text-xs outline-none placeholder:opacity-40"
              style={{ color: C.text }}
            />
            <button className="h-6 w-6 rounded-md flex items-center justify-center shrink-0" style={{ background: C.blue }}>
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#070A11' }}>
        <Loader2 className="h-7 w-7 animate-spin" style={{ color: '#10B981' }} />
      </div>
    }>
      <AnalyticsContent />
    </Suspense>
  );
}
