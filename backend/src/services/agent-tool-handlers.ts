import { prisma } from '../lib/prisma';
import { estimateImpact, toPrismaWhere, type OpportunityType } from '@growthos/domain';
import type { RunContext, ToolHandler } from '@growthos/agent-core';
import { checkGuardrails } from '@growthos/domain';

const owned = (companyId: string) => ({ customer: { companyId } });

async function queryMetrics(_args: unknown, ctx: RunContext) {
  const companyId = ctx.companyId;
  const totalCustomers = await prisma.customer.count({ where: { companyId } });
  if (totalCustomers === 0) {
    return { totalCustomers: 0, note: 'No customers for this tenant. Upload or generate data before recommending a campaign.' };
  }

  const [churnRisk, vip, dormant, lowEngagement, averages] = await Promise.all([
    prisma.customerMetrics.count({ where: { ...owned(companyId), daysSinceLastOrder: { gte: 30, lt: 60 } } }),
    prisma.customerMetrics.count({ where: { ...owned(companyId), totalSpent: { gte: 5000 }, daysSinceLastOrder: { gte: 15 } } }),
    prisma.customerMetrics.count({ where: { ...owned(companyId), daysSinceLastOrder: { gte: 60 } } }),
    prisma.customerMetrics.count({ where: { ...owned(companyId), totalOrders: { gte: 3 }, avgOrderValue: { lte: 2000 } } }),
    prisma.customerMetrics.aggregate({
      where: owned(companyId),
      _avg: { totalSpent: true, avgOrderValue: true, totalOrders: true },
    }),
  ]);

  return {
    totalCustomers,
    churnRiskCustomers: churnRisk,
    vipCustomers: vip,
    dormantCustomers: dormant,
    lowEngagementCustomers: lowEngagement,
    avgSpend: Number(averages._avg.totalSpent ?? 0),
    avgOrderValue: Number(averages._avg.avgOrderValue ?? 0),
    avgOrders: Number(averages._avg.totalOrders ?? 0),
  };
}

async function segmentCustomers(args: unknown, ctx: RunContext) {
  const { opportunity_type, sample_limit } = args as {
    opportunity_type: OpportunityType;
    sample_limit: number;
  };
  const where = toPrismaWhere(opportunity_type, ctx.companyId);
  const [size, sample] = await Promise.all([
    prisma.customerMetrics.count({ where }),
    prisma.customerMetrics.findMany({
      where,
      select: { customerId: true },
      take: sample_limit,
    }),
  ]);
  return {
    opportunity_type,
    audienceSize: size,
    sampleCustomerIds: sample.map((r) => r.customerId),
    note: size === 0 ? 'No customers match this coded segment for this tenant.' : undefined,
  };
}

async function listOpportunities(args: unknown, ctx: RunContext) {
  const { limit } = args as { limit: number };
  const rows = await prisma.opportunity.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { priorityScore: 'desc' },
    take: limit,
    select: {
      id: true,
      title: true,
      opportunityType: true,
      audienceSize: true,
      potentialRevenueLow: true,
      potentialRevenueHigh: true,
      status: true,
    },
  });
  return {
    count: rows.length,
    opportunities: rows.map((r) => ({
      id: r.id,
      title: r.title,
      type: r.opportunityType,
      audienceSize: r.audienceSize,
      revenueLow: Number(r.potentialRevenueLow),
      revenueHigh: Number(r.potentialRevenueHigh),
      status: r.status,
    })),
  };
}

async function historicalOutcomes(companyId: string, opportunityType: OpportunityType) {
  const campaigns = await prisma.campaign.findMany({
    where: {
      companyId,
      opportunity: { opportunityType },
      status: { in: ['Running', 'Launched', 'Completed'] },
    },
    select: { communications: { select: { converted: true } } },
  });
  return campaigns
    .map((c) => ({
      total: c.communications.length,
      converted: c.communications.filter((x) => x.converted).length,
    }))
    .filter((o) => o.total > 0);
}

