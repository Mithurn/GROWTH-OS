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

// ── Enqueue helpers (fail-open: run inline when Redis is absent) ──────────────

export async function enqueueOpportunityDiscovery(data: OpportunityDiscoveryJob): Promise<void> {
  if (opportunityQueue) {
    await opportunityQueue.add('discover', data, JOB_OPTIONS);
  } else {
    const { discoverOpportunities } = await import('../services/opportunity-discovery');
    await discoverOpportunities(data.companyId, data.agentId, data.goal);
  }
}

export async function enqueueCampaignGeneration(data: CampaignGenerationJob): Promise<void> {
  if (campaignQueue) {
    await campaignQueue.add('generate', data, JOB_OPTIONS);
  } else {
    const { createCampaignForOpportunity } = await import('../services/campaign-planner');
    await createCampaignForOpportunity(
      data.opportunityId,
      data.companyId,
      data.agentId,
      data.guardrails as any,
    );
  }
}

export async function enqueuePersonaGeneration(data: PersonaGenerationJob): Promise<void> {
  if (personaQueue) {
    await personaQueue.add('generate', data, JOB_OPTIONS);
  } else {
    console.warn('[BullMQ] Persona queue not available — REDIS_URL not set');
  }
}

// ── Workers ───────────────────────────────────────────────────────────────────

let workersStarted = false;

export function startWorkers(): void {
  if (!connection) {
    console.log('[BullMQ] REDIS_URL not set — workers disabled, falling back to inline execution');
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
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        );
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
      const { createClient } = await import('@supabase/supabase-js');
      const { generatePersonas } = await import('../services/personas');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );
      return generatePersonas(supabase, { companyId, model });
    },
    { connection, concurrency: 1 },
  );

  console.log('[BullMQ] Workers started: opportunity-discovery, campaign-generation, persona-generation');
}
