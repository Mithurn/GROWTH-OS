import { openRouterConfig, openai } from '../config/openrouter';
import { prisma } from '../lib/prisma';

export interface IntelligenceBrief {
  generatedAt: string;
  summary: string[];
  keyInsights: string[];
  recommendation: { action: string; potentialRevenue: number };
}

export interface CampaignFunnelData { sent: number; delivered: number; read: number; clicked: number; failed: number }
export interface OpportunityPipelineData { detected: number; reviewed: number; campaignCreated: number; launched: number; completed: number }
export interface ChannelPerformance { channel: string; sent: number; delivered: number; read: number; clicked: number; deliveryRate: number; readRate: number; clickRate: number }
export interface OpportunityDistribution { opportunityType: string; count: number; potentialRevenue: number; percentage: number }
export interface OpportunityTrendPoint { date: string; count: number; opportunityType?: string }
export interface ActivityFeedItem {
  timestamp: string;
  type: 'opportunity_detected' | 'campaign_created' | 'campaign_approved' | 'campaign_launched' | 'engagement';
  message: string;
  metadata?: Record<string, unknown>;
}
export interface RecommendedAction { priority: number; action: string; description: string; potentialRevenue: number; opportunityId?: string; campaignId?: string }

function eventCounts(events: Array<{ communicationId: string; eventType: string }>): CampaignFunnelData {
  const counts = { sent: 0, delivered: 0, read: 0, clicked: 0, failed: 0 };
  const seen = new Set<string>();
  for (const event of events) {
    const key = event.eventType.toLowerCase() as keyof CampaignFunnelData;
    const recipientEvent = `${event.communicationId}:${key}`;
    if (key in counts && !seen.has(recipientEvent)) {
      counts[key] += 1;
      seen.add(recipientEvent);
    }
  }
  return counts;
}

export async function generateIntelligenceBrief(companyId: string): Promise<IntelligenceBrief> {
  const [opportunities, campaigns] = await Promise.all([
    prisma.opportunity.findMany({ where: { companyId }, take: 100 }),
    prisma.campaign.findMany({ where: { companyId }, take: 50 }),
  ]);
  const communications = await prisma.communication.findMany({ where: { campaignId: { in: campaigns.map((campaign) => campaign.id) } }, take: 500 });
  const events = await prisma.communicationEvent.findMany({ where: { communicationId: { in: communications.map((communication) => communication.id) } }, take: 1_000 });
  const funnel = eventCounts(events);
  const opportunityTypes: Record<string, number> = {};
  for (const opportunity of opportunities) opportunityTypes[opportunity.opportunityType] = (opportunityTypes[opportunity.opportunityType] ?? 0) + 1;
  const topOpportunity = opportunities.filter((opportunity) => opportunity.status === 'Detected').sort((a, b) => Number(b.potentialRevenue) - Number(a.potentialRevenue))[0];
  const context = {
    totalOpportunities: opportunities.length,
    detectedOpportunities: opportunities.filter((opportunity) => opportunity.status === 'Detected').length,
    totalCampaigns: campaigns.length,
    launchedCampaigns: campaigns.filter((campaign) => ['Launched', 'Completed'].includes(campaign.status)).length,
    totalCommunications: communications.length,
    totalEvents: events.length,
    ...Object.fromEntries(Object.entries(funnel).map(([key, value]) => [`${key}Events`, value])),
    whatsappComms: communications.filter((communication) => communication.channel === 'WhatsApp').length,
    emailComms: communications.filter((communication) => communication.channel === 'Email').length,
    smsComms: communications.filter((communication) => communication.channel === 'SMS').length,
    opportunityTypes,
    topOpportunity: topOpportunity ? { opportunityType: topOpportunity.opportunityType, audienceSize: topOpportunity.audienceSize, potentialRevenue: Number(topOpportunity.potentialRevenue) } : null,
  };
  try {
    const response = await openai.chat.completions.create({
      model: openRouterConfig.defaultModel,
      temperature: 0.7,
      max_tokens: 600,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a concise Growth Intelligence Analyst. Output only valid JSON.' },
        { role: 'user', content: `Analyze this retail CRM data and return JSON with summary (string[]), keyInsights (string[]), and recommendation ({ action, potentialRevenue }).\n${JSON.stringify(context)}` },
      ],
    });
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}');
    return {
      generatedAt: new Date().toISOString(),
      summary: Array.isArray(parsed.summary) ? parsed.summary : [],
      keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [],
      recommendation: parsed.recommendation ?? { action: '', potentialRevenue: 0 },
    };
  } catch {
    return {
      generatedAt: new Date().toISOString(),
      summary: [`${context.launchedCampaigns} campaigns launched with ${context.totalCommunications} communications`, `${funnel.delivered} messages delivered, ${funnel.read} read, ${funnel.clicked} clicked`],
      keyInsights: [`${context.detectedOpportunities} opportunities detected and awaiting action`, `${((funnel.read / Math.max(funnel.delivered, 1)) * 100).toFixed(1)}% read rate across all campaigns`],
      recommendation: topOpportunity
        ? { action: `Launch ${topOpportunity.opportunityType} campaign targeting ${topOpportunity.audienceSize} customers`, potentialRevenue: Number(topOpportunity.potentialRevenue) }
        : { action: 'Generate new opportunities to identify growth actions', potentialRevenue: 0 },
    };
  }
}

