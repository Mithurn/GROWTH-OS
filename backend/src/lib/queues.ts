import { Queue, Worker, type Job } from 'bullmq';
import { SpanStatusCode } from '@opentelemetry/api';
import { tracer } from './tracing';
import { getConfig } from './config';
import { runWithTenant } from './tenant-context';

/** One span per job execution, wrapping whatever the processor already does. */
function withJobSpan<T, R>(queueName: string, handler: (job: Job<T>) => Promise<R>) {
  return async (job: Job<T>): Promise<R> => {
    return tracer.startActiveSpan(`bullmq.${queueName}`, async (span) => {
      span.setAttribute('bullmq.queue', queueName);
      span.setAttribute('bullmq.job_id', job.id ?? 'unknown');
      span.setAttribute('bullmq.attempt', job.attemptsMade);
      const companyId = (job.data as { companyId?: string }).companyId;
      if (companyId) {
        span.setAttribute('company.id', companyId);
        span.setAttribute('langfuse.user.id', companyId);
      }
      try {
        return companyId ? await runWithTenant(companyId, () => handler(job)) : await handler(job);
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
        throw err;
      } finally {
        span.end();
      }
    });
  };
}

if (!process.env.REDIS_URL) throw new Error('REDIS_URL is required.');
const connection = { url: process.env.REDIS_URL };

/** Resolved from global config (queue.retry.*) on every enqueue — cheap, Redis-cached reads. */
async function jobOptions() {
  const [attempts, delay] = await Promise.all([
    getConfig(null, 'queue.retry.attempts'),
    getConfig(null, 'queue.retry.backoff_delay_ms'),
  ]);
  return {
    attempts,
    backoff: { type: 'exponential' as const, delay },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  };
}

// ── Job data types ────────────────────────────────────────────────────────────

export interface OpportunityDiscoveryJob {
  companyId: string;
  agentId: string;
  goal: string;
  guardrails: Record<string, unknown>;
}

