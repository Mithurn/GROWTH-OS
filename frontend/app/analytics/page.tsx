'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ArrowLeft, Brain, Loader2, Mail, MailOpen,
  MessageSquare, MousePointerClick, Send, Smartphone,
  Sparkles, TrendingUp, Users, Zap,
} from 'lucide-react';

// ─── Config ───────────────────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://xeno-crm-backend-n6d8.onrender.com/api';
const ACCENT = '#5B4FFF';
const GREEN  = '#10B981';
const PIE_COLORS = ['#6366F1', '#10B981', '#3B82F6', '#8B5CF6'];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  name: string;
  objective: string;
  channel: string;
  status: string;
  launched_at: string | null;
  opportunities: {
    title: string;
    audience_size: number;
    potential_revenue: number;
  } | null;
}

interface TimelinePt {
  t: string;
  Delivered: number;
  Opened: number;
  Clicked: number;
}

interface Persona {
  name: string;
  value: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number) { return n.toLocaleString('en-IN'); }
function fmtRev(v: number) {
  if (v >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
  if (v >= 1000)   return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${Math.round(v)}`;
}

function channelMeta(ch: string) {
  if (ch === 'WhatsApp') return { Icon: MessageSquare, color: GREEN };
  if (ch === 'Email')    return { Icon: Mail, color: '#3B82F6' };
  return { Icon: Smartphone, color: '#8B5CF6' };
}

function buildTimeline(delivered: number, opened: number, clicked: number): TimelinePt[] {
  const pts: [number, number][] = [
    [0, 0], [1, 0.02], [2, 0.06], [3, 0.13], [4, 0.22],
    [5, 0.34], [6, 0.50], [7, 0.65], [8, 0.78], [9, 0.88],
    [10, 0.94], [12, 0.97], [15, 0.985], [18, 0.993], [24, 1.0],
  ];
  return pts.map(([h, w]) => ({
    t: h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`,
    Delivered: Math.round(delivered * w),
    Opened: Math.round(opened * w),
    Clicked: Math.round(clicked * w),
  }));
}

function buildPersonas(targeted: number): Persona[] {
  return [
    { name: 'Premium Loyalist', value: Math.round(targeted * 0.38) },
    { name: 'Dormant VIP',      value: Math.round(targeted * 0.28) },
    { name: 'Impulse Buyer',    value: Math.round(targeted * 0.20) },
    { name: 'Discount Seeker',  value: Math.round(targeted * 0.14) },
  ];
}

// ─── Count-up hook ────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1400) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    setVal(0);
    if (!target) return;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// ─── Glassmorphic Card ────────────────────────────────────────────────────────

function Card({ children, className = '', glow = false }: { children: React.ReactNode; className?: string; glow?: boolean }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md ${glow ? 'shadow-lg shadow-indigo-500/10' : ''} ${className}`}>
      {children}
    </div>
  );
}

function SLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B92A5] mb-4">{children}</p>;
}

// ─── Animated stat card ───────────────────────────────────────────────────────

function AnimStat({ label, n, color, Icon, sub }: {
  label: string; n: number; color: string; Icon: React.ElementType; sub?: string;
}) {
  const v = useCountUp(n);
  return (
    <Card className="p-6 flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${color}22`, border: `1px solid ${color}38` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-[#8B92A5]">{label}</span>
      </div>
      <div className="text-4xl font-black text-white tabular-nums">{v.toLocaleString('en-IN')}</div>
      {sub && <div className="text-xs text-[#4B5069]">{sub}</div>}
    </Card>
  );
}

// ─── Engagement Timeline ──────────────────────────────────────────────────────

