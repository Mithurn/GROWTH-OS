'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  TrendingUp,
  Sparkles,
  MessageCircle,
  Mail,
  Smartphone,
  CheckCircle2,
  XCircle,
  Send,
  Loader2,
  RefreshCw,
  ShoppingBag
} from 'lucide-react';
import { generateCampaign, getOpportunityCustomers, saveCampaign, refineCampaign } from '@/lib/api';
import type { GeneratedCampaign, Opportunity } from '@/lib/types';

function formatCurrency(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${Math.round(value)}`;
}

export default function CampaignReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const opportunityId = resolvedParams.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [campaign, setCampaign] = useState<GeneratedCampaign | null>(null);
  
  const [chatQuery, setChatQuery] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Use state to track the active channel
  const [activeChannel, setActiveChannel] = useState<'WhatsApp' | 'Email' | 'SMS'>('WhatsApp');

  useEffect(() => {
    async function init() {
      try {
        // Fetch opportunity
        const oppRes = await getOpportunityCustomers(opportunityId);
        if (!oppRes.success) throw new Error('Failed to load opportunity');
        setOpportunity(oppRes.data.opportunity);

        // Generate campaign draft
        const campRes = await generateCampaign(opportunityId);
        if (!campRes.success) throw new Error('Failed to generate campaign');
        
        setCampaign(campRes.data.campaign);
        setActiveChannel(campRes.data.campaign.channel || 'WhatsApp');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [opportunityId]);

  /**
   * `generateCampaign` hands back an unsaved draft with no id, but the refine endpoint
   * rewrites a stored row. So the draft has to be persisted before it can be refined.
   * `saveCampaign` is idempotent per opportunity — it returns the existing row rather
   * than inserting a second one — so calling it repeatedly is safe.
   */
  const persistDraft = async (draft: GeneratedCampaign): Promise<string> => {
    if (draft.id) return draft.id;
    const saveRes = await saveCampaign(opportunityId, draft);
    if (!saveRes.success) throw new Error('Failed to save campaign');
    return saveRes.data.id as string;
  };

  const applyRefinement = async (modifier: string) => {
    if (!campaign) return;
    setIsRefining(true);
    try {
      const campaignId = await persistDraft(campaign);
      const result = await refineCampaign(campaignId, modifier, campaign.channel);
      setCampaign({ ...campaign, id: campaignId, campaign_content: result.data.message_content });
      setChatQuery('');
    } finally {
      setIsRefining(false);
    }
  };

  const handleRefine = async () => {
    if (!chatQuery.trim() || !campaign) return;
    try {
      await applyRefinement(chatQuery.trim());
    } catch (err) {
      console.error('Refine failed:', err);
      setError(err instanceof Error ? err.message : 'Could not refine the message');
    }
  };

  const handleApprove = async () => {
    if (!campaign) return;
    try {
      setIsSaving(true);
      await persistDraft(campaign);
      router.push('/opportunities');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center flex-col gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#5B4FFF]" />
        <p className="text-[#6B7280] font-medium text-sm animate-pulse">
          GrowthOS is generating your campaign strategy...
        </p>
      </div>
    );
  }

  if (error || !opportunity || !campaign) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6 text-center">
        <div>
          <h2 className="text-xl font-bold text-red-600 mb-2">Failed to load campaign</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link href={`/opportunities/${opportunityId}`} className="text-[#5B4FFF] font-medium hover:underline">
            Go back to Opportunity
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col font-sans">
      
      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left Side: Strategy */}
        <div className="w-1/2 p-6 lg:p-8 overflow-y-auto border-r border-[#E5E7EB] bg-white">
          <div className="max-w-lg mx-auto">
            
            <h1 className="text-3xl font-extrabold text-[#1A1A1A] tracking-tight mb-2">
              {campaign.name}
            </h1>
            <div className="flex items-center gap-2 text-[#6B7280] text-sm font-medium mb-6">
              <TrendingUp className="h-4 w-4 text-[#5B4FFF]" />
              Generated from {opportunity.title}
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="rounded-xl border border-[#E5E7EB] p-3 bg-[#FAFAFA]">
                <div className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-1">Audience Size</div>
                <div className="text-xl font-bold text-[#1A1A1A]">{opportunity.audience_size}</div>
              </div>
              <div className="rounded-xl border border-[#E5E7EB] p-3 bg-[#FAFAFA]">
                <div className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-1">Projected Rev</div>
                <div className="text-xl font-bold text-[#5B4FFF]">{formatCurrency(opportunity.potential_revenue)}</div>
              </div>
              <div className="rounded-xl border border-[#E5E7EB] p-3 bg-[#FAFAFA]">
                <div className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-1">Conversion</div>
                <div className="text-xl font-bold text-[#10B981]">14%</div>
              </div>
            </div>

            {/* Reasoning */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-[#9CA3AF]" />
                <h3 className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider">Why I created this campaign</h3>
              </div>
              <div className="bg-[#F8F9FE] rounded-2xl p-4 border border-[#EEF2FF] text-[#4B5563] text-sm leading-relaxed">
                {campaign.reasoning}
              </div>
            </div>

            {/* Channel Strategy */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="h-4 w-4 text-[#9CA3AF]" />
                <h3 className="text-xs font-bold text-[#9CA3AF] uppercase tracking-wider">Channel Strategy</h3>
              </div>
              
              <div className="space-y-3">
                {/* WhatsApp */}
                <div 
                  className={`rounded-2xl border-2 p-3 cursor-pointer transition-all ${activeChannel === 'WhatsApp' ? 'border-[#5B4FFF] bg-[#FAFAFA]' : 'border-[#E5E7EB] hover:border-[#D1D5DB]'}`}
                  onClick={() => setActiveChannel('WhatsApp')}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-[#E5F5E9] flex items-center justify-center text-[#10B981]">
                        <MessageCircle className="h-4 w-4" />
                      </div>
                      <span className="font-bold text-[#1A1A1A]">WhatsApp</span>
                    </div>
                    {activeChannel === 'WhatsApp' ? (
                      <span className="bg-[#5B4FFF] text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Selected
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-[#6B7280] ml-11">
                    High engagement priority. 85% open rate expected. Ideal for time-sensitive voucher drops.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Email */}
                  <div 
                    className={`rounded-2xl border border-[#E5E7EB] p-3 cursor-pointer transition-all opacity-70 hover:opacity-100 ${activeChannel === 'Email' ? 'border-[#5B4FFF]' : ''}`}
                    onClick={() => setActiveChannel('Email')}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Mail className="h-4 w-4 text-[#9CA3AF]" />
                      <span className="font-bold text-[#1A1A1A] text-sm">Email</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#EF4444]">
                      <XCircle className="h-3 w-3" /> Rejected: Low open rate
                    </div>
                  </div>

                  {/* SMS */}
                  <div 
                    className={`rounded-2xl border border-[#E5E7EB] p-3 cursor-pointer transition-all opacity-70 hover:opacity-100 ${activeChannel === 'SMS' ? 'border-[#5B4FFF]' : ''}`}
                    onClick={() => setActiveChannel('SMS')}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Smartphone className="h-4 w-4 text-[#9CA3AF]" />
                      <span className="font-bold text-[#1A1A1A] text-sm">SMS</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#EF4444]">
                      <XCircle className="h-3 w-3" /> Rejected: Character limit
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>

        {/* Right Side: Preview */}
        <div className="w-1/2 bg-[#F8F9FE] p-6 lg:p-8 overflow-y-auto flex flex-col items-center justify-start relative pb-32">
          
          {/* Phone Mockup */}
          <div className="w-[280px] h-[560px] bg-[#E7E5E4] rounded-[36px] p-2 shadow-xl relative mt-4 mb-6 flex-shrink-0 ring-1 ring-gray-900/5">
            <div className="w-full h-full bg-[#EFEAE2] rounded-[28px] overflow-hidden flex flex-col relative border border-[#D6D3D1]">
              
              {/* Dynamic Header based on Channel */}
              {activeChannel === 'WhatsApp' && (
                <div className="bg-[#075E54] text-white px-3 py-2 flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-[15px]">X</div>
                  <div>
                    <div className="font-bold text-[14px] leading-tight">Your Brand</div>
                    <div className="text-[10px] text-white/80">Verified Business</div>
                  </div>
                </div>
              )}
              {activeChannel === 'SMS' && (
                <div className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#1A1A1A] px-3 py-2 flex items-center justify-between">
                  <ArrowLeft className="h-4 w-4 text-[#007AFF]" />
                  <div className="flex flex-col items-center">
                    <div className="h-6 w-6 rounded-full bg-[#E5E7EB] flex items-center justify-center text-[10px] text-[#6B7280] font-bold">X</div>
                    <div className="text-[10px] font-medium text-[#1A1A1A]">Your Brand</div>
                  </div>
                  <div className="w-4"></div>
                </div>
              )}
              {activeChannel === 'Email' && (
                <div className="bg-white border-b border-[#E5E7EB] text-[#1A1A1A] px-3 py-2 flex flex-col gap-1">
                  <div className="flex items-center justify-between mb-1">
                    <ArrowLeft className="h-4 w-4 text-[#4B5563]" />
                    <div className="flex gap-2 text-[#4B5563]">
                      <span className="w-4 h-4 rounded-full bg-[#E5E7EB]" />
                      <span className="w-4 h-4 rounded-full bg-[#E5E7EB]" />
                    </div>
                  </div>
                  <div className="text-[14px] font-bold truncate">{campaign.name || 'Your Offer'}</div>
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="font-bold bg-[#F3F4F6] px-1 rounded">Your Brand</span>
                    <span className="text-[#6B7280]">to you</span>
                  </div>
                </div>
              )}

              {/* Chat Area */}
              <div className={`flex-1 p-3 flex flex-col overflow-y-auto ${activeChannel === 'WhatsApp' ? "bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-cover" : "bg-white"}`}>
                
                <div className="flex justify-center mb-3">
                  <span className="bg-[#E0E7FF] text-[#5B4FFF] text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Generated by AI
                  </span>
                </div>

                {/* Message Bubble */}
                <div className={`${activeChannel === 'WhatsApp' ? 'bg-white rounded-xl rounded-tl-none shadow-sm' : activeChannel === 'SMS' ? 'bg-[#E5E5EA] rounded-2xl rounded-tl-md shadow-none self-start text-[#1A1A1A]' : 'bg-transparent text-[#1A1A1A]'} p-2 w-[92%]`}>
                  <textarea
                    value={campaign.campaign_content || ''}
                    onChange={(e) => setCampaign({ ...campaign, campaign_content: e.target.value })}
                    className="w-full text-[13px] text-[#1A1A1A] whitespace-pre-wrap leading-relaxed p-1.5 bg-transparent resize-none focus:outline-none focus:ring-1 focus:ring-[#5B4FFF]/20 rounded-lg transition-all"
                    rows={8}
                  />
                  
                  {/* Link Preview inside bubble */}
                  {activeChannel !== 'SMS' && (
                    <div className="mt-1 rounded-lg bg-[#F3F4F6] overflow-hidden">
                      <div className="h-20 bg-[#D1D5DB] flex items-center justify-center text-white">
                        <ShoppingBag className="h-6 w-6 opacity-50" />
                      </div>
                      <div className="p-2 bg-[#E5E7EB]">
                        <div className="font-bold text-[12px] text-[#1A1A1A] truncate">{campaign.offer || 'Exclusive Offer'}</div>
                        <div className="text-[10px] text-[#6B7280]">yourbrand.com/offer</div>
                      </div>
                    </div>
                  )}

                  {activeChannel !== 'Email' && (
                    <div className="text-[9px] text-[#9CA3AF] text-right mt-1 pr-1">
                      10:42 AM
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            {['Make more premium', 'Increase urgency', 'Shorter copy'].map((action) => (
              <button
                key={action}
                onClick={async () => {
                  if (isRefining) return;
                  try {
                    await applyRefinement(action);
                  } catch (err) {
                    console.error('Refine failed:', err);
                  }
                }}
                disabled={isRefining}
                className="bg-white border border-[#E5E7EB] text-[#4B5563] text-[11px] font-semibold px-3 py-1.5 rounded-full shadow-sm hover:border-[#5B4FFF]/50 hover:text-[#5B4FFF] transition-colors disabled:opacity-50"
              >
                {action}
              </button>
            ))}
          </div>

          {/* Floating Action Bar */}
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-[#EEF2FF] p-2 pr-4 rounded-2xl shadow-xl z-50">
            
            <div className="relative group w-[400px]">
              <div className="relative flex items-center p-1.5 pl-3 bg-white rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-[#5B4FFF]/50 transition-all">
                <Sparkles className="h-4 w-4 text-[#5B4FFF] mr-2" />
                <input
                  type="text"
                  value={chatQuery}
                  onChange={(e) => setChatQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRefine(); }}
                  placeholder="Tell GrowthOS how you'd like to improve this campaign..."
                  className="flex-1 bg-transparent text-sm text-[#1A1A1A] placeholder:text-[#9CA3AF] outline-none"
                  disabled={isRefining}
                />
                <button
                  onClick={handleRefine}
                  disabled={!chatQuery.trim() || isRefining}
                  className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${
                    chatQuery.trim() && !isRefining ? 'bg-[#EEF2FF] text-[#5B4FFF] hover:bg-[#5B4FFF] hover:text-white' : 'bg-[#F3F4F6] text-[#9CA3AF]'
                  }`}
                >
                  {isRefining ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3 ml-0.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button 
                onClick={() => router.push(`/opportunities/${opportunityId}`)}
                className="text-xs font-bold text-[#C53030] hover:text-red-700 transition-colors tracking-wider uppercase"
              >
                DISCARD
              </button>

              <button 
                onClick={handleApprove}
                disabled={isSaving}
                className="px-6 py-2.5 bg-[#5B4FFF] hover:bg-[#4B3FE5] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 uppercase tracking-wider whitespace-nowrap"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Approve & Launch
              </button>
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}
