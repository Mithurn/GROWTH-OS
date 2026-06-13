import { prisma } from '../lib/prisma';
import { discoverOpportunities } from './opportunity-discovery';
import { createCampaignForOpportunity } from './campaign-planner';
import { logAgentAction } from './agent-logger';

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
    }
  }

  /**
   * Execute a single agent
   */
  private async executeAgent(context: AgentExecutionContext) {
    const { agentId, companyId, goal, guardrails } = context;

    console.log(`🚀 Executing agent ${agentId} for company ${companyId}`);

    // Get involvement preference from guardrails
    const involvement = (guardrails as any).involvement || 'review every campaign';

    // Step 1: Discover new opportunities
    const opportunities = await discoverOpportunities(companyId, agentId, goal);

    if (opportunities.length > 0) {
      console.log(`✨ Agent discovered ${opportunities.length} opportunities`);

      await logAgentAction({
        agentId,
        actionType: 'discovered_opportunity',
        description: `Discovered ${opportunities.length} new opportunities worth ₹${opportunities.reduce((sum, opp) => sum + Number(opp.potentialRevenue), 0).toLocaleString('en-IN')}`,
        details: {
          opportunityIds: opportunities.map(o => o.id),
          count: opportunities.length
        }
      });
    }

    // Step 2: For each opportunity, check if we should launch a campaign
    for (const opportunity of opportunities) {
      // Check if we already have a campaign for this opportunity
      const existingCampaign = await prisma.campaign.findFirst({
        where: {
          opportunityId: opportunity.id,
          status: {
            in: ['Draft', 'Approved', 'Running', 'Launched']
          }
        }
      });

      if (existingCampaign) {
        console.log(`⏭️  Campaign already exists for opportunity ${opportunity.id}`);
        continue;
      }

      // Check guardrails before creating campaign
      if (!this.meetsGuardrails(opportunity, guardrails)) {
        console.log(`⚠️  Opportunity ${opportunity.id} doesn't meet guardrails`);
        continue;
      }

      // Create campaign
      const campaign = await createCampaignForOpportunity(
        opportunity.id,
        companyId,
        agentId,
        guardrails
      );

      await logAgentAction({
        agentId,
        actionType: 'launched_campaign',
        description: `Created campaign "${campaign.name}" targeting ${opportunity.audienceSize} customers`,
        details: {
          campaignId: campaign.id,
          opportunityId: opportunity.id,
          audienceSize: opportunity.audienceSize,
          potentialRevenue: opportunity.potentialRevenue
        }
      });

      // Auto-approve and launch based on involvement preference
      const shouldAutoLaunch = await this.shouldAutoLaunch(involvement, opportunity);

      if (shouldAutoLaunch) {
        console.log(`🚀 Auto-launching campaign ${campaign.id} (${involvement} mode)`);

        // Import and use the launchCampaign from campaign-planner
        const { SupabaseClient, createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Approve the campaign first
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            status: 'Approved',
            approvedAt: new Date()
          }
        });

        // Launch the campaign (this will send to channel service)
        try {
          const { launchCampaign } = await import('./campaigns');
          await launchCampaign(supabase, campaign.id);

          await logAgentAction({
            agentId,
            actionType: 'launched_campaign',
            description: `Auto-launched campaign "${campaign.name}" to ${opportunity.audienceSize} customers`,
            details: {
              campaignId: campaign.id,
              mode: involvement
            }
          });

          console.log(`✅ Campaign ${campaign.id} auto-launched successfully`);
        } catch (launchError) {
          console.error(`Failed to auto-launch campaign ${campaign.id}:`, launchError);
        }
      } else {
        console.log(`⏸️  Campaign ${campaign.id} created as Draft - waiting for approval (${involvement} mode)`);
      }
    }

    // Update agent's last run time
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        lastRunAt: new Date(),
        status: opportunities.length > 0 ? 'running' : 'discovering'
      }
    });
  }

  /**
   * Determine if a campaign should be auto-launched based on involvement preference
   */
  private async shouldAutoLaunch(involvement: string, opportunity: any): Promise<boolean> {
    // Normalize involvement string
    const involvementLower = involvement.toLowerCase();

    // Autopilot: Launch everything automatically
    if (involvementLower.includes('autopilot') || involvementLower.includes('auto')) {
      return true;
    }

    // Review major campaigns only: Auto-launch small campaigns (< ₹20k potential revenue)
    if (involvementLower.includes('major') || involvementLower.includes('review major')) {
      const potentialRevenue = Number(opportunity.potentialRevenue);
      return potentialRevenue < 20000; // Auto-launch campaigns under ₹20k
    }

    // Review every campaign: Never auto-launch
    return false;
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
