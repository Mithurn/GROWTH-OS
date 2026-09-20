import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { runWithTenant } from '../../lib/tenant-context';
import { startTestDb, type TestDb } from './testDb';

describe('campaign dispatch outbox — real Postgres and Redis', () => {
  let db: TestDb;
  let redis: StartedTestContainer;
  let previousDatabaseUrl: string | undefined;
  let previousRedisUrl: string | undefined;

  beforeAll(async () => {
    db = await startTestDb();
    redis = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start();
    previousDatabaseUrl = process.env.DATABASE_URL;
    previousRedisUrl = process.env.REDIS_URL;
    process.env.DATABASE_URL = db.connectionUri;
    process.env.REDIS_URL = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`;
    vi.resetModules();
  }, 60_000);

  afterAll(async () => {
    const queues = await import('../../lib/queues');
    await queues.closeWorkers();
    const { prisma } = await import('../../lib/prisma');
    await prisma.$disconnect();
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousRedisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = previousRedisUrl;
    await redis?.stop();
    await db?.stop();
  });

  it('double launch creates one durable recipient row and one BullMQ job', async () => {
    const company = await db.prisma.company.create({
      data: { companyName: `Dispatch ${Date.now()}` },
    });
    const customer = await db.prisma.customer.create({
      data: {
        companyId: company.id,
        firstName: 'Ada',
        email: 'ada@example.com',
        emailMarketingConsent: true,
      },
    });
    const opportunity = await db.prisma.opportunity.create({
      data: {
        companyId: company.id,
        opportunityKey: 'dispatch',
        opportunityType: 'Retention',
        title: 'Dispatch',
        description: 'Dispatch',
        audienceSize: 1,
        potentialRevenue: 100,
        confidenceScore: 1,
        priorityScore: 1,
        recommendedAction: 'Send',
        supportingCustomerSegment: 'Test',
        audienceDefinition: {},
        triggerReason: 'Test',
        aiSummary: 'Test',
        audience: { create: { customerId: customer.id } },
      },
    });
    const campaign = await db.prisma.campaign.create({
      data: {
        companyId: company.id,
        opportunityId: opportunity.id,
        name: 'Dispatch',
        objective: 'Dispatch',
        channel: 'Email',
        messageContent: 'Hello {{customer_name}}',
        status: 'Approved',
      },
    });

    const { launchCampaign } = await import('../../services/campaigns');
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    const [first, second] = await Promise.all([
      runWithTenant(company.id, () => launchCampaign(campaign.id)),
      runWithTenant(company.id, () => launchCampaign(campaign.id)),
    ]);
    vi.useRealTimers();

    expect(first.communications_created).toBe(1);
    expect(second.communications_created).toBe(1);
    await expect(db.prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } }))
      .resolves.toMatchObject({ status: 'Dispatching' });
    expect(await db.prisma.communication.count({ where: { campaignId: campaign.id } })).toBe(1);
    expect(await db.prisma.communicationEvent.count()).toBe(1);

    const { communicationDispatchQueue } = await import('../../lib/queues');
    const jobs = await communicationDispatchQueue.getJobs(['waiting', 'delayed', 'active']);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.data).toMatchObject({ companyId: company.id });
  });
});