export interface CampaignGenerationJob {
  opportunityId: string;
  companyId: string;
  agentId: string;
  guardrails: Record<string, unknown>;
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

// ── Queues ────────────────────────────────────────────────────────────────────

export const opportunityQueue = new Queue<OpportunityDiscoveryJob>('opportunity-discovery', { connection });
export const campaignQueue = new Queue<CampaignGenerationJob>('campaign-generation', { connection });
export const personaQueue = new Queue<PersonaGenerationJob>('persona-generation', { connection });
export const ingestionQueue = new Queue<IngestionJob>('ingestion', { connection });

export async function enqueueOpportunityDiscovery(data: OpportunityDiscoveryJob): Promise<void> {
  await opportunityQueue.add('discover', data, await jobOptions());
}

export async function enqueueCampaignGeneration(data: CampaignGenerationJob): Promise<void> {
  await campaignQueue.add('generate', data, await jobOptions());
}

export async function enqueuePersonaGeneration(data: PersonaGenerationJob): Promise<void> {
  await personaQueue.add('generate', data, await jobOptions());
}

export async function enqueueIngestion(data: IngestionJob): Promise<void> {
  await ingestionQueue.add('process', data, await jobOptions());
}

// ── Workers ───────────────────────────────────────────────────────────────────

let workersStarted = false;
const activeWorkers: Worker[] = [];

export async function startWorkers(): Promise<void> {
  if (workersStarted) return;
  workersStarted = true;

  const [discoveryConcurrency, campaignConcurrency, personaConcurrency, ingestionConcurrency] = await Promise.all([
    getConfig(null, 'queue.opportunity_discovery.concurrency'),
    getConfig(null, 'queue.campaign_generation.concurrency'),
    getConfig(null, 'queue.persona_generation.concurrency'),
    getConfig(null, 'queue.ingestion.concurrency'),
  ]);

  // Opportunity discovery worker
  // Calls discoverOpportunities(), logs the result, then chains campaign-generation
  // jobs for every newly found opportunity so the whole flow is durable end-to-end.
  activeWorkers.push(new Worker<OpportunityDiscoveryJob>(
    'opportunity-discovery',
    withJobSpan('opportunity-discovery', async (job) => {
      const { companyId, agentId, goal, guardrails } = job.data;

      const { discoverOpportunities } = await import('../services/opportunity-discovery');
      const { logAgentAction } = await import('../services/agent-logger');
      const { prisma } = await import('./prisma');

      const discovered = await discoverOpportunities(companyId, agentId, goal);

      if (discovered.length > 0) {
        const totalRevenue = discovered.reduce((s, o) => s + Number(o.potentialRevenue), 0);
        const company = await prisma.company.findUnique({ where: { id: companyId }, select: { currency: true, locale: true } });
        const formattedRevenue = new Intl.NumberFormat(company?.locale ?? 'en-IN', {
          style: 'currency',
          currency: company?.currency ?? 'INR',
          maximumFractionDigits: 0,
        }).format(totalRevenue);
        await logAgentAction({
          agentId,
          actionType: 'discovered_opportunity',
          description: `Discovered ${discovered.length} new opportunities worth ${formattedRevenue}`,
          details: { opportunityIds: discovered.map(o => o.id), count: discovered.length },
        });

        for (const opp of discovered) {
          await campaignQueue.add(
            'generate',
            {
              opportunityId: opp.id,
              companyId,
              agentId,
              guardrails,
              audienceSize: opp.audienceSize,
              potentialRevenue: opp.potentialRevenue,
            },
            await jobOptions(),
          );
        }
      }

      return { discovered: discovered.length };
    }),
    { connection, concurrency: discoveryConcurrency },
  ));

  // Campaign generation worker
  // Includes an idempotency check so duplicate jobs are safe to retry.
  activeWorkers.push(new Worker<CampaignGenerationJob>(
    'campaign-generation',
    withJobSpan('campaign-generation', async (job) => {
      const { opportunityId, companyId, agentId, guardrails, audienceSize, potentialRevenue } = job.data;

      const { createCampaignForOpportunity } = await import('../services/campaign-planner');
      const { logAgentAction } = await import('../services/agent-logger');

      // Idempotency is enforced by the database, not this check (see
      // campaigns_one_live_per_opportunity + the P2002 handling inside
      // createCampaignForOpportunity) — two concurrent jobs for the same
      // opportunity can both reach this line; only one of them creates a row.
      const { campaign, deduped } = await createCampaignForOpportunity(opportunityId, companyId, agentId, guardrails as any);
      if (deduped) return { skipped: true, campaignId: campaign.id };

      await logAgentAction({
        agentId,
        actionType: 'created_campaign',
        description: `Created campaign "${campaign.name}" targeting ${audienceSize ?? 0} customers`,
        details: { campaignId: campaign.id, opportunityId, audienceSize, potentialRevenue },
      });

      return { campaignId: campaign.id, autoLaunched: false };
    }),
    { connection, concurrency: campaignConcurrency },
  ));

  // Persona generation worker
  activeWorkers.push(new Worker<PersonaGenerationJob>(
    'persona-generation',
    withJobSpan('persona-generation', async (job) => {
      const { companyId, model } = job.data;
      const { supabase } = await import('./supabase');
      const { generatePersonas } = await import('../services/personas');
      return generatePersonas(supabase, { companyId, model });
    }),
    { connection, concurrency: personaConcurrency },
  ));

  activeWorkers.push(new Worker<IngestionJob>(
    'ingestion',
    withJobSpan('ingestion', async (job) => {
      const { processIngestion } = await import('../services/ingestion');
      await processIngestion(job.data.sessionId);
      return { sessionId: job.data.sessionId };
    }),
    { connection, concurrency: ingestionConcurrency },
  ));

  console.log('[BullMQ] Workers started: opportunity-discovery, campaign-generation, persona-generation, ingestion');

  void resumeIncompleteIngestions();
}

/**
 * Drains every worker before the process exits — `Worker.close()` stops pulling
 * new jobs and waits for whatever is already active to finish, so a deploy can no
 * longer kill a send mid-flight. Queues are closed after, once nothing is adding
 * to them.
 */
export async function closeWorkers(): Promise<void> {
  await Promise.all(activeWorkers.map((w) => w.close()));
  await Promise.all([
    opportunityQueue.close(),
    campaignQueue.close(),
    personaQueue.close(),
    ingestionQueue.close(),
  ]);
}

/**
 * Sessions that still have CSV payloads were interrupted by a crash or spin-down.
 * Re-queue them so a keep-alive ping that wakes the instance also finishes the import.
 */
async function resumeIncompleteIngestions(): Promise<void> {
  try {
    // Deliberately cross-tenant: resumes every interrupted session across
    // every company after a spin-down, not one tenant's (see lib/prisma.ts's
    // prismaSystem doc).
    const { prismaSystem } = await import('./prisma');
    const [cutoffHours, maxSessions] = await Promise.all([
      getConfig(null, 'ingestion.resume.cutoff_hours'),
      getConfig(null, 'ingestion.resume.max_sessions'),
    ]);
    const cutoff = new Date(Date.now() - cutoffHours * 60 * 60 * 1000);
    const stuck = await prismaSystem.ingestionSession.findMany({
      where: {
        status: { in: ['pending', 'processing'] },
        customerCsv: { not: null },
        createdAt: { gte: cutoff },
      },
      select: { id: true },
      take: maxSessions,
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