async function estimate(args: unknown, ctx: RunContext) {
  const { opportunity_type, audience_size, avg_order_value } = args as {
    opportunity_type: OpportunityType;
    audience_size: number;
    avg_order_value: number;
  };
  const historical = await historicalOutcomes(ctx.companyId, opportunity_type);
  return estimateImpact({
    audienceSize: audience_size,
    avgOrderValue: avg_order_value,
    historical,
  });
}

async function readCampaign(args: unknown, ctx: RunContext) {
  const { campaign_id } = args as { campaign_id: string };
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaign_id, companyId: ctx.companyId },
    select: {
      id: true,
      name: true,
      status: true,
      channel: true,
      communications: { select: { status: true, converted: true } },
    },
  });
  if (!campaign) {
    throw new Error(`No campaign ${campaign_id} for this tenant. Copy an id from growthos_list_opportunities or a prior step.`);
  }
  const comms = campaign.communications;
  const count = (s: string) => comms.filter((c) => c.status === s).length;
  return {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    channel: campaign.channel,
    targeted: comms.length,
    queued: count('QUEUED'),
    sent: count('SENT') + count('DELIVERED') + count('READ') + count('CLICKED') + count('CONVERTED'),
    delivered: count('DELIVERED') + count('READ') + count('CLICKED') + count('CONVERTED'),
    read: count('READ') + count('CLICKED') + count('CONVERTED'),
    clicked: count('CLICKED') + count('CONVERTED'),
    failed: count('FAILED'),
    converted: comms.filter((c) => c.converted).length,
  };
}

async function searchPrior(_args: unknown) {
  return {
    results: [],
    reason: 'growthos_search_prior_campaigns is empty until 20260913171000_campaign_embeddings_pgvector is applied and a backfill exists. Empty does not mean this tenant has no history — use growthos_read_campaign_performance on a known campaign_id.',
  };
}

async function guardrails(args: unknown, ctx: RunContext) {
  const { potential_revenue, channel } = args as { potential_revenue: number; channel?: string };
  return checkGuardrails(
    { potentialRevenue: potential_revenue, channel },
    ctx.guardrails ?? {},
  );
}

async function think(args: unknown) {
  return { noted: true, thought: (args as { thought: string }).thought };
}

async function finish(args: unknown) {
  return { summary: (args as { summary: string }).summary };
}

async function createOpportunity(args: unknown, ctx: RunContext) {
  if (ctx.mode !== 'live') {
    throw new Error('growthos_create_opportunity is not bound in shadow mode.');
  }
  const { opportunity_type, title } = args as {
    opportunity_type: OpportunityType;
    title?: string;
  };
  const opportunityKey = `agent:${opportunity_type}`;
  const existing = await prisma.opportunity.findFirst({
    where: { companyId: ctx.companyId, opportunityKey },
  });
  if (existing) {
    return { id: existing.id, created: false, note: 'An opportunity of this type already exists for this tenant.' };
  }

  const where = toPrismaWhere(opportunity_type, ctx.companyId);
  const [audienceSize, averages] = await Promise.all([
    prisma.customerMetrics.count({ where }),
    prisma.customerMetrics.aggregate({
      where: owned(ctx.companyId),
      _avg: { avgOrderValue: true },
    }),
  ]);
  const impact = estimateImpact({
    audienceSize,
    avgOrderValue: Number(averages._avg.avgOrderValue ?? 0),
    historical: await historicalOutcomes(ctx.companyId, opportunity_type),
  });
  const label = title ?? `${opportunity_type} opportunity`;
  const created = await prisma.opportunity.create({
    data: {
      companyId: ctx.companyId,
      agentId: ctx.agentId,
      opportunityKey,
      opportunityType: opportunity_type,
      title: label,
      description: `Created by the growth agent for ${opportunity_type}.`,
      audienceSize,
      potentialRevenue: impact.expectedRevenue,
      potentialRevenueLow: impact.lowRevenue,
      potentialRevenueHigh: impact.highRevenue,
      confidenceScore: impact.confidenceScore,
      priorityScore: impact.priorityScore,
      predictedConversionRate: impact.conversionRate,
      supportingCustomerSegment: opportunity_type,
      recommendedAction: 'Draft a campaign after review.',
      audienceDefinition: { type: opportunity_type },
      triggerReason: ctx.goal,
      aiSummary: label,
      status: 'Detected',
    },
  });
  return {
    id: created.id,
    created: true,
    audienceSize,
    revenueLow: impact.lowRevenue,
    revenueHigh: impact.highRevenue,
  };
}