export async function getCampaignFunnel(companyId: string): Promise<CampaignFunnelData> {
  return eventCounts(await prisma.communicationEvent.findMany({ where: { communication: { campaign: { companyId } } }, select: { communicationId: true, eventType: true } }));
}

export async function getOpportunityPipeline(companyId: string): Promise<OpportunityPipelineData> {
  const [opportunities, campaigns] = await Promise.all([
    prisma.opportunity.findMany({ where: { companyId }, select: { status: true } }),
    prisma.campaign.findMany({ where: { companyId }, select: { status: true } }),
  ]);
  return {
    detected: opportunities.length,
    reviewed: opportunities.filter((opportunity) => opportunity.status === 'Reviewed').length,
    campaignCreated: campaigns.filter((campaign) => ['Draft', 'Approved', 'Dispatching', 'Launched', 'Completed'].includes(campaign.status)).length,
    launched: campaigns.filter((campaign) => ['Launched', 'Completed'].includes(campaign.status)).length,
    completed: campaigns.filter((campaign) => campaign.status === 'Completed').length,
  };
}

export async function getChannelPerformance(companyId: string): Promise<ChannelPerformance[]> {
  const communications = await prisma.communication.findMany({ where: { campaign: { companyId } }, include: { events: { select: { eventType: true } } } });
  return ['WhatsApp', 'Email', 'SMS'].map((channel) => {
    const rows = communications.filter((communication) => communication.channel === channel);
    const has = (row: typeof rows[number], event: string) => row.events.some((item) => item.eventType === event);
    const sent = rows.length;
    const delivered = rows.filter((row) => has(row, 'DELIVERED')).length;
    const read = rows.filter((row) => has(row, 'READ')).length;
    const clicked = rows.filter((row) => has(row, 'CLICKED')).length;
    return { channel, sent, delivered, read, clicked, deliveryRate: sent ? (delivered / sent) * 100 : 0, readRate: delivered ? (read / delivered) * 100 : 0, clickRate: read ? (clicked / read) * 100 : 0 };
  });
}

export async function getOpportunityDistribution(companyId: string): Promise<OpportunityDistribution[]> {
  const opportunities = await prisma.opportunity.findMany({ where: { companyId }, select: { opportunityType: true, potentialRevenue: true } });
  const grouped = new Map<string, { count: number; potentialRevenue: number }>();
  for (const opportunity of opportunities) {
    const current = grouped.get(opportunity.opportunityType) ?? { count: 0, potentialRevenue: 0 };
    current.count += 1;
    current.potentialRevenue += Number(opportunity.potentialRevenue);
    grouped.set(opportunity.opportunityType, current);
  }
  return [...grouped.entries()].map(([opportunityType, data]) => ({ opportunityType, ...data, percentage: (data.count / Math.max(opportunities.length, 1)) * 100 }));
}

