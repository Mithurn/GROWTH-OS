import type { Prisma } from '../../generated/prisma';
import { schemaDefault } from '@growthos/contracts/config/registry';

type Decision = 'approved' | 'rejected';

export interface CampaignDecisionInput {
  campaignId: string;
  companyId: string;
  actorId: string;
  decision: Decision;
  reason?: string;
  policy?: {
    quietHours: { startHour: number; endHour: number };
    frequencyCapPerDay: number;
    approvalTtlHours: number;
  };
}

export class CampaignTransitionError extends Error {}

export async function decideCampaignTransaction(
  tx: Prisma.TransactionClient,
  input: CampaignDecisionInput,
) {
    const campaign = await tx.campaign.findFirst({
      where: { id: input.campaignId, companyId: input.companyId },
      include: {
        company: { select: { timezone: true } },
        opportunity: {
          select: {
            audienceSize: true,
            potentialRevenue: true,
            audience: {
              select: {
                customer: {
                  select: {
                    email: true,
                    phone: true,
                    emailMarketingConsent: true,
                    smsMarketingConsent: true,
                  },
                },
              },
            },
          },
        },
        agent: { select: { involvementMode: true, guardrails: true } },
      },
    });
    if (!campaign) throw new CampaignTransitionError('Campaign not found');

    const target = input.decision === 'approved' ? 'Approved' : 'Rejected';
    if (campaign.status === target) return campaign;
    if (campaign.status !== 'PendingApproval') {
      throw new CampaignTransitionError(`Campaign cannot be ${input.decision} from ${campaign.status}`);
    }

    const updated = await tx.campaign.updateMany({
      where: { id: input.campaignId, companyId: input.companyId, status: 'PendingApproval' },
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

    const policy = input.policy ?? {
      quietHours: schemaDefault('campaign.quiet_hours'),
      frequencyCapPerDay: schemaDefault('campaign.frequency_cap_per_day'),
      approvalTtlHours: schemaDefault('campaign.approval_ttl_hours'),
    };
    const audience = campaign.opportunity.audience.map(({ customer }) => customer);
    const guardrails = campaign.agent?.guardrails as { max_budget?: unknown; channels?: unknown } | null;
    const integration = campaign.channel === 'Email' || campaign.channel === 'WhatsApp'
      ? await tx.integration.findFirst({
        where: { companyId: input.companyId, kind: campaign.channel === 'Email' ? 'email' : 'whatsapp' },
        select: { provider: true, mode: true, status: true },
      })
      : null;

    await tx.campaignApproval.create({
      data: {
        companyId: input.companyId,
        campaignId: input.campaignId,
        actorId: input.actorId,
        decision: input.decision,
        reason: input.reason,
        policySnapshot: {
          version: 2,
          companyId: input.companyId,
          campaignId: input.campaignId,
          agentId: campaign.agentId,
          actorId: input.actorId,
          reason: input.reason ?? null,
          involvementMode: campaign.agent?.involvementMode ?? 'manual',
          channel: campaign.channel,
          audience: {
            declaredSize: campaign.opportunity.audienceSize,
            resolvedSize: audience.length,
            eligibleForChannel: audience.filter((customer) => campaign.channel === 'Email'
              ? Boolean(customer.email && customer.emailMarketingConsent)
              : Boolean(customer.phone && customer.smsMarketingConsent)).length,
          },
          predictedImpact: { potentialRevenue: campaign.opportunity.potentialRevenue.toString() },
          policy: {
            timezone: campaign.company.timezone,
            quietHours: policy.quietHours,
            frequencyCapPerDay: policy.frequencyCapPerDay,
            approvalTtlHours: policy.approvalTtlHours,
            maxBudget: guardrails?.max_budget ?? null,
            allowedChannels: guardrails?.channels ?? null,
          },
          message: { length: campaign.messageContent.length, hasTemplateVariables: /{{[^}]+}}/.test(campaign.messageContent) },
          provider: integration,
        },
      },
    });
    await tx.campaignAuditEvent.create({
      data: {
        companyId: input.companyId,
        campaignId: input.campaignId,
        eventType: input.decision === 'approved' ? 'APPROVED' : 'REJECTED',
        actorId: input.actorId,
        metadata: { reason: input.reason ?? null },
      },
    });

    return tx.campaign.findFirstOrThrow({
      where: { id: input.campaignId, companyId: input.companyId },
    });
}

export async function decideCampaign(input: CampaignDecisionInput) {
  const { ensureCampaignApprovalWorkflow, resumeCampaignApprovalWorkflow } = await import(
    './campaign-approval-workflow'
  );
  await ensureCampaignApprovalWorkflow({
    campaignId: input.campaignId,
    companyId: input.companyId,
  });
  const { prisma } = await import('../lib/prisma');
  const { getConfig } = await import('../lib/config');
  const [quietHours, frequencyCapPerDay, approvalTtlHours] = await Promise.all([
    getConfig(input.companyId, 'campaign.quiet_hours'),
    getConfig(input.companyId, 'campaign.frequency_cap_per_day'),
    getConfig(input.companyId, 'campaign.approval_ttl_hours'),
  ]);
  const campaign = await prisma.$transaction((tx) =>
    decideCampaignTransaction(tx as unknown as Prisma.TransactionClient, {
      ...input,
      policy: { quietHours, frequencyCapPerDay, approvalTtlHours },
    }));
  await resumeCampaignApprovalWorkflow(input.campaignId, {
    decision: input.decision,
    actorId: input.actorId,
    reason: input.reason,
  });
  await prisma.campaignAuditEvent.create({
    data: {
      companyId: input.companyId,
      campaignId: input.campaignId,
      eventType: 'RESUMED',
      actorId: input.actorId,
      metadata: { decision: input.decision, reason: input.reason ?? null },
    },
  });
  return campaign;
}