function TimelineCard({ data }: { data: TimelinePt[] }) {
  return (
    <Card className="p-6 h-full" glow>
      <SLabel>Engagement Timeline · 24h</SLabel>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gDel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={GREEN}   stopOpacity={0.35} />
              <stop offset="95%" stopColor={GREEN}   stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gOpn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={ACCENT}  stopOpacity={0.35} />
              <stop offset="95%" stopColor={ACCENT}  stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gClk" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#F59E0B" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="t" tick={{ fill: '#4B5069', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip contentStyle={{ background: '#0F1225', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 11 }} />
          <Area type="monotone" dataKey="Delivered" stroke={GREEN}   strokeWidth={2} fill="url(#gDel)" dot={false} />
          <Area type="monotone" dataKey="Opened"    stroke={ACCENT}  strokeWidth={2} fill="url(#gOpn)" dot={false} />
          <Area type="monotone" dataKey="Clicked"   stroke="#F59E0B" strokeWidth={2} fill="url(#gClk)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex gap-5 mt-3 justify-center">
        {([['Delivered', GREEN], ['Opened', ACCENT], ['Clicked', '#F59E0B']] as [string, string][]).map(([l, c]) => (
          <div key={l} className="flex items-center gap-1.5 text-xs text-[#8B92A5]">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: c }} />{l}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Persona Pie ──────────────────────────────────────────────────────────────

function PersonaCard({ personas, total }: { personas: Persona[]; total: number }) {
  return (
    <Card className="p-6 h-full" glow>
      <SLabel>Persona Breakdown</SLabel>
      <div className="relative flex items-center justify-center mb-4">
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie data={personas} dataKey="value" nameKey="name" innerRadius={50} outerRadius={72} cx="50%" cy="50%" paddingAngle={2}>
              {personas.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />)}
            </Pie>
            <Tooltip contentStyle={{ background: '#0F1225', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-extrabold text-white">{fmtNum(total)}</span>
          <span className="text-[10px] text-[#4B5069]">Total</span>
        </div>
      </div>
      <div className="space-y-2">
        {personas.map((p, i) => (
          <div key={p.name} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
            <span className="text-[#8B92A5] flex-1 truncate">{p.name}</span>
            <span className="text-white font-semibold">{fmtNum(p.value)}</span>
            <span className="text-[#4B5069] w-8 text-right">{Math.round((p.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Next Best Action ─────────────────────────────────────────────────────────

function NextActionCard({ campaign, opened, clicked, targeted }: {
  campaign: Campaign; opened: number; clicked: number; targeted: number;
}) {
  const router = useRouter();
  const nonConverters = opened - clicked;
  const pct = targeted > 0 ? Math.round((nonConverters / targeted) * 100) : 0;
  const potRev = Math.round((campaign.opportunities?.potential_revenue ?? 0) * 0.25);

  return (
    <div
      className="rounded-2xl p-6 shadow-2xl"
      style={{
        border: '1px solid rgba(91,79,255,0.4)',
        background: 'linear-gradient(135deg, rgba(91,79,255,0.13) 0%, rgba(16,185,129,0.08) 100%)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${ACCENT}25`, border: `1px solid ${ACCENT}40` }}>
              <Brain className="h-3.5 w-3.5" style={{ color: ACCENT }} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: ACCENT }}>
              Next Best Action · AI Recommendation
            </span>
          </div>

          <h3 className="text-xl font-extrabold text-white mb-2">
            Retarget the {pct}% who opened but didn't click
          </h3>
          <p className="text-[#8B92A5] text-sm leading-relaxed max-w-xl">
            {fmtNum(nonConverters)} recipients opened your {campaign.channel} message but haven't converted yet.
            A targeted follow-up within 24 hours with urgency messaging could recover an estimated{' '}
            <span className="text-white font-semibold">{fmtRev(potRev)}</span> in additional revenue.
          </p>

          <div className="flex gap-3 mt-4 flex-wrap">
            <div className="rounded-xl px-3 py-1.5 text-xs font-semibold"
              style={{ background: `${ACCENT}18`, border: `1px solid ${ACCENT}35`, color: ACCENT }}>
              ⚡ High Priority
            </div>
            <div className="rounded-xl px-3 py-1.5 text-xs text-[#8B92A5] border border-white/10 bg-white/5">
              Window: Next 24h
            </div>
            <div className="rounded-xl px-3 py-1.5 text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              89% Confidence
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-4 shrink-0">
          <div className="text-right">
            <div className="text-3xl font-black text-white">{fmtRev(potRev)}</div>
            <div className="text-[10px] text-[#4B5069] uppercase tracking-widest mt-0.5">Est. Recovery</div>
          </div>
          <button
            onClick={() => router.push('/opportunities')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 hover:scale-105"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, ${GREEN})` }}
          >
            <Zap className="h-4 w-4" /> Create Campaign
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function AnalyticsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const campaignId = params.get('campaignId');

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiInput, setAiInput] = useState('');

  useEffect(() => {
    if (!campaignId) { setLoading(false); return; }
    fetch(`${API_BASE}/campaigns/${campaignId}`)
      .then(r => r.json())
      .then(j => {
        if (j.success && j.data) setCampaign(j.data);
        else setError('Campaign not found');
      })
      .catch(() => setError('Failed to load campaign'))
      .finally(() => setLoading(false));
  }, [campaignId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!campaignId || !campaign) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex flex-col items-center justify-center gap-4 px-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-8 max-w-md w-full text-center">
          <Sparkles className="h-8 w-8 text-indigo-400 mx-auto mb-3" />
          <h2 className="text-white font-bold mb-2">{error ?? 'No campaign selected'}</h2>
          <p className="text-[#8B92A5] text-sm mb-5">Go to Opportunities to launch a campaign first.</p>
          <button
            onClick={() => router.push('/opportunities')}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors"
          >
            Go to Opportunities
          </button>
        </div>
      </div>
    );
  }

  // ── Simulated metrics derived from real campaign data ──────────────────────
  const targeted  = campaign.opportunities?.audience_size ?? 0;
  const delivered = Math.round(targeted * 0.98);
  const opened    = Math.round(delivered * 0.68);
  const clicked   = Math.round(opened * 0.42);
  const revenue   = Math.round((campaign.opportunities?.potential_revenue ?? 0) * 0.85);

  const deliveryRate = targeted > 0 ? Math.round((delivered / targeted) * 100) : 0;
  const openRate     = delivered > 0 ? Math.round((opened / delivered) * 100) : 0;
  const clickRate    = opened > 0 ? Math.round((clicked / opened) * 100) : 0;
  const convRate     = targeted > 0 ? ((clicked / targeted) * 100).toFixed(1) : '0';

  const timeline = buildTimeline(delivered, opened, clicked);
  const personas = buildPersonas(targeted);
  const { Icon: ChIcon, color: chColor } = channelMeta(campaign.channel);

  return (
    <div className="min-h-screen text-white pb-24" style={{ background: 'linear-gradient(160deg, #0A0E1A 0%, #0D1020 60%, #0A0E1A 100%)' }}>
      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-sm text-[#8B92A5]">
            <button onClick={() => router.push('/opportunities')} className="flex items-center gap-1.5 hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" /> Opportunities
            </button>
            <span>/</span>
            <span className="text-white font-medium truncate max-w-xs">{campaign.name}</span>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${
            campaign.status === 'Launched'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-white/5 text-[#8B92A5] border-white/10'
          }`}>
            {campaign.status === 'Launched' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
            {campaign.status}
          </span>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-white tracking-tight leading-snug">{campaign.name}</h1>
          <p className="text-[#8B92A5] text-sm mt-1 flex items-center gap-2">
            <ChIcon className="h-3.5 w-3.5 shrink-0" style={{ color: chColor }} />
            {campaign.channel} · {fmtNum(targeted)} customers targeted
          </p>
        </div>

        {/* Revenue hero */}
        <div
          className="rounded-2xl p-6 mb-6 flex items-center justify-between gap-6"
          style={{
            background: 'linear-gradient(135deg, rgba(91,79,255,0.15) 0%, rgba(16,185,129,0.10) 100%)',
            border: '1px solid rgba(91,79,255,0.28)',
          }}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#8B92A5] mb-1">Estimated Revenue Generated</p>
            <div className="text-5xl font-black text-white">{fmtRev(revenue)}</div>
            <p className="text-[#8B92A5] text-sm mt-1.5">
              85% of {fmtRev(campaign.opportunities?.potential_revenue ?? 0)} opportunity potential
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 shrink-0">
            {[
              { label: 'Conv. Rate', value: `${convRate}%`, color: ACCENT },
              { label: 'Open Rate',  value: `${openRate}%`,  color: GREEN },
              { label: 'Click Rate', value: `${clickRate}%`, color: '#F59E0B' },
            ].map(s => (
              <div key={s.label} className="rounded-xl bg-white/5 border border-white/10 p-4 text-center min-w-[90px]">
                <div className="text-xl font-extrabold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[10px] text-[#4B5069] mt-0.5 whitespace-nowrap">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 4 metric cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <AnimStat label="Targeted"  n={targeted}  color={ACCENT}    Icon={Users}             sub="Real audience size" />
          <AnimStat label="Delivered" n={delivered} color={GREEN}     Icon={Send}              sub="98% delivery rate" />
          <AnimStat label="Opened"    n={opened}    color="#3B82F6"   Icon={MailOpen}          sub="68% of delivered" />
          <AnimStat label="Clicked"   n={clicked}   color="#F59E0B"   Icon={MousePointerClick} sub="42% of opened" />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-5 gap-6 mb-6">
          <div className="col-span-3">
            <TimelineCard data={timeline} />
          </div>
          <div className="col-span-2">
            <PersonaCard personas={personas} total={targeted} />
          </div>
        </div>

        {/* Channel performance */}
        <Card className="p-6 mb-6">
          <div className="flex items-center gap-6">
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: `${chColor}15`, border: `1px solid ${chColor}30` }}>
              <ChIcon className="h-7 w-7" style={{ color: chColor }} />
            </div>
            <div className="flex-1 space-y-3">
              {[
                { label: 'Delivery Rate', pct: deliveryRate, color: GREEN },
                { label: 'Open Rate',     pct: openRate,     color: ACCENT },
                { label: 'Click Rate',    pct: clickRate,    color: '#F59E0B' },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-4">
                  <span className="text-xs text-[#8B92A5] w-24 shrink-0">{s.label}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden bg-white/5">
                    <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.color }} />
                  </div>
                  <span className="text-sm font-bold w-10 text-right shrink-0" style={{ color: s.color }}>{s.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Intelligence learnings */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#8B92A5]">Intelligence Learnings</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { Icon: Send,              color: GREEN,     text: `${deliveryRate}% delivery rate — ${fmtNum(delivered)} of ${fmtNum(targeted)} messages delivered via ${campaign.channel}.` },
              { Icon: MailOpen,          color: ACCENT,    text: `${openRate}% open rate — ${fmtNum(opened)} recipients read the message, exceeding industry benchmarks.` },
              { Icon: MousePointerClick, color: '#F59E0B', text: `${clickRate}% click-through — ${fmtNum(clicked)} customers engaged with the call-to-action.` },
            ].map(({ Icon, color, text }) => (
              <div key={text} className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-5"
                style={{ borderLeft: `2px solid ${color}` }}>
                <div className="h-8 w-8 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: `${color}20`, border: `1px solid ${color}30` }}>
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <p className="text-[#8B92A5] text-xs leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Next Best Action */}
        <NextActionCard campaign={campaign} opened={opened} clicked={clicked} targeted={targeted} />
      </div>

      {/* Bottom bar */}
      <div
        className="fixed bottom-0 left-0 right-0 border-t border-white/10 z-40"
        style={{ background: 'rgba(10,14,26,0.92)', backdropFilter: 'blur(16px)' }}
      >
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[#8B92A5] text-xs font-medium hover:border-indigo-500/40 transition-colors">
              <TrendingUp className="h-3 w-3" /> Compare to last month
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[#8B92A5] text-xs font-medium hover:border-indigo-500/40 transition-colors">
              Export Report
            </button>
          </div>
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2 max-w-sm w-full">
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
