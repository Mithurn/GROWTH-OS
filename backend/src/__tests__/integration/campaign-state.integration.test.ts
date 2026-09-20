import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDb, type TestDb } from './testDb';

describe('campaign state machine — real Postgres', () => {
  let db: TestDb;
  let companyId: string;
  let opportunityId: string;

  beforeAll(async () => {
    db = await startTestDb();
    const company = await db.prisma.company.create({
      data: { companyName: `Campaign State ${Date.now()}` },
    });
    companyId = company.id;
    const opportunity = await db.prisma.opportunity.create({
      data: {
        companyId,
        opportunityKey: 'state-machine',
        opportunityType: 'Retention-Churn',
        title: 'State machine test',
        description: 'State machine test',
        audienceSize: 1,
        potentialRevenue: 100,
        confidenceScore: 1,
        priorityScore: 1,
        recommendedAction: 'Test',
        supportingCustomerSegment: 'Test',
        audienceDefinition: {},
        triggerReason: 'Test',
        aiSummary: 'Test',
      },
    });
    opportunityId = opportunity.id;
  }, 60_000);

  afterAll(async () => {
    await db?.stop();
  });

  async function createCampaign(key: string) {
    const opportunity = await db.prisma.opportunity.create({
      data: {
        companyId,
        opportunityKey: key,
        opportunityType: 'Retention-Churn',
        title: key,
        description: key,
        audienceSize: 1,
        potentialRevenue: 100,
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
        opportunityId: opportunity.id,
        name: key,
        objective: key,
        channel: 'Email',
        messageContent: key,
      },
    });
  }

  it('requires approval and dispatch before launch', async () => {
    const campaign = await db.prisma.campaign.create({
      data: {
        companyId,
        opportunityId,
        name: 'valid',
        objective: 'valid',
        channel: 'Email',
        messageContent: 'valid',
      },
    });

    await db.prisma.campaign.update({ where: { id: campaign.id }, data: { status: 'Approved' } });
    await db.prisma.campaign.update({ where: { id: campaign.id }, data: { status: 'Dispatching' } });
    const launched = await db.prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'Launched' },
    });
    expect(launched.status).toBe('Launched');
  });

  it('rejects launch without approval and unknown states', async () => {
    const campaign = await createCampaign('invalid-transition');
    await expect(
      db.prisma.campaign.update({ where: { id: campaign.id }, data: { status: 'Launched' } }),
    ).rejects.toThrow(/invalid campaign status transition/i);

    await expect(createCampaign('valid-state')).resolves.toMatchObject({ status: 'PendingApproval' });
    await expect(
      db.prisma.$executeRaw`
        INSERT INTO campaigns (
          id, company_id, opportunity_id, name, objective, channel,
          message_content, status, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${companyId}, ${opportunityId}, 'invalid', 'invalid',
          'Email', 'invalid', 'MadeUp', now(), now()
        )
      `,
    ).rejects.toThrow();
  });
});