export async function getOpportunityTrend(days = 30, companyId = ''): Promise<OpportunityTrendPoint[]> {
  const opportunities = await prisma.opportunity.findMany({
    where: { companyId, createdAt: { gte: new Date(Date.now() - Math.max(1, days) * 86_400_000) } },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  const trend = new Map<string, number>();
  for (const opportunity of opportunities) {
    const date = opportunity.createdAt.toISOString().slice(0, 10);
    trend.set(date, (trend.get(date) ?? 0) + 1);
  }
  return [...trend.entries()].map(([date, count]) => ({ date, count }));
}

export async function getActivityFeed(limit = 20, companyId = ''): Promise<ActivityFeedItem[]> {
  const [opportunities, campaigns, clicks] = await Promise.all([
    prisma.opportunity.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.campaign.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.communicationEvent.findMany({ where: { eventType: 'CLICKED', communication: { campaign: { companyId } } }, orderBy: { eventTimestamp: 'desc' }, take: 5 }),
  ]);
  const feed: ActivityFeedItem[] = opportunities.map((opportunity) => ({
    timestamp: opportunity.createdAt.toISOString(),
    type: 'opportunity_detected',
    message: `${opportunity.opportunityType} opportunity detected: ${opportunity.audienceSize} customers, ₹${Math.round(Number(opportunity.potentialRevenue)).toLocaleString('en-IN')} potential`,
    metadata: { opportunityId: opportunity.id },
  }));
  for (const campaign of campaigns) {
    feed.push({ timestamp: campaign.createdAt.toISOString(), type: 'campaign_created', message: `Campaign "${campaign.name}" created`, metadata: { campaignId: campaign.id } });
    if (campaign.approvedAt) feed.push({ timestamp: campaign.approvedAt.toISOString(), type: 'campaign_approved', message: `Campaign "${campaign.name}" approved`, metadata: { campaignId: campaign.id } });
    if (campaign.launchedAt) feed.push({ timestamp: campaign.launchedAt.toISOString(), type: 'campaign_launched', message: `Campaign "${campaign.name}" launched via ${campaign.channel}`, metadata: { campaignId: campaign.id } });
  }
  for (const click of clicks) feed.push({ timestamp: click.eventTimestamp.toISOString(), type: 'engagement', message: 'Customer clicked message', metadata: { eventId: click.id } });
  return feed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit);
}

export async function getRecommendedActions(companyId = ''): Promise<RecommendedAction[]> {
  const opportunities = await prisma.opportunity.findMany({ where: { companyId, status: 'Detected' }, orderBy: { potentialRevenue: 'desc' }, take: 5 });
  if (!opportunities.length) return [{ priority: 1, action: 'Generate New Opportunities', description: 'Run AI opportunity detection to identify growth actions', potentialRevenue: 0 }];
  return opportunities.map((opportunity, index) => ({ priority: index + 1, action: `Launch ${opportunity.opportunityType} Campaign`, description: `Target ${opportunity.audienceSize} ${opportunity.supportingCustomerSegment} customers`, potentialRevenue: Number(opportunity.potentialRevenue), opportunityId: opportunity.id }));
}

function buildPersonaBreakdown(personas: Array<{ personaName: string }>) {
  const counts = new Map<string, number>();
  for (const persona of personas) counts.set(persona.personaName, (counts.get(persona.personaName) ?? 0) + 1);
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0) || 1;
  return [...counts.entries()].map(([persona_name, count]) => ({ persona_name, count, percentage: Math.round((count / total) * 100) })).sort((a, b) => b.count - a.count);
}

