import { prisma } from '../lib/prisma';
import { enqueueOpportunityDiscovery, enqueueCampaignGeneration } from '../lib/queues';

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

  /**
   * Start the orchestrator - runs agents on a schedule
   */
  async start(intervalMs: number = 60000) {
    if (this.isRunning) {
      console.log('Agent orchestrator already running');
      return;
    }

    this.isRunning = true;
    console.log('🤖 Starting Agent Orchestrator...');

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
    console.log('🛑 Agent Orchestrator stopped');
  }

  /**
   * Run all active agents
   */
  private async runAllAgents() {
    if (this.isProcessingAgents) {
      console.log('⏭️  Agent run skipped — previous run still in progress');
      return;
    }
    this.isProcessingAgents = true;
    try {
      // Get all agents that are in 'discovering' or 'running' status
      const agents = await prisma.agent.findMany({
        where: {
          status: {
            in: ['discovering', 'running']
          }
        },
        include: {
          company: true
        }
      });

      console.log(`🔍 Found ${agents.length} active agents`);

      for (const agent of agents) {
        try {
          await this.executeAgent({
            agentId: agent.id,
            companyId: agent.companyId,
            goal: agent.goal,
            guardrails: agent.guardrails as any
          });
        } catch (error) {
          console.error(`Error executing agent ${agent.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in runAllAgents:', error);
    } finally {
      this.isProcessingAgents = false;
    }
  }

  /**
   * Execute a single agent tick.
   * Enqueues durable BullMQ jobs instead of running work inline so that LLM
   * failures are retried independently and don't block the orchestrator loop.
   */
  private async executeAgent(context: AgentExecutionContext) {
    const { agentId, companyId, goal, guardrails } = context;
    const involvement = (guardrails as any).involvement || 'review every campaign';

    console.log(`🚀 Executing agent ${agentId} for company ${companyId}`);

    // Step 1: Enqueue opportunity discovery.
    // The worker calls the LLM, persists discoveries, then chains campaign-generation
    // jobs for each new opportunity — all with 3-attempt exponential-backoff retry.
    await enqueueOpportunityDiscovery({ companyId, agentId, goal, guardrails: guardrails as any, involvement });

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
      if (!this.meetsGuardrails(opp, guardrails)) continue;
      await enqueueCampaignGeneration({
        opportunityId: opp.id,
        companyId,
        agentId,
        guardrails: guardrails as any,
        involvement,
        audienceSize: opp.audienceSize,
        potentialRevenue: Number(opp.potentialRevenue),
      });
    }

    console.log(`📋 Enqueued discovery + ${existingUncampaigned.length} existing-opportunity campaign jobs`);

    await prisma.agent.update({
      where: { id: agentId },
      data: {
        lastRunAt: new Date(),
        status: existingUncampaigned.length > 0 ? 'running' : 'discovering',
      },
    });
  }

  /**
   * Check if an opportunity meets the agent's guardrails
   */
  private meetsGuardrails(
    opportunity: any,
    guardrails: { max_budget?: number; frequency_cap?: number; channels?: string[] }
  ): boolean {
    // For now, simple validation
    // In production, you'd check budget constraints, frequency caps, etc.

    if (guardrails.max_budget && opportunity.potentialRevenue > guardrails.max_budget) {
      return false;
    }

    return true;
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
