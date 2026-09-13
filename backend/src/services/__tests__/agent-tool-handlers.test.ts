import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../../lib/prisma';
import { buildToolHandlers } from '../agent-tool-handlers';
import type { RunContext } from '@growthos/agent-core';

const ctx: RunContext = {
  companyId: 'co_real',
  runId: 'run_1',
  goal: 'win back churned buyers',
  mode: 'shadow',
  guardrails: { max_budget: 5000, channels: ['whatsapp'] },
};

const handlers = buildToolHandlers();

beforeEach(() => {
  vi.mocked(prisma.customer.count).mockReset().mockResolvedValue(0);
  vi.mocked(prisma.campaign.findFirst).mockReset().mockResolvedValue(null);
});

describe('buildToolHandlers', () => {
  it('does not invent metrics when the tenant has no customers', async () => {
    const result = await handlers.growthos_query_metrics({ response_format: 'concise' }, ctx);
    expect(result).toMatchObject({ totalCustomers: 0 });
    expect(result).toMatchObject({ note: expect.stringMatching(/No customers/i) });
    expect(prisma.customer.count).toHaveBeenCalledWith({ where: { companyId: 'co_real' } });
  });

  it('counts communication statuses in the webhook FSM alphabet (QUEUED/SENT/…)', async () => {
    vi.mocked(prisma.campaign.findFirst).mockResolvedValue({
      id: 'camp_1',
      name: 'Win-back',
      status: 'Launched',
      channel: 'whatsapp',
      communications: [
        { status: 'SENT', converted: false },
        { status: 'DELIVERED', converted: false },
        { status: 'READ', converted: false },
        { status: 'CLICKED', converted: true },
        { status: 'QUEUED', converted: false },
      ],
    } as never);

    const result = (await handlers.growthos_read_campaign_performance(
      { campaign_id: 'camp_1' },
      ctx,
    )) as Record<string, unknown>;

    expect(prisma.campaign.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'camp_1', companyId: 'co_real' } }),
    );
    expect(result.sent).toBe(4);
    expect(result.delivered).toBe(3);
    expect(result.read).toBe(2);
    expect(result.clicked).toBe(1);
    expect(result.converted).toBe(1);
    expect(result.queued).toBe(1);
  });

  it('refuses a campaign_id that does not belong to this tenant', async () => {
    await expect(
      handlers.growthos_read_campaign_performance({ campaign_id: 'camp_other' }, ctx),
    ).rejects.toThrow(/No campaign camp_other for this tenant/);
  });

  it('checks guardrails from run context, not from the model', async () => {
    const result = await handlers.growthos_check_guardrails(
      { potential_revenue: 10_000, channel: 'email' },
      ctx,
    );
    expect(result).toMatchObject({ allowed: false });
  });

  it('does not bind mutating tools in the default shadow factory', () => {
    expect(handlers.growthos_create_opportunity).toBeUndefined();
    expect(handlers.growthos_launch_campaign).toBeUndefined();
  });
});

describe('live mutating handlers', () => {
  const liveCtx: RunContext = { ...ctx, mode: 'live', agentId: 'ag_1' };
  const live = buildToolHandlers('live');

  beforeEach(() => {
    vi.mocked(prisma.opportunity.findFirst).mockReset().mockResolvedValue(null);
    vi.mocked(prisma.opportunity.create).mockReset();
    vi.mocked(prisma.campaign.findFirst).mockReset().mockResolvedValue(null);
    vi.mocked(prisma.campaign.create).mockReset();
    vi.mocked(prisma.customerMetrics.count).mockReset().mockResolvedValue(12);
    vi.mocked(prisma.customerMetrics.aggregate).mockReset().mockResolvedValue({
      _avg: { avgOrderValue: 800 },
    } as never);
    vi.mocked(prisma.campaign.findMany).mockReset().mockResolvedValue([]);
  });

  it('creates a tenant-scoped opportunity from coded type + estimator', async () => {
    vi.mocked(prisma.opportunity.create).mockResolvedValue({
      id: 'opp_new',
      title: 'Retention-Churn opportunity',
    } as never);

    const result = (await live.growthos_create_opportunity(
      { opportunity_type: 'Retention-Churn' },
      liveCtx,
    )) as Record<string, unknown>;

    expect(result.created).toBe(true);
    expect(prisma.opportunity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: 'co_real',
          agentId: 'ag_1',
          opportunityType: 'Retention-Churn',
        }),
      }),
    );
  });

  it('never sends from launch — ledger owns claim-then-send', async () => {
    vi.mocked(prisma.campaign.findFirst).mockResolvedValue({
      id: 'camp_1',
      status: 'Approved',
    } as never);

    const result = (await live.growthos_launch_campaign(
      { campaign_id: 'camp_1' },
      liveCtx,
    )) as Record<string, unknown>;

    expect(result.launched).toBe(false);
    expect(result.reason).toMatch(/Launch button/i);
  });

  it('refuses mutating handlers when the runtime context is still shadow', async () => {
    await expect(
      live.growthos_create_opportunity({ opportunity_type: 'Retention-Churn' }, ctx),
    ).rejects.toThrow(/not bound in shadow/i);
  });
});
