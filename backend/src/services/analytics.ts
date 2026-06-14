import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import { openRouterConfig } from '../config/openrouter';

// ============================================
// TYPES
// ============================================

export interface IntelligenceBrief {
  generatedAt: string;
  summary: string[];
  keyInsights: string[];
  recommendation: {
    action: string;
    potentialRevenue: number;
  };
}

export interface CampaignFunnelData {
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
  failed: number;
}

export interface OpportunityPipelineData {
  detected: number;
  reviewed: number;
  campaignCreated: number;
  launched: number;
  completed: number;
}

export interface ChannelPerformance {
  channel: string;
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
  deliveryRate: number;
  readRate: number;
  clickRate: number;
}

export interface OpportunityDistribution {
  opportunityType: string;
  count: number;
  potentialRevenue: number;
  percentage: number;
}

export interface OpportunityTrendPoint {
  date: string;
  count: number;
  opportunityType?: string;
}

export interface ActivityFeedItem {
  timestamp: string;
  type: 'opportunity_detected' | 'campaign_created' | 'campaign_approved' | 'campaign_launched' | 'engagement';
  message: string;
  metadata?: any;
}

export interface RecommendedAction {
  priority: number;
  action: string;
  description: string;
  potentialRevenue: number;
  opportunityId?: string;
  campaignId?: string;
}

// ============================================
// 1. AI GROWTH INTELLIGENCE BRIEF
// ============================================

