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
  rejectCampaign,
  launchCampaign,
  getOpportunityDashboard,
  refineCampaign,
} from '@/lib/api';
import type { CampaignWithMetrics } from '@/lib/types';
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
  case_status?: string | null;
  reviewer_report?: unknown;
  case_evidence?: unknown;
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
  const [alreadyLaunchedId, setAlreadyLaunchedId] = useState<string | null>(null);
  const [isLaunched, setIsLaunched] = useState(false);
  const [launchBarWidth, setLaunchBarWidth] = useState(0);
  const [showLaunchModal, setShowLaunchModal] = useState(false);


  // ── Builder mode: load opportunity + campaign ──
  const loadBuilderData = useCallback(async () => {
    if (!opportunityId) return;
    setLoading(true);
    setError(null);
    try {
      const [dashRes, campaignsRes] = await Promise.all([
        getOpportunityDashboard(),
        getCampaigns(),
      ]);

      const opp = (dashRes.data.opportunityDistribution ?? []).find(
        (o: Opportunity) => o.opportunity_id === opportunityId,
      );
      if (!opp) { setError('Opportunity not found.'); return; }
      setOpportunity(opp);

      const existing = (campaignsRes.data ?? []).find(
        (c: CampaignWithMetrics) => c.opportunity_id === opportunityId,
      );

      if (existing) {
        if (existing.status === 'Launched') {
          setAlreadyLaunchedId(existing.id);
          setLoading(false);
          setTimeout(() => router.push(`/analytics?campaignId=${existing.id}`), 2500);
          return;
        }
        setSavedCampaign(existing);
        setCurrentMessage(existing.message_content);
        setSelectedChannel((existing.channel as Channel) ?? 'WhatsApp');
      } else {
        setIsGenerating(true);
        const genRes = await generateCampaign(opportunityId);
        const draft = genRes.data.campaign;
        const saveRes = await saveCampaign(opportunityId, draft);
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
  }, [opportunityId]);

  // ── List mode: load campaigns ──
  const loadCampaigns = useCallback(async () => {
    if (opportunityId) return;
    setLoading(true);
    try {
      const res = await getCampaigns();
      const list = res.data ?? [];
      setCampaigns(list);
      if (list.length > 0) setSelectedCampaign(list[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [opportunityId]);

  useEffect(() => {
    if (opportunityId) loadBuilderData();
    else loadCampaigns();
  }, [opportunityId, loadBuilderData, loadCampaigns]);

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
      // The backend warms the channel service itself before fanning out sends, so no
      // client-side wake-up delay is needed here.
      await approveCampaign(savedCampaign.id);
      await launchCampaign(savedCampaign.id);
      setIsLaunching(false);
      setIsLaunched(true);
      setTimeout(() => setLaunchBarWidth(100), 50);
      setTimeout(() => router.push(`/analytics?campaignId=${savedCampaign.id}`), 2300);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to launch campaign');
      setIsLaunching(false);
    }
  }

  // ── Render: already launched — redirect to analytics ──
  if (alreadyLaunchedId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0E1A]">
        <div className="bg-[#141929] border border-[#1E2545] rounded-2xl p-10 text-center max-w-md w-full mx-6 shadow-2xl">
          <div className="relative h-20 w-20 mx-auto mb-6">
            <div className="relative h-20 w-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="h-9 w-9 text-emerald-400" />
            </div>
          </div>
          <h2 className="text-2xl font-extrabold text-white mb-2">Already Launched</h2>
          <p className="text-[#8B92A5] text-sm mb-6">This opportunity&apos;s campaign has already been launched. Taking you to the analytics...</p>
          <div className="h-1 w-full bg-[#1E2545] rounded-full overflow-hidden">
            <div className="h-1 bg-emerald-500 rounded-full animate-[width_2.5s_ease-in-out_forwards]" style={{ width: '100%', transition: 'width 2.5s ease-in-out' }} />
          </div>
        </div>
      </div>
    );
  }

  // ── Render: launch success overlay ──
  if (isLaunched) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0E1A]">
        <div className="bg-[#141929] border border-[#1E2545] rounded-2xl p-10 text-center max-w-md w-full mx-6 shadow-2xl">
          <div className="relative h-20 w-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
            <div className="relative h-20 w-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center">
              <Rocket className="h-9 w-9 text-emerald-400" />
            </div>
          </div>
          <h2 className="text-2xl font-extrabold text-white mb-2">Campaign Launched!</h2>
          <p className="text-[#8B92A5] text-sm mb-1 font-medium">{savedCampaign?.name}</p>
          <p className="text-[#4B5069] text-xs mb-8">Messages are being dispatched to your audience</p>
          <div className="h-1 w-full bg-[#1E2545] rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all ease-linear"
              style={{ width: `${launchBarWidth}%`, transitionDuration: '2.2s' }}
            />
          </div>
          <p className="text-[#4B5069] text-xs mt-3">Redirecting to Analytics…</p>
        </div>
      </div>
    );
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

    return (
      <>
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
                  brandName="Your Brand"
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
                  placeholder={isRefining ? 'AI is rewriting your copy…' : 'Tell GrowthOS how you\'d like to improve this campaign…'}
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
                onClick={() => setShowLaunchModal(true)}
                disabled={isRefining}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-indigo-700 hover:bg-indigo-800 rounded-xl disabled:opacity-50 transition-all shrink-0"
                style={{ boxShadow: '0 4px 14px 0 rgba(99,102,241,0.4)' }}
              >
                <Rocket className="h-4 w-4" /> Approve &amp; Launch
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Launch confirmation ── */}
      {showLaunchModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => !isLaunching && setShowLaunchModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-5">
              <Rocket className="h-7 w-7 text-indigo-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Ready to go live?</h2>
            <p className="text-sm text-gray-500 mb-1">
              This will send
            </p>
            <p className="text-sm font-semibold text-gray-800 mb-4">
              {savedCampaign?.name ?? 'your campaign'}
              {savedCampaign?.audience_size ? ` to ${savedCampaign.audience_size.toLocaleString()} customers` : ''}
            </p>
            <p className="text-xs text-gray-400 mb-6 leading-relaxed">
              Messages go to the delivery simulator, not to real customers. You&apos;ll see
              sent, delivered, read and clicked events stream in as the provider acknowledges them.
            </p>
            <button
              onClick={handleApproveAndLaunch}
              disabled={isLaunching}
              className="flex items-center justify-center gap-2 w-full py-3 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors mb-3 disabled:opacity-60"
            >
              {isLaunching
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Launching…</>
                : <><Rocket className="h-4 w-4" /> Launch campaign</>}
            </button>
            <button
              onClick={() => setShowLaunchModal(false)}
              disabled={isLaunching}
              className="w-full py-2.5 text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
            >
              Not now
            </button>
          </div>
        </div>
      )}
      </>
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

                  <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${selectedCampaign.case_status === 'BLOCKED' ? 'border-red-200 bg-red-50 text-red-700' : 'border-indigo-100 bg-indigo-50 text-indigo-700'}`}>
                    <span className="font-semibold">Campaign case: </span>
                    {selectedCampaign.case_status === 'READY_FOR_APPROVAL' ? 'Scout, strategist, and reviewer completed. Owner approval is required before sending.' : selectedCampaign.case_status === 'BLOCKED' ? 'Reviewer blocked this campaign. Edit the draft to create a new review.' : 'Review is still running or unavailable.'}
                  </div>
                  {Boolean(selectedCampaign.case_evidence) && (
                    <div className="mt-3 flex gap-2 text-[11px] text-gray-500">
                      <span className="rounded-full bg-gray-100 px-2.5 py-1">Scout evidence captured</span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1">Prior campaigns retrieved: {Array.isArray((selectedCampaign.case_evidence as { priorCampaigns?: unknown[] }).priorCampaigns) ? (selectedCampaign.case_evidence as { priorCampaigns: unknown[] }).priorCampaigns.length : 0}</span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1">Human approval required</span>
                    </div>
                  )}

                  {selectedCampaign.status === 'PendingApproval' && selectedCampaign.case_status === 'READY_FOR_APPROVAL' && (
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
                      <button
                        onClick={async () => {
                          const reason = window.prompt('Why are you rejecting this campaign?') ?? '';
                          try {
                            await rejectCampaign(selectedCampaign.id, reason);
                            setSelectedCampaign(null);
                            loadCampaigns();
                          } catch {}
                        }}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-bold rounded-xl transition-all"
                      >
                        <X className="h-4 w-4" /> Reject
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
