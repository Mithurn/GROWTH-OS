import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { decideCampaign, decideCampaignTransaction } from '../../services/campaign-approval';
import { runWithTenant } from '../../lib/tenant-context';
import { closeAgentCheckpointer } from '../../lib/agent-checkpointer';
import { ensureCampaignApprovalWorkflow } from '../../services/campaign-approval-workflow';
import { startTestDb, type TestDb } from './testDb';

describe('campaign approval — real Postgres transactions and RLS', () => {
  let db: TestDb;
  let companyId: string;
  let agentId: string;
  let sequence = 0;
  let previousDatabaseUrl: string | undefined;

  beforeAll(async () => {
    db = await startTestDb();
    previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = db.connectionUri;
    const company = await db.prisma.company.create({
      data: { companyName: `Campaign Approval ${Date.now()}` },
    });
    companyId = company.id;
    const agent = await db.prisma.agent.create({
      data: {
        companyId,
        name: 'Approval Agent',
        goal: 'Approve safely',
        involvementMode: 'manual',
        guardrails: { channels: ['Email'], max_budget: 10000 },
      },
    });
    agentId = agent.id;
  }, 60_000);

  afterAll(async () => {
    await closeAgentCheckpointer();
    const { prisma } = await import('../../lib/prisma');
    await prisma.$disconnect();
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    await db?.stop();
  });

  async function createCampaign() {
    sequence += 1;
    const key = `approval-${sequence}`;
    const opportunity = await db.prisma.opportunity.create({
      data: {
        companyId,
        agentId,
        opportunityKey: key,
        opportunityType: 'Retention-Churn',
        title: key,
        description: key,
        audienceSize: 42,
        potentialRevenue: 9000,
        confidenceScore: 1,
        priorityScore: 1,
        recommendedAction: 'Test',
        supportingCustomerSegment: 'Test',
        audienceDefinition: {},
        triggerReason: 'Test',
        aiSummary: 'Test',
      },
    });
    return db.prisma.campaign.create({
      data: {
        companyId,
        agentId,
        opportunityId: opportunity.id,
        name: key,
        objective: key,
        channel: 'Email',
        messageContent: key,
      },
    });
  }

  function decide(campaignId: string, decision: 'approved' | 'rejected', reason?: string) {
    return runWithTenant(companyId, () =>
      db.rlsPrisma.$transaction((tx) =>
        decideCampaignTransaction(tx, {
          campaignId,
          companyId,
          actorId: 'user_1',
          decision,
          reason,
        }),
      ),
    );
  }

  it('atomically records the human actor and exact policy snapshot', async () => {
    const campaign = await createCampaign();
    await expect(
      runWithTenant(companyId, () => decideCampaign({
        campaignId: campaign.id,
        companyId,
        actorId: 'user_1',
        decision: 'approved',
      })),
    ).resolves.toMatchObject({ status: 'Approved' });

    await expect(
      ensureCampaignApprovalWorkflow({ campaignId: campaign.id, companyId }),
    ).resolves.toMatchObject({ decision: 'approved', actorId: 'user_1' });

    const approval = await db.prisma.campaignApproval.findUniqueOrThrow({
      where: { campaignId: campaign.id },
    });
    expect(approval).toMatchObject({
      companyId,
      actorId: 'user_1',
      decision: 'approved',
      policyVersion: 1,
    });
    expect(approval.policySnapshot).toMatchObject({
      version: 1,
      campaignId: campaign.id,
      involvementMode: 'manual',
      channel: 'Email',
      audienceSize: 42,
      potentialRevenue: '9000',
      guardrails: { channels: ['Email'], max_budget: 10000 },
    });
  });

  it('rolls the status change back when the audit insert fails', async () => {
    const campaign = await createCampaign();
    await db.prisma.campaignApproval.create({
      data: {
        companyId,
        campaignId: campaign.id,
        actorId: 'existing_actor',
        decision: 'approved',
        policySnapshot: { version: 1 },
      },
    });

    await expect(decide(campaign.id, 'approved')).rejects.toThrow();
    await expect(
      db.prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } }),
    ).resolves.toMatchObject({ status: 'Draft' });
  });

  it('makes concurrent duplicate approval idempotent', async () => {
    const campaign = await createCampaign();
    const [first, second] = await Promise.all([
      decide(campaign.id, 'approved'),
      decide(campaign.id, 'approved'),
    ]);

    expect(first.status).toBe('Approved');
    expect(second.status).toBe('Approved');
    await expect(
      db.prisma.campaignApproval.count({ where: { companyId, campaignId: campaign.id } }),
    ).resolves.toBe(1);
  });

  it('records rejection reasons and makes audit records immutable', async () => {
    const campaign = await createCampaign();
    await expect(decide(campaign.id, 'rejected', 'Wrong audience')).resolves.toMatchObject({
      status: 'Rejected',
    });
    const approval = await db.prisma.campaignApproval.findUniqueOrThrow({
      where: { campaignId: campaign.id },
    });
    expect(approval.reason).toBe('Wrong audience');
    await expect(
      runWithTenant(companyId, () =>
        db.rlsPrisma.campaignApproval.update({
          where: { id: approval.id },
          data: { reason: 'changed' },
        }),
      ),
    ).rejects.toThrow();
    await expect(
      runWithTenant(companyId, () =>
        db.rlsPrisma.campaignApproval.delete({ where: { id: approval.id } }),
      ),
    ).rejects.toThrow();
  });
});
