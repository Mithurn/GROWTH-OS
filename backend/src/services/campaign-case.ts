import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import { searchSimilarCampaigns } from './campaign-embeddings';
import { reviewCampaignFaithfulness } from './campaign-faithfulness';
import { reviewCampaignRisk } from './campaign-risk-review';
import { getConfig } from '../lib/config';
import { getDurableAgentCheckpointer } from '../lib/agent-checkpointer';
import { buildCampaignCaseGraph, campaignCaseThreadId, type CampaignCaseReview } from '@growthos/agent-core';

type Evidence = {
  opportunity: {
    id: string;
    type: string;
    audienceSize: number;
    potentialRevenue: number;
    confidenceScore: number;
  };
  priorCampaigns: Array<{ campaignId: string | null; content: string; similarity: number }>;
};

async function addStep(input: {
  runId: string;
  companyId: string;
  node: string;
  result?: object;
  error?: string;
  startedAt: number;
}) {
  await prisma.agentStep.create({
    data: {
      runId: input.runId,
      companyId: input.companyId,
      node: input.node,
      result: input.result,
      error: input.error,
      latencyMs: Date.now() - input.startedAt,
    },
  });
}

export async function completeCampaignCase(input: {
  campaignId: string;
  companyId: string;
  agentId?: string | null;
}) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: input.campaignId, companyId: input.companyId },
    include: {
      opportunity: {
        select: {
          id: true,
          opportunityType: true,
          audienceSize: true,
          potentialRevenue: true,
          confidenceScore: true,
        },
      },
    },
  });
  if (!campaign) throw new Error(`Campaign ${input.campaignId} not found`);

  const runId = randomUUID();
  const run = await prisma.agentRun.create({
    data: {
      companyId: input.companyId,
      agentId: input.agentId ?? campaign.agentId,
      threadId: `campaign-case:${campaign.id}:${runId}`,
      goal: `Prepare ${campaign.name} for owner approval.`,
      mode: 'campaign_case',
    },
  });

  const campaignCase = await prisma.campaignCase.upsert({
    where: { opportunityId: campaign.opportunityId },
    create: {
      companyId: input.companyId,
      agentId: input.agentId ?? campaign.agentId,
      opportunityId: campaign.opportunityId,
      campaignId: campaign.id,
      runId: run.id,
    },
    update: { campaignId: campaign.id, runId: run.id, status: 'RUNNING' },
  });

  const maxRevisions = await getConfig(input.companyId, 'agent.max_revisions');
  const maxWallClockMs = await getConfig(input.companyId, 'agent.max_wall_clock_ms');
  const checkpointer = await getDurableAgentCheckpointer();
  const graph = buildCampaignCaseGraph({
    scout: async () => {
      const startedAt = Date.now();
      let priorCampaigns: Evidence['priorCampaigns'];
      try {
        priorCampaigns = (await searchSimilarCampaigns(input.companyId, campaign.messageContent, 3)).map((row) => ({
          campaignId: row.campaignId,
          content: row.content.slice(0, 1_500),
          similarity: Math.round((1 - row.distance / 2) * 100) / 100,
        }));
      } catch {
        priorCampaigns = [];
      }
      const evidence: Evidence = {
        opportunity: {
          id: campaign.opportunity.id,
          type: campaign.opportunity.opportunityType,
          audienceSize: campaign.opportunity.audienceSize,
          potentialRevenue: Number(campaign.opportunity.potentialRevenue),
          confidenceScore: Number(campaign.opportunity.confidenceScore),
        },
        priorCampaigns,
      };
      await addStep({ runId: run.id, companyId: input.companyId, node: 'scout', result: evidence, startedAt });
      return evidence;
    },
    strategist: async () => {
      const startedAt = Date.now();
      const result = { campaignId: campaign.id, channel: campaign.channel, status: campaign.status };
      await addStep({ runId: run.id, companyId: input.companyId, node: 'strategist', result, startedAt });
      return result;
    },
    reviewer: async (): Promise<CampaignCaseReview> => {
      const startedAt = Date.now();
      const current = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
      const risk = await reviewCampaignRisk({ companyId: input.companyId, campaignId: current.id, message: current.messageContent });
      const faithfulness = await reviewCampaignFaithfulness(input.companyId, current.messageContent);
      const report = { risk, faithfulness };
      const needsRevision = risk.verdict === 'ALLOW' && Array.isArray(faithfulness.unsupported_claims) && faithfulness.unsupported_claims.length > 0;
      await addStep({ runId: run.id, companyId: input.companyId, node: 'reviewer', result: report, startedAt });
      return { blocked: risk.verdict === 'BLOCK', needsRevision, report };
    },
    revise: async (report) => {
      const startedAt = Date.now();
      const objections = JSON.stringify(report).slice(0, 2_000);
      const { refineCampaignMessage } = await import('./campaigns');
      const revised = await refineCampaignMessage(campaign.id, `Address these reviewer objections using only supported tenant facts: ${objections}`, undefined, {
        companyId: input.companyId,
        actorId: input.agentId ?? undefined,
        skipCaseReview: true,
      });
      await addStep({ runId: run.id, companyId: input.companyId, node: 'revise', result: revised, startedAt });
      return revised;
    },
  }, checkpointer);
  let result;
  try {
    result = await graph.invoke(
      { caseId: campaignCase.id, maxRevisions, deadlineAt: Date.now() + maxWallClockMs },
      { configurable: { thread_id: campaignCaseThreadId(campaignCase.id) } },
    );
  } catch (err) {
    await prisma.$transaction([
      prisma.campaignCase.update({ where: { id: campaignCase.id }, data: { status: 'FAILED' } }),
      prisma.agentRun.update({ where: { id: run.id }, data: { status: 'stopped', summary: 'Campaign case failed before approval.', finishedAt: new Date() } }),
      prisma.campaignAuditEvent.create({ data: { companyId: input.companyId, campaignId: campaign.id, eventType: 'CASE_FAILED', metadata: { error: err instanceof Error ? err.message : String(err) } } }),
    ]);
    throw err;
  }
  const reviewerReport = result.review.report;
  const status = result.status;

  await prisma.$transaction([
    prisma.campaignCase.update({
      where: { id: campaignCase.id },
      data: { status, evidence: result.evidence, reviewerReport },
    }),
    prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'finished',
        stepCount: 3 + result.revisionCount,
        summary: status === 'BLOCKED' ? 'Reviewer blocked the campaign or revision budget was exhausted.' : 'Scout, strategist, and reviewer completed. Owner approval required.',
        finishedAt: new Date(),
      },
    }),
    prisma.campaignAuditEvent.create({
      data: {
        companyId: input.companyId,
        campaignId: campaign.id,
        eventType: status === 'BLOCKED' ? 'CASE_BLOCKED' : 'CASE_READY_FOR_APPROVAL',
        metadata: { campaignCaseId: campaignCase.id, runId: run.id, riskVerdict: (reviewerReport as { risk?: { verdict?: string } }).risk?.verdict, revisions: result.revisionCount },
      },
    }),
  ]);

  return prisma.campaignCase.findUniqueOrThrow({ where: { id: campaignCase.id } });
}