export async function getCampaignAnalytics(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { opportunity: true, communications: { include: { events: true } } } });
  if (!campaign) throw new Error('Campaign not found');
  const events = campaign.communications.flatMap((communication) => communication.events);
  const funnel = { targeted: campaign.communications.length, ...eventCounts(events) };
  const customerIds = campaign.communications.map((communication) => communication.customerId);
  let personas = customerIds.length ? await prisma.persona.findMany({ where: { companyId: campaign.companyId, customerId: { in: customerIds } } }) : [];
  if (!personas.length) personas = await prisma.persona.findMany({ where: { companyId: campaign.companyId }, take: 500 });
  const personaBreakdown = buildPersonaBreakdown(personas);
  const launchTime = campaign.launchedAt?.getTime() ?? Date.now();
  const hourBuckets = new Map<number, { sent: number; delivered: number; read: number; clicked: number }>();
  for (const event of events) {
    const hour = Math.max(0, Math.floor((event.eventTimestamp.getTime() - launchTime) / 3_600_000));
    const bucket = hourBuckets.get(hour) ?? { sent: 0, delivered: 0, read: 0, clicked: 0 };
    const key = event.eventType.toLowerCase() as keyof typeof bucket;
    if (key in bucket) bucket[key] += 1;
    hourBuckets.set(hour, bucket);
  }
  const timeline = [...hourBuckets.entries()].sort(([a], [b]) => a - b).map(([hour, data]) => ({ hour, ...data }));
  if (timeline[0]?.hour === 0) timeline.unshift({ hour: -1, sent: 0, delivered: 0, read: 0, clicked: 0 });

  let insights = { learnings: [] as string[], nextAction: { title: '', description: '', potentialRevenue: 0, confidence: 0 } };
  try {
    const response = await openai.chat.completions.create({
      model: openRouterConfig.defaultModel,
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a marketing analytics AI. Output only valid JSON.' },
        { role: 'user', content: `Return JSON with learnings (maximum 3 strings) and nextAction ({ title, description, potentialRevenue, confidence }) for ${JSON.stringify({ campaignName: campaign.name, channel: campaign.channel, objective: campaign.objective, funnel, personaBreakdown: personaBreakdown.slice(0, 5), opportunityType: campaign.opportunity.opportunityType, potentialRevenue: Number(campaign.opportunity.potentialRevenue) })}` },
      ],
    });
    insights = JSON.parse(response.choices[0]?.message?.content ?? '{}');
  } catch {
    const deliveryRate = funnel.targeted ? ((funnel.delivered / funnel.targeted) * 100).toFixed(1) : '0';
    const openRate = funnel.delivered ? ((funnel.read / funnel.delivered) * 100).toFixed(1) : '0';
    const clickRate = funnel.read ? ((funnel.clicked / funnel.read) * 100).toFixed(1) : '0';
    insights = {
      learnings: [`${deliveryRate}% delivery rate — ${funnel.delivered} of ${funnel.targeted} messages delivered successfully.`, `${openRate}% open rate among delivered messages, with ${funnel.read} recipients reading the message.`, `${clickRate}% click-through rate — ${funnel.clicked} recipients engaged with the call-to-action.`],
      nextAction: { title: 'Retarget Engaged Non-Converters', description: `${funnel.clicked} users clicked but may not have purchased. Consider a follow-up campaign.`, potentialRevenue: Math.round(Number(campaign.opportunity.potentialRevenue) * 0.3), confidence: Number(campaign.opportunity.confidenceScore) || 75 },
    };
  }

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      objective: campaign.objective,
      channel: campaign.channel,
      status: campaign.status,
      reasoning: campaign.reasoning,
      launched_at: campaign.launchedAt?.toISOString() ?? null,
      opportunity_id: campaign.opportunityId,
      opportunity_title: campaign.opportunity.title,
      opportunity_type: campaign.opportunity.opportunityType,
      potential_revenue: Number(campaign.opportunity.potentialRevenue),
      confidence_score: Number(campaign.opportunity.confidenceScore),
    },
    funnel,
    personaBreakdown,
    timeline,
    insights,
  };
}
