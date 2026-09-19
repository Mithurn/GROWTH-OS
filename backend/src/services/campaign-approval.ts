import type { Prisma } from '../../generated/prisma';

type Decision = 'approved' | 'rejected';

export interface CampaignDecisionInput {
  campaignId: string;
  companyId: string;
  actorId: string;
  decision: Decision;
  reason?: string;
}

export class CampaignTransitionError extends Error {}

export async function decideCampaignTransaction(
  tx: Prisma.TransactionClient,
  input: CampaignDecisionInput,
) {
    const campaign = await tx.campaign.findFirst({
      where: { id: input.campaignId, companyId: input.companyId },
      include: {
        opportunity: { select: { audienceSize: true, potentialRevenue: true } },
        agent: { select: { involvementMode: true, guardrails: true } },
      },
    });
    if (!campaign) throw new CampaignTransitionError('Campaign not found');

    const target = input.decision === 'approved' ? 'Approved' : 'Rejected';
    if (campaign.status === target) return campaign;
    if (campaign.status !== 'Draft') {
      throw new CampaignTransitionError(`Campaign cannot be ${input.decision} from ${campaign.status}`);
    }

    const updated = await tx.campaign.updateMany({
      where: { id: input.campaignId, companyId: input.companyId, status: 'Draft' },
      data: {
        status: target,
        approvedAt: input.decision === 'approved' ? new Date() : null,
      },
    });
    if (updated.count === 0) {
      const current = await tx.campaign.findFirstOrThrow({
        where: { id: input.campaignId, companyId: input.companyId },
      });
      if (current.status === target) return current;
      throw new CampaignTransitionError(`Campaign cannot be ${input.decision} from ${current.status}`);
    }

    await tx.campaignApproval.create({
      data: {
        companyId: input.companyId,
        campaignId: input.campaignId,
        actorId: input.actorId,
        decision: input.decision,
        reason: input.reason,
        policySnapshot: {
          version: 1,
          companyId: input.companyId,
          campaignId: input.campaignId,
          agentId: campaign.agentId,
          involvementMode: campaign.agent?.involvementMode ?? 'manual',
          channel: campaign.channel,
          audienceSize: campaign.opportunity.audienceSize,
          potentialRevenue: campaign.opportunity.potentialRevenue.toString(),
          guardrails: campaign.agent?.guardrails ?? {},
        },
      },
    });

    return tx.campaign.findFirstOrThrow({
      where: { id: input.campaignId, companyId: input.companyId },
    });
}

export async function decideCampaign(input: CampaignDecisionInput) {
  const { prisma } = await import('../lib/prisma');
  return prisma.$transaction((tx) =>
    decideCampaignTransaction(tx as unknown as Prisma.TransactionClient, input));
}
