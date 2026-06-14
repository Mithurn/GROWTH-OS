'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Loader2,
  Mail,
  MessageSquare,
  Rocket,
  Send,
  Smartphone,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import {
  generateCampaign,
  saveCampaign,
  getCampaigns,
  approveCampaign,
  launchCampaign,
  getOpportunityDashboard,
  refineCampaign,
} from '@/lib/api';
import { PhoneMockup } from '@/components/ui/phone-mockup';

// ─── Types ───────────────────────────────────────────────────
interface CampaignData {
  id: string;
  name: string;
  objective: string;
  channel: string;
  offer: string | null;
  message_angle: string | null;
  message_content: string;
  expected_outcome: string | null;
  reasoning: string | null;
  status: string;
  opportunity_id: string;
  audience_size?: number;
  communications_sent?: number;
  communications_delivered?: number;
}

interface Opportunity {
  opportunity_id: string;
  title: string;
  description: string;
  audience_size: number;
  potential_revenue: number;
  confidence_score?: number;
  predicted_conversion_rate?: number | null;
  supporting_customer_segment?: string;
}

// ─── Helpers ─────────────────────────────────────────────────
const CHANNELS = ['WhatsApp', 'Email', 'SMS'] as const;
type Channel = typeof CHANNELS[number];

const CHANNEL_META: Record<Channel, { icon: React.ElementType; color: string; desc: string; stats: string }> = {
  WhatsApp: {
    icon: MessageSquare,
    color: 'text-emerald-600',
    desc: 'High engagement. Conversational format with rich media support.',
    stats: '86% open rate',
  },
  Email: {
    icon: Mail,
    color: 'text-blue-600',
    desc: 'Ideal for detailed offers. Supports images, links and long copy.',
    stats: '24% open rate',
  },
  SMS: {
    icon: Smartphone,
    color: 'text-violet-600',
    desc: 'Instant delivery. 160 char limit. Best for flash sales.',
    stats: '98% delivery rate',
  },
};

const REFINE_CHIPS = ['Make it more urgent', 'Make it shorter', 'More premium tone'];

