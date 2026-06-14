'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
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
const PIE_COLORS = ['#6366F1', '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B'];

// ─── Types matching the real /analytics API ───────────────────────────────────

interface AnalyticsData {
  campaign: {
    id: string;
    name: string;
    objective: string;
    channel: string;
    status: string;
    launched_at: string | null;
    potential_revenue: number;
    confidence_score: number;
  };
  funnel: {
    targeted: number;
    sent: number;
    delivered: number;
    read: number;
    clicked: number;
    failed: number;
  };
  personaBreakdown: { persona_name: string; count: number; percentage: number }[];
  timeline: { hour: number; sent: number; delivered: number; read: number; clicked: number }[];
  insights: {
    learnings: string[];
    nextAction: {
      title: string;
      description: string;
      potentialRevenue: number;
      confidence: number;
    };
  };
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

function hourLabel(h: number) {
  if (h < 0)  return 'Start';
  if (h === 0) return '12a';
  if (h < 12)  return `${h}a`;
  if (h === 12) return '12p';
  return `${h - 12}p`;
}

function toChartTimeline(timeline: AnalyticsData['timeline']) {
  return timeline.map(({ hour, delivered, read, clicked }) => ({
    t: hourLabel(hour),
    Delivered: delivered,
    Opened: read,
    Clicked: clicked,
  }));
}

function toChartPersonas(breakdown: AnalyticsData['personaBreakdown']) {
  return breakdown.map(p => ({ name: p.persona_name, value: p.count }));
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

function TimelineCard({ data, isLive }: { data: ReturnType<typeof toChartTimeline>; isLive: boolean }) {
  const empty = data.length === 0 || data.every(d => d.Delivered === 0);

  return (
    <Card className="p-6 h-full" glow>
      <div className="flex items-center justify-between mb-1">
        <SLabel>Engagement Timeline · Live</SLabel>
        {isLive && (
          <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold mb-4">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
        )}
      </div>
      {empty ? (
        <div className="flex flex-col items-center justify-center h-[200px] gap-3">
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-2 w-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <p className="text-[#4B5069] text-xs">Waiting for webhook events…</p>
        </div>
      ) : (
        <>
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
        </>
      )}
    </Card>
  );
}

// ─── Persona Pie ──────────────────────────────────────────────────────────────

function PersonaCard({ personas, total }: { personas: { name: string; value: number }[]; total: number }) {
  const empty = personas.length === 0;
  return (
    <Card className="p-6 h-full" glow>
      <SLabel>Persona Breakdown</SLabel>
      {empty ? (
        <div className="flex flex-col items-center justify-center h-[200px]">
          <p className="text-[#4B5069] text-xs">No persona data yet.</p>
        </div>
      ) : (
        <>
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
                <span className="text-[#4B5069] w-8 text-right">{total > 0 ? Math.round((p.value / total) * 100) : 0}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

// ─── Next Best Action ─────────────────────────────────────────────────────────

function NextActionCard({ nextAction, channel }: {
  nextAction: AnalyticsData['insights']['nextAction'];
  channel: string;
}) {
  const router = useRouter();
  if (!nextAction?.title) return null;
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
          <h3 className="text-xl font-extrabold text-white mb-2">{nextAction.title}</h3>
          <p className="text-[#8B92A5] text-sm leading-relaxed max-w-xl">{nextAction.description}</p>
          <div className="flex gap-3 mt-4 flex-wrap">
            <div className="rounded-xl px-3 py-1.5 text-xs font-semibold"
              style={{ background: `${ACCENT}18`, border: `1px solid ${ACCENT}35`, color: ACCENT }}>
              ⚡ High Priority
            </div>
            <div className="rounded-xl px-3 py-1.5 text-xs text-[#8B92A5] border border-white/10 bg-white/5">
              Window: Next 24h
            </div>
            {nextAction.confidence > 0 && (
              <div className="rounded-xl px-3 py-1.5 text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                {nextAction.confidence}% Confidence
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-4 shrink-0">
          {nextAction.potentialRevenue > 0 && (
            <div className="text-right">
              <div className="text-3xl font-black text-white">{fmtRev(nextAction.potentialRevenue)}</div>
              <div className="text-[10px] text-[#4B5069] uppercase tracking-widest mt-0.5">Est. Recovery</div>
            </div>
          )}
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

// ─── Main analytics content ───────────────────────────────────────────────────

function AnalyticsContent() {
  const router = useRouter();
  const params = useSearchParams();
  const campaignId = params.get('campaignId');

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiInput, setAiInput] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAnalytics = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/campaigns/${id}/analytics`);
      const j = await res.json();
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

  // Poll every 5s while campaign is live
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

  if (!campaignId || !data) {
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

  const { campaign, funnel, personaBreakdown, timeline, insights } = data;
  const isLive = campaign.status === 'Launched';

  // Derived display values from real funnel
  const revenue = funnel.targeted > 0
    ? Math.round((funnel.clicked / funnel.targeted) * campaign.potential_revenue)
    : 0;
  const deliveryRate = funnel.targeted > 0 ? Math.round((funnel.delivered / funnel.targeted) * 100) : 0;
  const openRate     = funnel.delivered > 0 ? Math.round((funnel.read / funnel.delivered) * 100) : 0;
  const clickRate    = funnel.read > 0 ? Math.round((funnel.clicked / funnel.read) * 100) : 0;
  const convRate     = funnel.targeted > 0 ? ((funnel.clicked / funnel.targeted) * 100).toFixed(1) : '0';

  const chartTimeline = toChartTimeline(timeline);
  const chartPersonas = toChartPersonas(personaBreakdown);
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
            isLive
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-white/5 text-[#8B92A5] border-white/10'
          }`}>
            {isLive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
            {campaign.status}
          </span>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-white tracking-tight leading-snug">{campaign.name}</h1>
          <p className="text-[#8B92A5] text-sm mt-1 flex items-center gap-2">
            <ChIcon className="h-3.5 w-3.5 shrink-0" style={{ color: chColor }} />
            {campaign.channel} · {fmtNum(funnel.targeted)} customers targeted
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
              of {fmtRev(campaign.potential_revenue)} opportunity potential
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

        {/* 4 real funnel metric cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <AnimStat label="Targeted"  n={funnel.targeted}  color={ACCENT}    Icon={Users}             sub="From opportunity audience" />
          <AnimStat label="Delivered" n={funnel.delivered} color={GREEN}     Icon={Send}              sub={`${deliveryRate}% delivery rate`} />
          <AnimStat label="Opened"    n={funnel.read}      color="#3B82F6"   Icon={MailOpen}          sub={`${openRate}% of delivered`} />
          <AnimStat label="Clicked"   n={funnel.clicked}   color="#F59E0B"   Icon={MousePointerClick} sub={`${clickRate}% of opened`} />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-5 gap-6 mb-6">
          <div className="col-span-3">
            <TimelineCard data={chartTimeline} isLive={isLive} />
          </div>
          <div className="col-span-2">
            <PersonaCard personas={chartPersonas} total={funnel.targeted} />
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
        {insights.learnings.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#8B92A5]">Intelligence Learnings</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {insights.learnings.slice(0, 3).map((text, i) => {
                const iconColor = [GREEN, ACCENT, '#F59E0B'][i % 3];
                const IconComp = [Send, MailOpen, MousePointerClick][i % 3];
                return (
                  <div key={i} className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-5"
                    style={{ borderLeft: `2px solid ${iconColor}` }}>
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center mb-3"
                      style={{ background: `${iconColor}20`, border: `1px solid ${iconColor}30` }}>
                      <IconComp className="h-4 w-4" style={{ color: iconColor }} />
                    </div>
                    <p className="text-[#8B92A5] text-xs leading-relaxed">{text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Next Best Action */}
        <NextActionCard nextAction={insights.nextAction} channel={campaign.channel} />
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