export async function generateIntelligenceBrief(
  supabase: SupabaseClient,
  companyId?: string
): Promise<IntelligenceBrief> {
  // Gather all relevant data
  const [opportunities, campaigns, communications, events] = await Promise.all([
    supabase.from('opportunities').select('*').limit(100),
    supabase.from('campaigns').select('*').limit(50),
    supabase.from('communications').select('*').limit(500),
    supabase.from('communication_events').select('*').limit(1000),
  ]);

  // Build context for AI
  const context = {
    totalOpportunities: opportunities.data?.length || 0,
    detectedOpportunities: opportunities.data?.filter(o => o.status === 'Detected').length || 0,
    totalCampaigns: campaigns.data?.length || 0,
    launchedCampaigns: campaigns.data?.filter(c => c.status === 'Launched').length || 0,
    totalCommunications: communications.data?.length || 0,
    totalEvents: events.data?.length || 0,

    // Event breakdown
    sentEvents: events.data?.filter(e => e.event_type === 'SENT').length || 0,
    deliveredEvents: events.data?.filter(e => e.event_type === 'DELIVERED').length || 0,
    readEvents: events.data?.filter(e => e.event_type === 'READ').length || 0,
    clickedEvents: events.data?.filter(e => e.event_type === 'CLICKED').length || 0,
    failedEvents: events.data?.filter(e => e.event_type === 'FAILED').length || 0,

    // Channel breakdown
    whatsappComms: communications.data?.filter(c => c.channel === 'WhatsApp').length || 0,
    emailComms: communications.data?.filter(c => c.channel === 'Email').length || 0,
    smsComms: communications.data?.filter(c => c.channel === 'SMS').length || 0,

    // Opportunity types
    opportunityTypes: opportunities.data?.reduce((acc, o) => {
      acc[o.opportunity_type] = (acc[o.opportunity_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),

    // Top unaddressed opportunity
    topOpportunity: opportunities.data
      ?.filter(o => o.status === 'Detected')
      .sort((a, b) => b.potential_revenue - a.potential_revenue)[0],
  };

  // Generate AI insights using OpenRouter
  const client = new OpenAI({
    apiKey: openRouterConfig.apiKey,
    baseURL: openRouterConfig.baseUrl,
    defaultHeaders: {
      'HTTP-Referer': openRouterConfig.httpReferer,
      'X-Title': openRouterConfig.appName,
    },
  });

  const prompt = `You are a Growth Intelligence Analyst for a retail CRM.

Analyze this data and generate a concise intelligence brief:

${JSON.stringify(context, null, 2)}

Generate a brief with:
1. 2-3 key summary points (what happened this period)
2. 2-3 key insights (what matters, patterns, performance)
3. 1 recommended next action with potential revenue

Return ONLY valid JSON in this format:
{
  "summary": ["point1", "point2"],
  "keyInsights": ["insight1", "insight2"],
  "recommendation": {
    "action": "Launch X campaign targeting Y customers",
    "potentialRevenue": 13408
  }
}

Focus on:
- Campaign performance (delivery, engagement)
- Channel effectiveness (WhatsApp vs Email vs SMS)
- Opportunity pipeline (detected vs launched)
- Next best action

Be specific with numbers. Use Indian Rupee format (₹). Keep it concise and actionable.`;

  const response = await client.chat.completions.create({
    model: openRouterConfig.defaultModel,
    temperature: 0.7,
    max_tokens: 600,
    messages: [
      {
        role: 'system',
        content: 'You are a concise Growth Intelligence Analyst. Output only valid JSON.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content || '{}';

  try {
    let jsonString = raw.trim();
    if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const parsed = JSON.parse(jsonString);

    return {
      generatedAt: new Date().toISOString(),
      summary: parsed.summary || [],
      keyInsights: parsed.keyInsights || [],
      recommendation: parsed.recommendation || { action: '', potentialRevenue: 0 },
    };
  } catch (err) {
    console.error('Failed to parse intelligence brief:', err);

    // Fallback to basic analytics
    return {
      generatedAt: new Date().toISOString(),
      summary: [
        `${context.launchedCampaigns} campaigns launched with ${context.totalCommunications} communications`,
        `${context.deliveredEvents} messages delivered, ${context.readEvents} read, ${context.clickedEvents} clicked`,
      ],
      keyInsights: [
        `${context.detectedOpportunities} opportunities detected and awaiting action`,
        `${((context.readEvents / Math.max(context.deliveredEvents, 1)) * 100).toFixed(1)}% read rate across all campaigns`,
      ],
      recommendation: {
        action: context.topOpportunity
          ? `Launch ${context.topOpportunity.opportunity_type} campaign targeting ${context.topOpportunity.audience_size} customers`
          : 'Generate new opportunities to identify growth actions',
        potentialRevenue: context.topOpportunity?.potential_revenue || 0,
      },
    };
  }
}

// ============================================
// 2. CAMPAIGN FUNNEL
// ============================================

export async function getCampaignFunnel(
  supabase: SupabaseClient
): Promise<CampaignFunnelData> {
  const { data: events } = await supabase
    .from('communication_events')
    .select('event_type');

  const counts = {
    sent: 0,
    delivered: 0,
    read: 0,
    clicked: 0,
    failed: 0,
  };

  events?.forEach(event => {
    const type = event.event_type.toLowerCase();
    if (type === 'sent') counts.sent++;
    else if (type === 'delivered') counts.delivered++;
    else if (type === 'read') counts.read++;
    else if (type === 'clicked') counts.clicked++;
    else if (type === 'failed') counts.failed++;
  });

  return counts;
}

// ============================================
// 3. OPPORTUNITY PIPELINE
// ============================================

export async function getOpportunityPipeline(
  supabase: SupabaseClient
): Promise<OpportunityPipelineData> {
  const [opportunities, campaigns] = await Promise.all([
    supabase.from('opportunities').select('id, status, opportunity_id'),
    supabase.from('campaigns').select('opportunity_id, status'),
  ]);

  const oppData = opportunities.data || [];
  const campaignData = campaigns.data || [];

  // Build opportunity -> campaign status mapping
  const oppToCampaign = new Map<string, string>();
  campaignData.forEach(c => {
    if (!oppToCampaign.has(c.opportunity_id)) {
      oppToCampaign.set(c.opportunity_id, c.status);
    }
  });

  const pipeline = {
    detected: oppData.length, // All opportunities
    reviewed: oppData.filter(o => o.status === 'Reviewed').length,
    campaignCreated: campaignData.filter(c => c.status === 'Draft' || c.status === 'Approved' || c.status === 'Launched' || c.status === 'Completed').length,
    launched: campaignData.filter(c => c.status === 'Launched' || c.status === 'Completed').length,
    completed: campaignData.filter(c => c.status === 'Completed').length,
  };

  return pipeline;
}

// ============================================
// 4. CHANNEL PERFORMANCE
// ============================================

export async function getChannelPerformance(
  supabase: SupabaseClient
): Promise<ChannelPerformance[]> {
  const { data: communications } = await supabase
    .from('communications')
    .select('id, channel');

  const { data: events } = await supabase
    .from('communication_events')
    .select('communication_id, event_type');

  // Build communication -> events map
  const commEvents = new Map<string, Set<string>>();
  events?.forEach(e => {
    if (!commEvents.has(e.communication_id)) {
      commEvents.set(e.communication_id, new Set());
    }
    commEvents.get(e.communication_id)!.add(e.event_type);
  });

  // Calculate per channel
  const channels = ['WhatsApp', 'Email', 'SMS'];
  const performance: ChannelPerformance[] = [];

  channels.forEach(channel => {
    const channelComms = communications?.filter(c => c.channel === channel) || [];
    const sent = channelComms.length;

    let delivered = 0;
    let read = 0;
    let clicked = 0;

    channelComms.forEach(comm => {
      const eventSet = commEvents.get(comm.id);
      if (eventSet) {
        if (eventSet.has('DELIVERED')) delivered++;
        if (eventSet.has('READ')) read++;
        if (eventSet.has('CLICKED')) clicked++;
      }
    });

    performance.push({
      channel,
      sent,
      delivered,
      read,
      clicked,
      deliveryRate: sent > 0 ? (delivered / sent) * 100 : 0,
      readRate: delivered > 0 ? (read / delivered) * 100 : 0,
      clickRate: read > 0 ? (clicked / read) * 100 : 0,
    });
  });

  return performance;
}

// ============================================
// 5. OPPORTUNITY DISTRIBUTION
// ============================================

export async function getOpportunityDistribution(
  supabase: SupabaseClient
): Promise<OpportunityDistribution[]> {
  const { data: opportunities } = await supabase
    .from('opportunities')
    .select('opportunity_type, potential_revenue');

  const distribution = new Map<string, { count: number; revenue: number }>();

  opportunities?.forEach(opp => {
    const type = opp.opportunity_type;
    if (!distribution.has(type)) {
      distribution.set(type, { count: 0, revenue: 0 });
    }
    const entry = distribution.get(type)!;
    entry.count++;
    entry.revenue += opp.potential_revenue;
  });

  const total = opportunities?.length || 1;

  return Array.from(distribution.entries()).map(([type, data]) => ({
    opportunityType: type,
    count: data.count,
    potentialRevenue: data.revenue,
    percentage: (data.count / total) * 100,
  }));
}

// ============================================
// 6. OPPORTUNITY TREND
// ============================================

export async function getOpportunityTrend(
  supabase: SupabaseClient,
  days: number = 30
): Promise<OpportunityTrendPoint[]> {
  const { data: opportunities } = await supabase
    .from('opportunities')
    .select('created_at, opportunity_type')
    .order('created_at', { ascending: true });

  // Group by date
  const trend = new Map<string, number>();

  opportunities?.forEach(opp => {
    const date = opp.created_at.split('T')[0]; // YYYY-MM-DD
    trend.set(date, (trend.get(date) || 0) + 1);
  });

  return Array.from(trend.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================
// 7. ACTIVITY FEED
// ============================================

export async function getActivityFeed(
  supabase: SupabaseClient,
  limit: number = 20
): Promise<ActivityFeedItem[]> {
  const [opportunities, campaigns, events] = await Promise.all([
    supabase.from('opportunities').select('*').order('created_at', { ascending: false }).limit(10),
    supabase.from('campaigns').select('*').order('created_at', { ascending: false }).limit(10),
    supabase.from('communication_events').select('*, communications(campaign_id)').order('event_timestamp', { ascending: false }).limit(50),
  ]);

  const feed: ActivityFeedItem[] = [];

  // Add opportunities
  opportunities.data?.forEach(opp => {
    feed.push({
      timestamp: opp.created_at,
      type: 'opportunity_detected',
      message: `${opp.opportunity_type} opportunity detected: ${opp.audience_size} customers, ₹${Math.round(opp.potential_revenue).toLocaleString('en-IN')} potential`,
      metadata: { opportunityId: opp.id },
    });
  });

  // Add campaign milestones
  campaigns.data?.forEach(campaign => {
    if (campaign.created_at) {
      feed.push({
        timestamp: campaign.created_at,
        type: 'campaign_created',
        message: `Campaign "${campaign.name}" created`,
        metadata: { campaignId: campaign.id },
      });
    }
    if (campaign.approved_at) {
      feed.push({
        timestamp: campaign.approved_at,
        type: 'campaign_approved',
        message: `Campaign "${campaign.name}" approved`,
        metadata: { campaignId: campaign.id },
      });
    }
    if (campaign.launched_at) {
      feed.push({
        timestamp: campaign.launched_at,
        type: 'campaign_launched',
        message: `Campaign "${campaign.name}" launched via ${campaign.channel}`,
        metadata: { campaignId: campaign.id },
      });
    }
  });

  // Add engagement events (sample only clicked events to avoid noise)
  const clickedEvents = events.data?.filter(e => e.event_type === 'CLICKED') || [];
  clickedEvents.slice(0, 5).forEach(event => {
    feed.push({
      timestamp: event.event_timestamp,
      type: 'engagement',
      message: `Customer clicked message`,
      metadata: { eventId: event.id },
    });
  });

  // Sort by timestamp descending and limit
  return feed
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

// ============================================
// 8. RECOMMENDED NEXT ACTIONS
// ============================================

export async function getRecommendedActions(
  supabase: SupabaseClient
): Promise<RecommendedAction[]> {
  // Get unaddressed opportunities
  const { data: opportunities } = await supabase
    .from('opportunities')
    .select('*')
    .eq('status', 'Detected')
    .order('potential_revenue', { ascending: false })
    .limit(5);

  const actions: RecommendedAction[] = [];

  opportunities?.forEach((opp, index) => {
    actions.push({
      priority: index + 1,
      action: `Launch ${opp.opportunity_type} Campaign`,
      description: `Target ${opp.audience_size} ${opp.supporting_customer_segment} customers`,
      potentialRevenue: opp.potential_revenue,
      opportunityId: opp.id,
    });
  });

  // If no opportunities, suggest generating them
  if (actions.length === 0) {
    actions.push({
      priority: 1,
      action: 'Generate New Opportunities',
      description: 'Run AI opportunity detection to identify growth actions',
      potentialRevenue: 0,
    });
  }

  return actions;
}
