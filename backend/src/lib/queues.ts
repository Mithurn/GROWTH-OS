import { Queue, Worker } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL;
const connection = REDIS_URL ? { url: REDIS_URL } : null;

const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
} as const;

// ── Job data types ────────────────────────────────────────────────────────────

export interface OpportunityDiscoveryJob {
  companyId: string;
  agentId: string;
  goal: string;
  guardrails: Record<string, unknown>;
  involvement: string;
}

export interface CampaignGenerationJob {
  opportunityId: string;
  companyId: string;
  agentId: string;
  guardrails: Record<string, unknown>;
  involvement: string;
  audienceSize?: number;
  potentialRevenue?: number;
}

export interface PersonaGenerationJob {
  companyId?: string;
  model?: string;
}

export interface IngestionJob {
  sessionId: string;
}

// ── Queue instances (created only when Redis is available) ────────────────────

export const opportunityQueue = connection
  ? new Queue<OpportunityDiscoveryJob>('opportunity-discovery', { connection })
  : null;

export const campaignQueue = connection
  ? new Queue<CampaignGenerationJob>('campaign-generation', { connection })
  : null;

export const personaQueue = connection
  ? new Queue<PersonaGenerationJob>('persona-generation', { connection })
  : null;

export const ingestionQueue = connection
  ? new Queue<IngestionJob>('ingestion', { connection })
  : null;

// ── Enqueue helpers (fail-open: run inline when Redis is absent) ──────────────

export async function enqueueOpportunityDiscovery(data: OpportunityDiscoveryJob): Promise<void> {
  if (opportunityQueue) {
    await opportunityQueue.add('discover', data, JOB_OPTIONS);
  } else {
    const { discoverOpportunities } = await import('../services/opportunity-discovery');
    const { logAgentAction } = await import('../services/agent-logger');
    const discovered = await discoverOpportunities(data.companyId, data.agentId, data.goal);
    if (discovered.length > 0) {
      const totalRevenue = discovered.reduce((s, o) => s + Number(o.potentialRevenue), 0);
      await logAgentAction({
        agentId: data.agentId,
        actionType: 'discovered_opportunity',
        description: `Discovered ${discovered.length} new opportunities worth ₹${totalRevenue.toLocaleString('en-IN')}`,
        details: { opportunityIds: discovered.map((o: any) => o.id), count: discovered.length },
      }).catch(() => {});
    }
  }
}

export async function enqueueCampaignGeneration(data: CampaignGenerationJob): Promise<void> {
  if (campaignQueue) {
    await campaignQueue.add('generate', data, JOB_OPTIONS);
  } else {
    const { createCampaignForOpportunity } = await import('../services/campaign-planner');
    const { logAgentAction } = await import('../services/agent-logger');
    const campaign = await createCampaignForOpportunity(
      data.opportunityId,
      data.companyId,
      data.agentId,
      data.guardrails as any,
    );
    await logAgentAction({
      agentId: data.agentId,
      actionType: 'created_campaign',
      description: `Created campaign "${campaign.name}" targeting ${data.audienceSize ?? 0} customers`,
      details: { campaignId: campaign.id, opportunityId: data.opportunityId },
    }).catch(() => {});
  }
}

export async function enqueuePersonaGeneration(data: PersonaGenerationJob): Promise<void> {
  if (personaQueue) {
    await personaQueue.add('generate', data, JOB_OPTIONS);
  } else {
    const { supabase } = await import('./supabase');
    const { generatePersonas } = await import('../services/personas');
    await generatePersonas(supabase, { companyId: data.companyId, model: data.model });
  }
}

export async function enqueueIngestion(data: IngestionJob): Promise<void> {
  if (ingestionQueue) {
    await ingestionQueue.add('process', data, JOB_OPTIONS);
    return;
  }
  const { processIngestion } = await import('../services/ingestion');
  // Inline fallback still returns immediately to the HTTP caller — the work is
  // scheduled on the next tick so the route can respond with the session id.
  setImmediate(() => {
    processIngestion(data.sessionId).catch((err) => {
      console.error('[Ingestion] inline run failed', err);
    });
  });
}

// ── Workers ───────────────────────────────────────────────────────────────────

let workersStarted = false;

