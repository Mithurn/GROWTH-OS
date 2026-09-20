import { prisma } from '../lib/prisma';
import { estimateImpact, toPrismaWhere, type OpportunityType } from '@growthos/domain';
import type { RunContext, ToolHandler } from '@growthos/agent-core';
import { checkGuardrails } from '@growthos/domain';
import { z } from 'zod';
import { searchSimilarCampaigns } from './campaign-embeddings';
import { parseWithRetry } from '../lib/ai';
import { openai, openRouterConfig } from '../config/openrouter';
import { getConfig } from '../lib/config';
import { ensureCampaignApprovalWorkflow } from './campaign-approval-workflow';

async function estimatorParams(companyId: string) {
  const [globalPriorConversionRate, priorWeight, confidenceZ] = await Promise.all([
    getConfig(companyId, 'estimator.global_prior_conversion_rate'),
    getConfig(companyId, 'estimator.prior_weight'),
    getConfig(companyId, 'estimator.confidence_z'),
  ]);
  return { globalPriorConversionRate, priorWeight, confidenceZ };
}

// customerMetrics now carries its own companyId (docs/V3_PLAN.md Phase 2) — a
// direct filter instead of the join through customer this used to require.
const owned = (companyId: string) => ({ companyId });

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
    ...(await estimatorParams(ctx.companyId)),
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

async function searchPrior(args: unknown, ctx: RunContext) {
  const { query, limit } = args as { query: string; limit: number };
  try {
    const results = await searchSimilarCampaigns(ctx.companyId, query, limit);
    if (results.length === 0) {
      return {
        results: [],
        reason: 'No embedded campaign history yet for this tenant. Empty does not mean nothing was ever sent — use growthos_read_campaign_performance on a known campaign_id, or run the backfill script.',
      };
    }
    return {
      results: results.map((r) => ({
        campaign_id: r.campaignId,
        content: r.content,
        // Cosine distance, 0 = identical, 2 = opposite. Similarity is easier for a planner to reason about.
        similarity: Math.round((1 - r.distance / 2) * 100) / 100,
      })),
    };
  } catch (err) {
    return {
      results: [],
      reason: `growthos_search_prior_campaigns failed: ${err instanceof Error ? err.message : String(err)}. Treat as no history, not as an error to retry.`,
    };
  }
}

const FaithfulnessJudgment = z.object({
  groundedness_score: z.number().min(0).max(100),
  unsupported_claims: z.array(z.string()),
  reasoning: z.string(),
});

/**
 * Agentic RAG, the documented 2026 pattern: retrieve real similar campaigns
 * for the draft, then have the model score the draft's claims against only
 * what those retrieved rows actually show — not general knowledge, not
 * what the model thinks is plausible. Falls back to an honest "cannot
 * verify" rather than a fabricated score if there's no history to check
 * against or the LLM call fails; a faithfulness check that always passes
 * when it can't actually check anything would be worse than no check.
 */
async function faithfulness(args: unknown, ctx: RunContext) {
  const { draft } = args as { draft: string };

  if (!openRouterConfig.configured) {
    return { groundedness_score: null, unsupported_claims: [], reasoning: 'No LLM configured — cannot judge.' };
  }

  const retrieved = await searchSimilarCampaigns(ctx.companyId, draft, 3);
  if (retrieved.length === 0) {
    return {
      groundedness_score: null,
      unsupported_claims: [],
      reasoning: 'No prior campaign history embedded for this tenant — nothing to ground the draft against. Not the same as "ungrounded"; there is simply no evidence either way yet.',
    };
  }

  const evidence = retrieved.map((r, i) => `[${i + 1}] ${r.content}`).join('\n\n');
  const prompt = `You are a strict fact-checker for a marketing draft. Score how well the DRAFT's specific claims (numbers, offers, product names, promised outcomes) are supported by the EVIDENCE below — real records of this tenant's own past campaigns. Do not use outside knowledge. Anything in the draft that the evidence does not support is an unsupported claim, even if it sounds plausible.

EVIDENCE (this tenant's real past campaigns):
${evidence}

DRAFT TO CHECK:
${draft}

Return JSON: { "groundedness_score": 0-100, "unsupported_claims": ["..."], "reasoning": "one sentence" }`;

  try {
    const judgment = await parseWithRetry(
      () =>
        openai.chat.completions.create({
          model: openRouterConfig.defaultModel,
          temperature: 0,
          max_tokens: 500,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'You output only valid JSON and never include markdown formatting.' },
            { role: 'user', content: prompt },
          ],
        }).then((r) => r.choices[0]?.message?.content ?? ''),
      FaithfulnessJudgment,
    );
    return { ...judgment, grounded_in: retrieved.map((r) => r.campaignId).filter(Boolean) };
  } catch (err) {
    return {
      groundedness_score: null,
      unsupported_claims: [],
      reasoning: `Judge call failed: ${err instanceof Error ? err.message : String(err)}. Treat as unverified, not as passed.`,
    };
  }
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
    ...(await estimatorParams(ctx.companyId)),
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
  await ensureCampaignApprovalWorkflow({ campaignId: campaign.id, companyId: ctx.companyId });
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
    campaign_id: campaign.id,
    status: campaign.status,
    note: 'The durable campaign approval workflow is waiting for a human decision.',
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
    growthos_check_faithfulness: faithfulness,
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
