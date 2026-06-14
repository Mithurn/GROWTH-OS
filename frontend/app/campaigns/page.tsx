'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Check,
  Rocket,
  Sparkles,
  Target,
  Users,
  ArrowLeft,
  Edit,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  generateCampaign,
  saveCampaign,
  getCampaigns,
  approveCampaign,
  launchCampaign,
  getOpportunityDashboard,
} from '@/lib/api';

interface Campaign {
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
  created_at: string;
  audience_size: number;
  communications_sent: number;
  communications_delivered: number;
  communications_read: number;
  communications_clicked: number;
  communications_failed: number;
}

interface GeneratedCampaign {
  name: string;
  objective: string;
  channel: 'WhatsApp' | 'Email' | 'SMS';
  offer: string;
  message_angle: string;
  campaign_content: string;
  expected_outcome: string;
  reasoning: string;
}

interface Opportunity {
  opportunity_id: string;
  title: string;
  description: string;
  audience_size: number;
  potential_revenue: number;
}

function statusStyles(status: string) {
  switch (status) {
    case 'Approved':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'Launched':
      return 'border-blue-200 bg-blue-50 text-blue-800';
    case 'Completed':
      return 'border-stone-200 bg-stone-100 text-stone-700';
    default: // Draft
      return 'border-amber-200 bg-amber-50 text-amber-800';
  }
}

function channelIcon(channel: string) {
  switch (channel) {
    case 'WhatsApp':
      return '💬';
    case 'Email':
      return '📧';
    case 'SMS':
      return '📱';
    default:
      return '📢';
  }
}

