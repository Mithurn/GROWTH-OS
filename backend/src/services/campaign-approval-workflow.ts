import { Command } from '@langchain/langgraph';
import {
  buildCampaignApprovalGraph,
  campaignApprovalThreadId,
  type CampaignDecision,
} from '@growthos/agent-core';
import { getDurableAgentCheckpointer } from '../lib/agent-checkpointer';

async function graphFor(campaignId: string) {
  const graph = buildCampaignApprovalGraph(await getDurableAgentCheckpointer());
  const config = { configurable: { thread_id: campaignApprovalThreadId(campaignId) } };
  return { graph, config };
}

export async function ensureCampaignApprovalWorkflow(input: {
  campaignId: string;
  companyId: string;
}) {
  const { graph, config } = await graphFor(input.campaignId);
  const state = await graph.getState(config);
  if (state.values.campaignId) return state.values;

  const result = await graph.invoke({
    campaignId: input.campaignId,
    companyId: input.companyId,
  }, config);
  if (!(result as { __interrupt__?: unknown[] }).__interrupt__?.length) {
    throw new Error('Campaign approval workflow did not pause for human approval');
  }
  return result;
}

export async function resumeCampaignApprovalWorkflow(
  campaignId: string,
  decision: CampaignDecision,
) {
  const { graph, config } = await graphFor(campaignId);
  const state = await graph.getState(config);
  if (state.values.decision === decision.decision) return state.values;
  if (!state.values.campaignId) throw new Error('Campaign approval workflow was not started');
  return graph.invoke(new Command({ resume: decision }), config);
}