async function draftCampaign(args: unknown, ctx: RunContext) {
  if (ctx.mode !== 'live') {
    throw new Error('growthos_draft_campaign is not bound in shadow mode.');
  }
  const { opportunity_id, channel } = args as { opportunity_id: string; channel?: string };
  const opportunity = await prisma.opportunity.findFirst({
    where: { id: opportunity_id, companyId: ctx.companyId },
  });
  if (!opportunity) {
    throw new Error(`No opportunity ${opportunity_id} for this tenant.`);
  }
  const allowed = ctx.guardrails?.channels;
  const chosen = channel ?? allowed?.[0] ?? 'whatsapp';
  if (allowed && allowed.length > 0 && !allowed.includes(chosen)) {
    throw new Error(`Channel ${chosen} is not in the tenant allowlist.`);
  }
  const campaign = await prisma.campaign.create({
    data: {
      companyId: ctx.companyId,
      agentId: ctx.agentId,
      opportunityId: opportunity.id,
      name: `${opportunity.title} campaign`,
      objective: ctx.goal,
      channel: chosen,
      offer: '',
      messageAngle: opportunity.opportunityType,
      messageContent: `Follow-up for ${opportunity.title}. Review copy before approval.`,
      expectedOutcome: 'Pending review.',
      reasoning: 'Drafted by the growth agent without sending.',
      status: 'Draft',
    },
  });
  return { id: campaign.id, status: campaign.status, channel: campaign.channel };
}

async function requestApproval(args: unknown, ctx: RunContext) {
  if (ctx.mode !== 'live') {
    throw new Error('growthos_request_approval is not bound in shadow mode.');
  }
  const { campaign_id } = args as { campaign_id: string };
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaign_id, companyId: ctx.companyId },
  });
  if (!campaign) {
    throw new Error(`No campaign ${campaign_id} for this tenant.`);
  }
  return {
    interrupt: true,
    campaign_id: campaign.id,
    status: campaign.status,
    note: 'Human approval is required. The agent cannot approve or launch.',
  };
}

async function launchCampaignTool(args: unknown, ctx: RunContext) {
  if (ctx.mode !== 'live') {
    throw new Error('growthos_launch_campaign is not bound in shadow mode.');
  }
  const { campaign_id } = args as { campaign_id: string };
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaign_id, companyId: ctx.companyId },
    select: { id: true, status: true },
  });
  if (!campaign) {
    throw new Error(`No campaign ${campaign_id} for this tenant.`);
  }
  return {
    launched: false,
    campaign_id: campaign.id,
    status: campaign.status,
    reason: 'Launch is a claim-then-send ledger action on the Launch button. The agent cannot send.',
  };
}

export function buildToolHandlers(mode: RunContext['mode'] = 'shadow'): Record<string, ToolHandler> {
  const read: Record<string, ToolHandler> = {
    growthos_query_metrics: queryMetrics,
    growthos_segment_customers: segmentCustomers,
    growthos_list_opportunities: listOpportunities,
    growthos_estimate_impact: estimate,
    growthos_read_campaign_performance: readCampaign,
    growthos_search_prior_campaigns: searchPrior,
    growthos_check_guardrails: guardrails,
    growthos_think: think,
    growthos_finish: finish,
  };
  if (mode !== 'live') return read;
  return {
    ...read,
    growthos_create_opportunity: createOpportunity,
    growthos_draft_campaign: draftCampaign,
    growthos_request_approval: requestApproval,
    growthos_launch_campaign: launchCampaignTool,
  };
}