export default function CampaignsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const opportunityId = searchParams.get('opportunityId');

  const [companyId, setCompanyId] = useState<string | undefined>(undefined);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [generatedCampaign, setGeneratedCampaign] = useState<GeneratedCampaign | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedCampaign, setEditedCampaign] = useState<GeneratedCampaign | null>(null);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load company ID
  useEffect(() => {
    async function loadCompanyId() {
      let storedCompanyId = window.localStorage.getItem('xeno_company_id');
      console.log('Loading companyId from localStorage:', storedCompanyId);

      if (!storedCompanyId) {
        // Auto-fetch from backend
        console.log('CompanyId not in localStorage, fetching from backend...');
        try {
          const response = await fetch('http://localhost:3001/api/opportunities');
          const data = await response.json();
          if (data.success && data.data.companyId) {
            storedCompanyId = data.data.companyId;
            window.localStorage.setItem('xeno_company_id', storedCompanyId as string);
            console.log('Auto-set companyId:', storedCompanyId);
          }
        } catch (err) {
          console.error('Failed to fetch companyId:', err);
        }
      }

      if (storedCompanyId) {
        setCompanyId(storedCompanyId);
      } else {
        setError('Company ID not found. Please complete onboarding first.');
      }
    }

    loadCompanyId();
  }, []);

  // Load campaigns
  useEffect(() => {
    if (!companyId) return;

    async function loadCampaigns() {
      try {
        setLoading(true);
        const response = await getCampaigns(companyId);
        setCampaigns(response.data ?? []);
      } catch (err) {
        console.error('Failed to load campaigns:', err);
        setError(err instanceof Error ? err.message : 'Failed to load campaigns');
      } finally {
        setLoading(false);
      }
    }

    loadCampaigns();
  }, [companyId]);

  // Load opportunity if provided
  useEffect(() => {
    if (!opportunityId || !companyId) {
      console.log('Skipping opportunity load:', { opportunityId, companyId });
      return;
    }

    async function loadOpportunity() {
      try {
        console.log('Loading opportunity dashboard for companyId:', companyId);
        const response = await getOpportunityDashboard(companyId);
        console.log('Opportunities loaded:', response.data.opportunityDistribution.length);

        const opp = response.data.opportunityDistribution.find(
          (o: any) => o.opportunity_id === opportunityId
        );

        console.log('Found opportunity:', opp ? opp.title : 'NOT FOUND');

        if (opp) {
          setOpportunity(opp);
        } else {
          setError(`Opportunity ${opportunityId} not found`);
        }
      } catch (err) {
        console.error('Failed to load opportunity:', err);
        setError(err instanceof Error ? err.message : 'Failed to load opportunity');
      }
    }

    loadOpportunity();
  }, [opportunityId, companyId]);

  async function handleGenerateCampaign() {
    if (!opportunityId) return;

    try {
      setGenerating(true);
      setError(null);
      const response = await generateCampaign(opportunityId, companyId);
      const campaign = response.data.campaign;
      setGeneratedCampaign(campaign);
      setEditedCampaign(campaign);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate campaign');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveCampaign() {
    if (!opportunityId || !editedCampaign) {
      console.log('Cannot save: missing opportunityId or editedCampaign');
      return;
    }

    try {
      console.log('Saving campaign...', { opportunityId, campaign: editedCampaign });
      setLoading(true);
      setError(null);
      const response = await saveCampaign(opportunityId, editedCampaign, companyId);
      console.log('Campaign saved:', response.data);
      const newCampaign = response.data;

      // Reload campaigns
      console.log('Reloading campaigns list...');
      const campaignsResponse = await getCampaigns(companyId);
      setCampaigns(campaignsResponse.data ?? []);
      setSelectedCampaign(newCampaign);
      setGeneratedCampaign(null);
      setIsEditing(false);
      console.log('Save complete!');
    } catch (err) {
      console.error('Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save campaign');
    } finally {
      console.log('Clearing loading state');
      setLoading(false);
    }
  }

  async function handleApproveCampaign(campaignId: string) {
    try {
      setApproving(true);
      setError(null);
      await approveCampaign(campaignId);

      // Reload campaigns
      const response = await getCampaigns(companyId);
      setCampaigns(response.data ?? []);
      const updated = response.data.find((c: Campaign) => c.id === campaignId);
      if (updated) {
        setSelectedCampaign(updated);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve campaign');
    } finally {
      setApproving(false);
    }
  }

  async function handleLaunchCampaign(campaignId: string) {
    try {
      setLaunching(true);
      setError(null);
      const response = await launchCampaign(campaignId);

      // Reload campaigns
      const campaignsResponse = await getCampaigns(companyId);
      setCampaigns(campaignsResponse.data ?? []);
      const updated = campaignsResponse.data.find((c: Campaign) => c.id === campaignId);
      if (updated) {
        setSelectedCampaign(updated);
      }

      alert(`Campaign launched! ${response.data.communications_created} communications created.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to launch campaign');
    } finally {
      setLaunching(false);
    }
  }

  if (loading && campaigns.length === 0 && !opportunityId) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.22),_transparent_35%),linear-gradient(180deg,#fff9ed_0%,#ffffff_40%,#fffdf8_100%)] flex items-center justify-center">
        <p className="text-stone-600">Loading campaigns...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.22),_transparent_35%),linear-gradient(180deg,#fff9ed_0%,#ffffff_40%,#fffdf8_100%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-10 lg:px-8">
        {/* Header */}
        <div className="rounded-3xl border border-amber-200/80 bg-gradient-to-br from-amber-100 via-white to-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="mb-2 text-sm font-medium uppercase tracking-[0.24em] text-amber-700">
                Campaign Studio
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-stone-950">
                {opportunityId && opportunity
                  ? `Create Campaign: ${opportunity.title}`
                  : 'Campaign Management'}
              </h1>
              <p className="mt-3 text-base text-stone-600">
                {opportunityId
                  ? 'AI-powered campaign generation from detected opportunities.'
                  : 'Manage and monitor your marketing campaigns.'}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => router.push('/opportunities')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Opportunities
              </Button>
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}
        </div>

        {/* Generate Campaign from Opportunity */}
        {opportunityId && !generatedCampaign && (
          <Card>
            <CardHeader>
              <CardTitle>Generate Campaign</CardTitle>
              <CardDescription>
                AI will generate a campaign plan based on the opportunity details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {opportunity ? (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="text-xs uppercase tracking-wide text-stone-500">Opportunity</div>
                    <div className="mt-2 text-sm font-medium text-stone-950">{opportunity.title}</div>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="text-xs uppercase tracking-wide text-stone-500">Audience Size</div>
                    <div className="mt-2 text-sm font-medium text-stone-950">
                      {opportunity.audience_size} customers
                    </div>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="text-xs uppercase tracking-wide text-stone-500">Revenue Potential</div>
                    <div className="mt-2 text-sm font-medium text-stone-950">
                      ₹{Math.round(opportunity.potential_revenue).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  Loading opportunity details...
                </div>
              )}

              <Button onClick={handleGenerateCampaign} disabled={generating} className="w-full">
                <Sparkles className={`mr-2 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
                {generating ? 'Generating Campaign...' : 'Generate Campaign with AI'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Campaign Preview/Edit */}
        {generatedCampaign && editedCampaign && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Campaign Preview</CardTitle>
                  <CardDescription>Review and edit the AI-generated campaign</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? <Eye className="mr-2 h-4 w-4" /> : <Edit className="mr-2 h-4 w-4" />}
                  {isEditing ? 'Preview' : 'Edit'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {isEditing ? (
                  <>
                    <div>
                      <label className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        Campaign Name
                      </label>
                      <input
                        type="text"
                        value={editedCampaign.name}
                        onChange={(e) => setEditedCampaign({ ...editedCampaign, name: e.target.value })}
                        className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        Channel
                      </label>
                      <select
                        value={editedCampaign.channel}
                        onChange={(e) =>
                          setEditedCampaign({
                            ...editedCampaign,
                            channel: e.target.value as 'WhatsApp' | 'Email' | 'SMS',
                          })
                        }
                        className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-2 text-sm"
                      >
                        <option value="WhatsApp">WhatsApp</option>
                        <option value="Email">Email</option>
                        <option value="SMS">SMS</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        Objective
                      </label>
                      <textarea
                        value={editedCampaign.objective}
                        onChange={(e) =>
                          setEditedCampaign({ ...editedCampaign, objective: e.target.value })
                        }
                        className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-2 text-sm"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        Offer
                      </label>
                      <input
                        type="text"
                        value={editedCampaign.offer}
                        onChange={(e) => setEditedCampaign({ ...editedCampaign, offer: e.target.value })}
                        className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        Message Angle
                      </label>
                      <input
                        type="text"
                        value={editedCampaign.message_angle}
                        onChange={(e) =>
                          setEditedCampaign({ ...editedCampaign, message_angle: e.target.value })
                        }
                        className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-2 text-sm"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        Message Content
                      </label>
                      <textarea
                        value={editedCampaign.campaign_content}
                        onChange={(e) =>
                          setEditedCampaign({ ...editedCampaign, campaign_content: e.target.value })
                        }
                        className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-2 text-sm font-mono"
                        rows={4}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        Expected Outcome
                      </label>
                      <input
                        type="text"
                        value={editedCampaign.expected_outcome}
                        onChange={(e) =>
                          setEditedCampaign({ ...editedCampaign, expected_outcome: e.target.value })
                        }
                        className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        Reasoning
                      </label>
                      <textarea
                        value={editedCampaign.reasoning}
                        onChange={(e) =>
                          setEditedCampaign({ ...editedCampaign, reasoning: e.target.value })
                        }
                        className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-2 text-sm"
                        rows={2}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-2xl border border-stone-200 bg-white p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        Campaign Name
                      </div>
                      <p className="mt-2 text-sm font-medium text-stone-950">{editedCampaign.name}</p>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-white p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        Channel
                      </div>
                      <p className="mt-2 text-sm font-medium text-stone-950">
                        {channelIcon(editedCampaign.channel)} {editedCampaign.channel}
                      </p>
                    </div>
                    <div className="md:col-span-2 rounded-2xl border border-stone-200 bg-white p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        Objective
                      </div>
                      <p className="mt-2 text-sm text-stone-700">{editedCampaign.objective}</p>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-white p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-stone-500">Offer</div>
                      <p className="mt-2 text-sm text-stone-700">{editedCampaign.offer}</p>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-white p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        Message Angle
                      </div>
                      <p className="mt-2 text-sm text-stone-700">{editedCampaign.message_angle}</p>
                    </div>
                    <div className="md:col-span-2 rounded-2xl border border-stone-200 bg-stone-50 p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        Message Content
                      </div>
                      <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-950">
                        {editedCampaign.campaign_content}
                      </pre>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-white p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        Expected Outcome
                      </div>
                      <p className="mt-2 text-sm text-stone-700">{editedCampaign.expected_outcome}</p>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-white p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        Reasoning
                      </div>
                      <p className="mt-2 text-sm text-stone-700">{editedCampaign.reasoning}</p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3">
                <Button onClick={handleSaveCampaign} disabled={loading} className="flex-1">
                  <Check className="mr-2 h-4 w-4" />
                  {loading ? 'Saving...' : 'Save as Draft'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setGeneratedCampaign(null);
                    setEditedCampaign(null);
                    setIsEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Campaigns List */}
        {campaigns.length > 0 && !generatedCampaign && (
          <div className="grid gap-6 lg:grid-cols-[400px_minmax(0,1fr)]">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Your Campaigns</CardTitle>
                <CardDescription>All created campaigns across opportunities</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {campaigns.map((campaign) => (
                  <button
                    key={campaign.id}
                    onClick={() => setSelectedCampaign(campaign)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selectedCampaign?.id === campaign.id
                        ? 'border-amber-400 bg-amber-50 shadow-sm'
                        : 'border-stone-200 bg-white hover:border-amber-200 hover:bg-amber-50/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-semibold text-stone-950">{campaign.name}</div>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusStyles(campaign.status)}`}
                          >
                            {campaign.status}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-stone-600">
                          {channelIcon(campaign.channel)} {campaign.channel}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-stone-500">
                      <div>
                        <div className="uppercase tracking-wide">Audience</div>
                        <div className="mt-1 text-sm font-medium text-stone-900">
                          {campaign.audience_size} customers
                        </div>
                      </div>
                      <div>
                        <div className="uppercase tracking-wide">Sent</div>
                        <div className="mt-1 text-sm font-medium text-stone-900">
                          {campaign.communications_sent}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Campaign Detail */}
            {selectedCampaign && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedCampaign.name}</CardTitle>
                      <CardDescription>{selectedCampaign.objective}</CardDescription>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${statusStyles(selectedCampaign.status)}`}
                    >
                      {selectedCampaign.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-stone-500">
                        <Target className="h-3.5 w-3.5" />
                        Channel
                      </div>
                      <div className="mt-2 text-sm font-medium text-stone-950">
                        {channelIcon(selectedCampaign.channel)} {selectedCampaign.channel}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-stone-500">
                        <Users className="h-3.5 w-3.5" />
                        Audience
                      </div>
                      <div className="mt-2 text-sm font-medium text-stone-950">
                        {selectedCampaign.audience_size}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-stone-500">
                        Sent
                      </div>
                      <div className="mt-2 text-sm font-medium text-stone-950">
                        {selectedCampaign.communications_sent}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-stone-500">
                        Delivered
                      </div>
                      <div className="mt-2 text-sm font-medium text-stone-950">
                        {selectedCampaign.communications_delivered}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-stone-200 bg-white p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-stone-500">
                      Message Content
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                      {selectedCampaign.message_content}
                    </pre>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-stone-200 bg-white p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-stone-500">Offer</div>
                      <p className="mt-2 text-sm text-stone-700">{selectedCampaign.offer}</p>
                    </div>
                    <div className="rounded-2xl border border-stone-200 bg-white p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        Expected Outcome
                      </div>
                      <p className="mt-2 text-sm text-stone-700">{selectedCampaign.expected_outcome}</p>
                    </div>
                  </div>

                  {selectedCampaign.reasoning && (
                    <div className="rounded-2xl border border-stone-200 bg-white p-4">
                      <div className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        Reasoning
                      </div>
                      <p className="mt-2 text-sm text-stone-700">{selectedCampaign.reasoning}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-3">
                    {selectedCampaign.status === 'Draft' && (
                      <Button
                        onClick={() => handleApproveCampaign(selectedCampaign.id)}
                        disabled={approving}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        {approving ? 'Approving...' : 'Approve Campaign'}
                      </Button>
                    )}
                    {selectedCampaign.status === 'Approved' && (
                      <Button
                        onClick={() => handleLaunchCampaign(selectedCampaign.id)}
                        disabled={launching}
                      >
                        <Rocket className="mr-2 h-4 w-4" />
                        {launching ? 'Launching...' : 'Launch Campaign'}
                      </Button>
                    )}
                    {selectedCampaign.status === 'Launched' && (
                      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                        Campaign is live! Communications are being sent.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {campaigns.length === 0 && !opportunityId && !generatedCampaign && (
          <Card>
            <CardHeader>
              <CardTitle>No campaigns yet</CardTitle>
              <CardDescription>
                Create your first campaign from an opportunity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/opportunities')}>
                <Target className="mr-2 h-4 w-4" />
                View Opportunities
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