const formatCurrency = (v: number) => {
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${Math.round(v)}`;
};

function statusStyles(status: string) {
  switch (status) {
    case 'Approved': return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'Launched': return 'border-blue-200 bg-blue-50 text-blue-800';
    case 'Completed': return 'border-stone-200 bg-stone-100 text-stone-700';
    default: return 'border-amber-200 bg-amber-50 text-amber-800';
  }
}

// ─── Main component ──────────────────────────────────────────
function CampaignsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const opportunityId = searchParams.get('opportunityId');

  const [companyId, setCompanyId] = useState<string | undefined>(undefined);

  // Builder mode state
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [savedCampaign, setSavedCampaign] = useState<CampaignData | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel>('WhatsApp');
  const [currentMessage, setCurrentMessage] = useState('');
  const [modifier, setModifier] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  // List mode state
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignData | null>(null);

  // Shared
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Load company ID ──
  useEffect(() => {
    async function init() {
      let cid = window.localStorage.getItem('xeno_company_id');
      if (!cid) {
        try {
          const r = await fetch('https://xeno-crm-backend-n6d8.onrender.com/api/opportunities');
          const d = await r.json();
          if (d.success && d.data.companyId) {
            cid = d.data.companyId;
            window.localStorage.setItem('xeno_company_id', cid!);
          }
        } catch {}
      }
      if (cid) setCompanyId(cid);
      else setError('Company not found. Please complete onboarding.');
    }
    init();
  }, []);

  // ── Builder mode: load opportunity + campaign ──
  const loadBuilderData = useCallback(async () => {
    if (!companyId || !opportunityId) return;
    setLoading(true);
    setError(null);
    try {
      const [dashRes, campaignsRes] = await Promise.all([
        getOpportunityDashboard(companyId),
        getCampaigns(companyId),
      ]);

      const opp = (dashRes.data.opportunityDistribution ?? []).find(
        (o: any) => o.opportunity_id === opportunityId,
      );
      if (!opp) { setError('Opportunity not found.'); return; }
      setOpportunity(opp);

      const existing = (campaignsRes.data ?? []).find(
        (c: any) => c.opportunity_id === opportunityId,
      );

      if (existing) {
        setSavedCampaign(existing);
        setCurrentMessage(existing.message_content);
        setSelectedChannel((existing.channel as Channel) ?? 'WhatsApp');
      } else {
        setIsGenerating(true);
        const genRes = await generateCampaign(opportunityId, companyId);
        const draft = genRes.data.campaign;
        const saveRes = await saveCampaign(opportunityId, draft, companyId);
        const saved = saveRes.data;
        setSavedCampaign(saved);
        setCurrentMessage(saved.message_content);
        setSelectedChannel((saved.channel as Channel) ?? 'WhatsApp');
        setIsGenerating(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campaign');
      setIsGenerating(false);
    } finally {
      setLoading(false);
    }
  }, [companyId, opportunityId]);

  // ── List mode: load campaigns ──
  const loadCampaigns = useCallback(async () => {
    if (!companyId || opportunityId) return;
    setLoading(true);
    try {
      const res = await getCampaigns(companyId);
      const list = res.data ?? [];
      setCampaigns(list);
      if (list.length > 0) setSelectedCampaign(list[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [companyId, opportunityId]);

  useEffect(() => {
    if (!companyId) return;
    if (opportunityId) loadBuilderData();
    else loadCampaigns();
  }, [companyId, opportunityId, loadBuilderData, loadCampaigns]);

  // ── Handlers ──
  async function handleChannelChange(ch: Channel) {
    if (ch === selectedChannel || !savedCampaign || isRefining) return;
    setSelectedChannel(ch);
    setIsRefining(true);
    try {
      const res = await refineCampaign(savedCampaign.id, '', ch);
      if (res.data?.message_content) setCurrentMessage(res.data.message_content);
    } catch (e) {
      console.error('[channel refine]', e);
    } finally {
      setIsRefining(false);
    }
  }

  async function handleRefine(text?: string) {
    const query = (text ?? modifier).trim();
    if (!query || !savedCampaign || isRefining) return;
    setIsRefining(true);
    try {
      const res = await refineCampaign(savedCampaign.id, query);
      if (res.data?.message_content) setCurrentMessage(res.data.message_content);
      setModifier('');
    } catch (e) {
      console.error('[refine]', e);
    } finally {
      setIsRefining(false);
    }
  }

  async function handleApproveAndLaunch() {
    if (!savedCampaign || isLaunching) return;
    setIsLaunching(true);
    setError(null);
    try {
      await approveCampaign(savedCampaign.id);
      await launchCampaign(savedCampaign.id);
      router.push('/opportunities');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to launch campaign');
      setIsLaunching(false);
    }
  }

  // ── Render: generating ──
  if (isGenerating || (loading && opportunityId)) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center gap-4">
        <div className="h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-indigo-500 animate-pulse" />
        </div>
        <p className="text-sm font-medium text-gray-600">AI is crafting your campaign…</p>
        <p className="text-xs text-gray-400">Analyzing opportunity signals and writing copy</p>
      </div>
    );
  }

  // ── Render: builder mode error (opportunityId present but something failed) ──
  if (opportunityId && !savedCampaign && error) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center gap-4 px-6">
        <div className="bg-white rounded-xl border border-red-200 p-8 max-w-md w-full text-center shadow-sm">
          <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
            <X className="h-5 w-5 text-red-500" />
          </div>
          <h2 className="text-base font-bold text-gray-900 mb-1">Campaign generation failed</h2>
          <p className="text-sm text-red-600 mb-5">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { setError(null); loadBuilderData(); }}
              className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push('/opportunities')}
              className="px-5 py-2.5 border border-gray-200 text-gray-500 text-sm font-semibold rounded-xl hover:border-gray-300 transition-all"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: builder mode ──
  if (opportunityId && savedCampaign && opportunity) {
    const conv = opportunity.predicted_conversion_rate ?? Math.round((opportunity.confidence_score ?? 75) * 0.16);
    const offerText = savedCampaign.offer ?? '₹500 Voucher';

    return (
      <div className="min-h-screen bg-[#FAFAFA] pb-32">
        <div className="max-w-7xl mx-auto px-6 py-6">

          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => router.push('/opportunities')}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Opportunities
            </button>
            <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-indigo-50 text-indigo-600 rounded-full border border-indigo-200">
              Draft Generated by AI
            </span>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* Title */}
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight mb-1">{savedCampaign.name}</h1>
          <p className="text-sm text-gray-400 mb-5">Generated from <span className="text-gray-600 font-medium">{opportunity.title}</span></p>

          {/* Metric chips */}
          <div className="flex items-center gap-3 flex-wrap mb-8">
            <MetricChip icon={Users} label={`${opportunity.audience_size} Customers`} />
            <MetricChip icon={TrendingUp} label={`${formatCurrency(opportunity.potential_revenue)} Projected Rev`} />
            <MetricChip icon={Zap} label={`${conv}% Conversion`} accent />
            <MetricChip icon={CheckCircle2} label={offerText} />
          </div>

          {/* 3-col layout: left strategy (2), right mockup (1) */}
          <div className="grid grid-cols-3 gap-8">

            {/* Left: 2/3 */}
            <div className="col-span-2 space-y-6">

              {/* Why section */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center gap-1.5 mb-3">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Why I Created This Campaign</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {savedCampaign.reasoning ?? savedCampaign.objective}
                </p>
                {savedCampaign.expected_outcome && (
                  <p className="mt-2 text-xs text-gray-400 italic">{savedCampaign.expected_outcome}</p>
                )}
              </div>

              {/* Channel selector */}
              <div>
                <div className="flex items-center gap-1.5 mb-3">
                  <Target className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Channel Strategy</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {CHANNELS.map(ch => {
                    const meta = CHANNEL_META[ch];
                    const Icon = meta.icon;
                    const selected = selectedChannel === ch;
                    return (
                      <button
                        key={ch}
                        onClick={() => handleChannelChange(ch)}
                        disabled={isRefining}
                        className={`rounded-xl border p-4 text-left transition-all duration-200 ${
                          selected
                            ? 'border-indigo-400 bg-indigo-50 shadow-sm ring-1 ring-indigo-300'
                            : 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-gray-50'
                        } disabled:opacity-50`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className={`flex items-center gap-1.5 ${selected ? 'text-indigo-600' : 'text-gray-600'}`}>
                            <Icon className="h-4 w-4" />
                            <span className="text-sm font-bold">{ch}</span>
                          </div>
                          {selected && <Check className="h-3.5 w-3.5 text-indigo-500" />}
                        </div>
                        <p className="text-[10px] text-gray-400 leading-snug mb-1.5">{meta.desc}</p>
                        <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{meta.stats}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: 1/3 — Phone mockup */}
            <div className="col-span-1 flex justify-center pt-2">
              <div className="sticky top-6">
                <PhoneMockup
                  channel={selectedChannel}
                  message={currentMessage}
                  brandName="Xeno Brand"
                  isRefining={isRefining}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Fixed bottom bar ── */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
          <div className="max-w-7xl mx-auto px-6 py-3">
            {/* Chips */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {REFINE_CHIPS.map(chip => (
                <button
                  key={chip}
                  onClick={() => handleRefine(chip)}
                  disabled={isRefining || isLaunching}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-full hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-40 transition-all"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Input + actions */}
            <div className="flex items-center gap-3">
              <div className={`flex-1 flex items-center gap-2 rounded-xl border px-4 py-2.5 transition-all ${
                isRefining ? 'border-indigo-300 bg-indigo-50/40' : 'border-gray-200 bg-white focus-within:border-indigo-400'
              }`}>
                {isRefining
                  ? <Loader2 className="h-3.5 w-3.5 text-indigo-400 animate-spin shrink-0" />
                  : <Sparkles className="h-3.5 w-3.5 text-gray-300 shrink-0" />}
                <input
                  value={modifier}
                  onChange={e => setModifier(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRefine()}
                  disabled={isRefining || isLaunching}
                  placeholder={isRefining ? 'AI is rewriting your copy…' : 'Tell Xeno how you\'d like to improve this campaign…'}
                  className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none disabled:cursor-not-allowed"
                />
                <button
                  onClick={() => handleRefine()}
                  disabled={!modifier.trim() || isRefining}
                  className="h-7 w-7 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center disabled:opacity-30 shrink-0 transition-all"
                >
                  {isRefining
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Send className="h-3 w-3" />}
                </button>
              </div>

              <button
                onClick={() => router.push('/opportunities')}
                disabled={isLaunching}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-500 border border-gray-200 rounded-xl hover:text-red-500 hover:border-red-200 disabled:opacity-40 transition-all shrink-0"
              >
                <X className="h-4 w-4" /> Discard
              </button>

              <button
                onClick={handleApproveAndLaunch}
                disabled={isLaunching || isRefining}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-indigo-700 hover:bg-indigo-800 rounded-xl disabled:opacity-50 transition-all shrink-0"
                style={{ boxShadow: '0 4px 14px 0 rgba(99,102,241,0.4)' }}
              >
                {isLaunching
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Launching…</>
                  : <><Rocket className="h-4 w-4" /> Approve &amp; Launch</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: list mode ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-16">
      <div className="max-w-6xl mx-auto px-6 py-8">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Campaigns</h1>
            <p className="text-sm text-gray-400 mt-1">All your AI-generated campaigns</p>
          </div>
          <button
            onClick={() => router.push('/opportunities')}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Opportunities
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {campaigns.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center shadow-sm">
            <Sparkles className="h-10 w-10 text-indigo-300 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-gray-900 mb-1">No campaigns yet</h2>
            <p className="text-sm text-gray-400 mb-5">Create your first campaign from an opportunity</p>
            <button
              onClick={() => router.push('/opportunities')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all"
            >
              <Target className="h-4 w-4" /> View Opportunities
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            {/* Campaign list */}
            <div className="col-span-1 space-y-3">
              {campaigns.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCampaign(c)}
                  className={`w-full rounded-xl border p-4 text-left transition-all ${
                    selectedCampaign?.id === c.id
                      ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-indigo-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-sm font-bold text-gray-900 leading-snug">{c.name}</span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusStyles(c.status)}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">{c.channel} · {c.audience_size ?? 0} customers</div>
                </button>
              ))}
            </div>

            {/* Campaign detail */}
            {selectedCampaign && (
              <div className="col-span-2 space-y-5">
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{selectedCampaign.name}</h2>
                      <p className="text-sm text-gray-400 mt-0.5">{selectedCampaign.objective}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles(selectedCampaign.status)}`}>
                      {selectedCampaign.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <StatCard label="Channel" value={selectedCampaign.channel} />
                    <StatCard label="Audience" value={`${selectedCampaign.audience_size ?? 0}`} />
                    <StatCard label="Sent" value={`${selectedCampaign.communications_sent ?? 0}`} />
                  </div>

                  <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 mb-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Message Content</div>
                    <pre className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-sans">{selectedCampaign.message_content}</pre>
                  </div>

                  {selectedCampaign.reasoning && (
                    <p className="text-xs text-gray-400 italic border-l-2 border-indigo-100 pl-3">{selectedCampaign.reasoning}</p>
                  )}

                  {selectedCampaign.status === 'Draft' && (
                    <div className="flex gap-3 mt-5">
                      <button
                        onClick={async () => {
                          try {
                            await approveCampaign(selectedCampaign.id);
                            loadCampaigns();
                          } catch {}
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all"
                      >
                        <Check className="h-4 w-4" /> Approve
                      </button>
                    </div>
                  )}
                  {selectedCampaign.status === 'Approved' && (
                    <div className="flex gap-3 mt-5">
                      <button
                        onClick={async () => {
                          try {
                            await launchCampaign(selectedCampaign.id);
                            loadCampaigns();
                          } catch {}
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all"
                      >
                        <Rocket className="h-4 w-4" /> Launch
                      </button>
                    </div>
                  )}
                  {selectedCampaign.status === 'Launched' && (
                    <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" /> Campaign is live!
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricChip({ icon: Icon, label, accent }: { icon: React.ElementType; label: string; accent?: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium shadow-sm ${
      accent ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-700'
    }`}>
      <Icon className={`h-4 w-4 ${accent ? 'text-indigo-500' : 'text-gray-400'}`} />
      {label}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{label}</div>
      <div className="text-sm font-bold text-gray-900">{value}</div>
    </div>
  );
}

export default function CampaignsPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    }>
      <CampaignsContent />
    </Suspense>
  );
}