export function startWorkers(): void {
  if (!connection) {
    console.log('[BullMQ] REDIS_URL not set — workers disabled, falling back to inline execution');
    void resumeIncompleteIngestions();
    return;
  }
  if (workersStarted) return;
  workersStarted = true;

  // Opportunity discovery worker
  // Calls discoverOpportunities(), logs the result, then chains campaign-generation
  // jobs for every newly found opportunity so the whole flow is durable end-to-end.
  new Worker<OpportunityDiscoveryJob>(
    'opportunity-discovery',
    async (job) => {
      const { companyId, agentId, goal, guardrails, involvement } = job.data;

      const { discoverOpportunities } = await import('../services/opportunity-discovery');
      const { logAgentAction } = await import('../services/agent-logger');

      const discovered = await discoverOpportunities(companyId, agentId, goal);

      if (discovered.length > 0) {
        const totalRevenue = discovered.reduce((s, o) => s + Number(o.potentialRevenue), 0);
        await logAgentAction({
          agentId,
          actionType: 'discovered_opportunity',
          description: `Discovered ${discovered.length} new opportunities worth ₹${totalRevenue.toLocaleString('en-IN')}`,
          details: { opportunityIds: discovered.map(o => o.id), count: discovered.length },
        });

        for (const opp of discovered) {
          await campaignQueue!.add(
            'generate',
            {
              opportunityId: opp.id,
              companyId,
              agentId,
              guardrails,
              involvement,
              audienceSize: opp.audienceSize,
              potentialRevenue: opp.potentialRevenue,
            },
            JOB_OPTIONS,
          );
        }
      }

      return { discovered: discovered.length };
    },
    { connection, concurrency: 2 },
  );

  // Campaign generation worker
  // Creates the campaign in DB, logs it, and auto-launches based on involvement.
  // Includes an idempotency check so duplicate jobs are safe to retry.
  new Worker<CampaignGenerationJob>(
    'campaign-generation',
    async (job) => {
      const { opportunityId, companyId, agentId, guardrails, involvement, audienceSize, potentialRevenue } = job.data;

      const { prisma } = await import('../lib/prisma');

      // Idempotency: skip if a live campaign already exists for this opportunity
      const existing = await prisma.campaign.findFirst({
        where: { opportunityId, status: { in: ['Draft', 'Approved', 'Running', 'Launched'] } },
      });
      if (existing) return { skipped: true, campaignId: existing.id };

      const { createCampaignForOpportunity } = await import('../services/campaign-planner');
      const { logAgentAction } = await import('../services/agent-logger');

      const campaign = await createCampaignForOpportunity(opportunityId, companyId, agentId, guardrails as any);

      await logAgentAction({
        agentId,
        actionType: 'created_campaign',
        description: `Created campaign "${campaign.name}" targeting ${audienceSize ?? 0} customers`,
        details: { campaignId: campaign.id, opportunityId, audienceSize, potentialRevenue },
      });

      const involvementLower = involvement.toLowerCase();
      const shouldAutoLaunch =
        involvementLower.includes('autopilot') ||
        involvementLower.includes('auto') ||
        (involvementLower.includes('major') && Number(potentialRevenue ?? 0) < 20000);

      if (shouldAutoLaunch) {
        const { supabase } = await import('./supabase');
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: 'Approved', approvedAt: new Date() },
        });
        const { launchCampaign } = await import('../services/campaigns');
        await launchCampaign(supabase, campaign.id);

        await logAgentAction({
          agentId,
          actionType: 'launched_campaign',
          description: `Auto-launched campaign "${campaign.name}"`,
          details: { campaignId: campaign.id, mode: involvement },
        });
      }

      return { campaignId: campaign.id, autoLaunched: shouldAutoLaunch };
    },
    { connection, concurrency: 3 },
  );

  // Persona generation worker
  new Worker<PersonaGenerationJob>(
    'persona-generation',
    async (job) => {
      const { companyId, model } = job.data;
      const { supabase } = await import('./supabase');
      const { generatePersonas } = await import('../services/personas');
      return generatePersonas(supabase, { companyId, model });
    },
    { connection, concurrency: 1 },
  );

  new Worker<IngestionJob>(
    'ingestion',
    async (job) => {
      const { processIngestion } = await import('../services/ingestion');
      await processIngestion(job.data.sessionId);
      return { sessionId: job.data.sessionId };
    },
    { connection, concurrency: 1 },
  );

  console.log('[BullMQ] Workers started: opportunity-discovery, campaign-generation, persona-generation, ingestion');

  void resumeIncompleteIngestions();
}

/**
 * Sessions that still have CSV payloads were interrupted by a crash or spin-down.
 * Re-queue them so a keep-alive ping that wakes the instance also finishes the import.
 */
async function resumeIncompleteIngestions(): Promise<void> {
  try {
    const { prisma } = await import('./prisma');
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stuck = await prisma.ingestionSession.findMany({
      where: {
        status: { in: ['pending', 'processing'] },
        customerCsv: { not: null },
        createdAt: { gte: cutoff },
      },
      select: { id: true },
      take: 20,
    });

    for (const session of stuck) {
      await enqueueIngestion({ sessionId: session.id });
    }

    if (stuck.length > 0) {
      console.log(`[BullMQ] Resumed ${stuck.length} interrupted ingestion session(s)`);
    }
  } catch (err) {
    console.warn('[BullMQ] Failed to resume interrupted ingestions', err);
  }
}
