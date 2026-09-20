import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { runWithTenant } from '../../lib/tenant-context';
import { startTestDb, type TestDb } from './testDb';

describe('analytics — real tenant data', () => {
  let db: TestDb;
  let companyId: string;
  let previousDatabaseUrl: string | undefined;

  beforeAll(async () => {
    db = await startTestDb();
    previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = db.connectionUri;
    (globalThis as { prisma?: unknown; prismaSystem?: unknown }).prisma = undefined;
    (globalThis as { prisma?: unknown; prismaSystem?: unknown }).prismaSystem = undefined;
    vi.resetModules();

    const company = await db.prisma.company.create({ data: { companyName: `Analytics ${Date.now()}` } });
    companyId = company.id;
    const customer = await db.prisma.customer.create({ data: { companyId, firstName: 'Ada', email: 'ada@example.com' } });
    await db.prisma.persona.create({ data: { companyId, customerId: customer.id, personaName: 'VIP', personaDescription: 'VIP customer' } });
    const opportunity = await db.prisma.opportunity.create({
      data: {
        companyId,
        opportunityKey: 'analytics',
        opportunityType: 'Retention',
        title: 'Retention',
        description: 'Retention',
        audienceSize: 1,
        potentialRevenue: 1000,
        confidenceScore: 80,
        priorityScore: 80,
        recommendedAction: 'Send',
        supportingCustomerSegment: 'VIP',
        audienceDefinition: {},
        triggerReason: 'Test',
        aiSummary: 'Test',
      },
    });
    const campaign = await db.prisma.campaign.create({
      data: { companyId, opportunityId: opportunity.id, name: 'Retention', objective: 'Retain', channel: 'Email', messageContent: 'Hello', status: 'Launched' },
    });
    const communication = await db.prisma.communication.create({ data: { campaignId: campaign.id, customerId: customer.id, channel: 'Email', message: 'Hello', status: 'DELIVERED' } });
    await db.prisma.communicationEvent.createMany({
      data: [
        { communicationId: communication.id, eventType: 'SENT', sequenceNumber: 2 },
        { communicationId: communication.id, eventType: 'DELIVERED', sequenceNumber: 3 },
        { communicationId: communication.id, eventType: 'DELIVERED', sequenceNumber: 30 },
      ],
    });

    const other = await db.prisma.company.create({ data: { companyName: `Other Analytics ${Date.now()}` } });
    const otherCustomer = await db.prisma.customer.create({ data: { companyId: other.id, firstName: 'Other' } });
    const otherOpportunity = await db.prisma.opportunity.create({
      data: {
        companyId: other.id,
        opportunityKey: 'other',
        opportunityType: 'Upsell',
        title: 'Other',
        description: 'Other',
        audienceSize: 1,
        potentialRevenue: 9999,
        confidenceScore: 90,
        priorityScore: 90,
        recommendedAction: 'Other',
        supportingCustomerSegment: 'Other',
        audienceDefinition: {},
        triggerReason: 'Other',
        aiSummary: 'Other',
      },
    });
    const otherCampaign = await db.prisma.campaign.create({ data: { companyId: other.id, opportunityId: otherOpportunity.id, name: 'Other', objective: 'Other', channel: 'SMS', messageContent: 'Other', status: 'Launched' } });
    const otherCommunication = await db.prisma.communication.create({ data: { campaignId: otherCampaign.id, customerId: otherCustomer.id, channel: 'SMS', message: 'Other', status: 'READ' } });
    await db.prisma.communicationEvent.create({ data: { communicationId: otherCommunication.id, eventType: 'READ', sequenceNumber: 4 } });
  }, 60_000);

  afterAll(async () => {
    const { prisma } = await import('../../lib/prisma');
    await prisma.$disconnect();
    (globalThis as { prisma?: unknown; prismaSystem?: unknown }).prisma = undefined;
    (globalThis as { prisma?: unknown; prismaSystem?: unknown }).prismaSystem = undefined;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    await db?.stop();
  });

  it('computes tenant-isolated funnel, channel, opportunity, and action metrics', async () => {
    const analytics = await import('../../services/analytics');
    await runWithTenant(companyId, async () => {
      await expect(analytics.getCampaignFunnel(companyId)).resolves.toEqual({ sent: 1, delivered: 1, read: 0, clicked: 0, failed: 0 });
      await expect(analytics.getChannelPerformance(companyId)).resolves.toContainEqual(expect.objectContaining({ channel: 'Email', sent: 1, delivered: 1 }));
      await expect(analytics.getOpportunityDistribution(companyId)).resolves.toEqual([expect.objectContaining({ opportunityType: 'Retention', count: 1, potentialRevenue: 1000 })]);
      await expect(analytics.getRecommendedActions(companyId)).resolves.toEqual([expect.objectContaining({ opportunityId: expect.any(String), potentialRevenue: 1000 })]);
    });
  });
});
