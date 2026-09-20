import { prisma, prismaSystem } from '../lib/prisma';
import { enqueueOpportunityDiscovery, enqueueCampaignGeneration } from '../lib/queues';
import { logger } from '../lib/logger';
import { getConfig } from '../lib/config';
import { checkGuardrails, type Guardrails } from '@growthos/domain';
import { runShadowObserve } from './agent-shadow';

interface AgentExecutionContext {
  agentId: string;
  companyId: string;
  goal: string;
  guardrails: {
    max_budget?: number;
    frequency_cap?: number;
    channels?: string[];
  };
}

/**
 * Main orchestrator that runs agents autonomously
 * This is the core of the AI-native system
 */
export class AgentOrchestrator {
  private isRunning = false;
  private isProcessingAgents = false;
  private runInterval: NodeJS.Timeout | null = null;
  // Bound on the instance so esbuild cannot treat the shadow path as unused
  // (`void buildShadowGraph` was tree-shaken — see docs/breaks.md).
  private readonly observeShadow = runShadowObserve;

  /**
   * Run agents on an in-process interval.
   *
   * Only useful where the process is guaranteed to stay up. On Render's free tier the
   * instance sleeps after 15 minutes idle and the interval dies with it, so production
   * drives `runAllAgents` from an external cron via
   * `POST /api/internal/agents/run-scheduled` instead. Opt in with
   * `ENABLE_AGENT_INTERVAL=true` for local development.
   */
  async start(intervalMs: number = 60000) {
    if (this.isRunning) {
      logger.info('Agent orchestrator already running');
      return;
    }

    this.isRunning = true;
    logger.info({ intervalMs }, 'Agent Orchestrator starting');

    // Run immediately on start
    await this.runAllAgents();

    // Then run on interval
    this.runInterval = setInterval(async () => {
      await this.runAllAgents();
    }, intervalMs);
  }

  /**
   * Stop the orchestrator
   */
  stop() {
    if (this.runInterval) {
      clearInterval(this.runInterval);
      this.runInterval = null;
    }
    this.isRunning = false;
    logger.info('Agent Orchestrator stopped');
  }

  /**
   * Run one tick for every active agent.
   *
   * Returns what happened so the cron-driven endpoint can report it. Overlapping calls
   * are dropped rather than queued — a slow run must not be able to pile up behind a
   * cron that fires on a fixed schedule.
   */
  async runAllAgents(): Promise<{ ran: boolean; agentsProcessed: number }> {
    if (this.isProcessingAgents) {
      logger.info('Agent run skipped — previous run still in progress');
      return { ran: false, agentsProcessed: 0 };
    }
    this.isProcessingAgents = true;
    let agentsProcessed = 0;
    try {
      // Deliberately cross-tenant: this sweep is meant to span every company's
      // active agents, not one tenant's (see lib/prisma.ts's prismaSystem doc).
      const agents = await prismaSystem.agent.findMany({
        where: {
          status: {
            in: ['discovering', 'running']
          }
        },
        include: {
          company: true
        }
      });

      logger.info({ count: agents.length }, 'Active agents found');

      for (const agent of agents) {
        try {
          await this.executeAgent({
            agentId: agent.id,
            companyId: agent.companyId,
            goal: agent.goal,
            guardrails: agent.guardrails as any
          });
          agentsProcessed++;
        } catch (error) {
          logger.error({ err: error, agentId: agent.id }, 'Error executing agent');
        }
      }
    } catch (error) {
      logger.error({ err: error }, 'Error in runAllAgents');
    } finally {
      this.isProcessingAgents = false;
    }

    return { ran: true, agentsProcessed };
  }

  /**
   * Execute a single agent tick.
   * Enqueues durable BullMQ jobs instead of running work inline so that LLM
   * failures are retried independently and don't block the orchestrator loop.
   */
  private async executeAgent(context: AgentExecutionContext) {
    const { agentId, companyId, goal, guardrails } = context;
    logger.info({ agentId, companyId }, 'Executing agent');

    const [enabled, killSwitch] = await Promise.all([
      getConfig(companyId, 'agent.campaign_cases_enabled'),
      getConfig(companyId, 'agent.kill_switch'),
    ]);
    if (!enabled || killSwitch) {
      await prisma.agent.update({ where: { id: agentId }, data: { status: 'paused' } });
      logger.warn({ agentId, companyId, enabled, killSwitch }, 'Agent execution disabled by tenant control');
      return;
    }

    // Step 1: Enqueue opportunity discovery.
    // The worker calls the LLM, persists discoveries, then chains campaign-generation
    // jobs for each new opportunity — all with 3-attempt exponential-backoff retry.
    await enqueueOpportunityDiscovery({ companyId, agentId, goal, guardrails: guardrails as any });

    // Step 2: Enqueue campaign generation for any existing uncampaigned opportunities.
    // The campaign worker performs its own idempotency check before creating.
    const existingUncampaigned = await prisma.opportunity.findMany({
      where: {
        companyId,
        campaigns: { none: { status: { in: ['Draft', 'Approved', 'Running', 'Launched'] } } },
      },
      select: { id: true, potentialRevenue: true, audienceSize: true },
    });

    for (const opp of existingUncampaigned) {
      if (!this.meetsGuardrails({ potentialRevenue: Number(opp.potentialRevenue) }, guardrails)) continue;
      await enqueueCampaignGeneration({
        opportunityId: opp.id,
        companyId,
        agentId,
        guardrails: guardrails as any,
        audienceSize: opp.audienceSize,
        potentialRevenue: Number(opp.potentialRevenue),
      });
    }

    logger.info({ existingOpps: existingUncampaigned.length }, 'Enqueued discovery + existing-opportunity campaign jobs');

    await prisma.agent.update({
      where: { id: agentId },
      data: {
        lastRunAt: new Date(),
        status: existingUncampaigned.length > 0 ? 'running' : 'discovering',
      },
    });

    // Workflow (ledger) first. Operator observes beside it. A throw here
    // must never fail the enqueue that already committed.
    if (process.env.SHADOW_AGENT === '1') {
      try {
        await this.observeShadow({ companyId, agentId, goal, guardrails });
      } catch (error) {
        logger.warn({ err: error, agentId }, 'shadow observe failed; enqueue path already committed');
      }
    }
  }

  /**
   * Check if an opportunity meets the agent's guardrails.
   *
   * Delegates to @growthos/domain so this check is the same deterministic function the
   * LangGraph agent will use as a graph node it cannot skip (docs/ARCHITECTURE_V2.md
   * Phase 4) — not a helper the orchestrator happens to call today and something else
   * reimplements tomorrow. Fixes one latent bug in the extraction: a `max_budget` of
   * exactly 0 is now enforced (the old `guardrails.max_budget &&` truthy check treated
   * 0 as "no budget set" and let anything through).
   */
  private meetsGuardrails(
    opportunity: { potentialRevenue: number },
    guardrails: Guardrails,
  ): boolean {
    return checkGuardrails({ potentialRevenue: opportunity.potentialRevenue }, guardrails).allowed;
  }

  /**
   * Manually trigger an agent run (useful for testing)
   */
  async runAgentOnce(agentId: string) {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId }
    });

    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    await this.executeAgent({
      agentId: agent.id,
      companyId: agent.companyId,
      goal: agent.goal,
      guardrails: agent.guardrails as any
    });
  }
}

// Singleton instance
export const agentOrchestrator = new AgentOrchestrator();
