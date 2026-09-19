import { Annotation, END, START, StateGraph, interrupt } from '@langchain/langgraph';
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';

export type CampaignDecision = {
  decision: 'approved' | 'rejected';
  actorId: string;
  reason?: string;
};

const CampaignApprovalState = Annotation.Root({
  companyId: Annotation<string>,
  campaignId: Annotation<string>,
  decision: Annotation<'pending' | 'approved' | 'rejected'>({
    reducer: (_previous, next) => next,
    default: () => 'pending',
  }),
  actorId: Annotation<string>({
    reducer: (_previous, next) => next,
    default: () => '',
  }),
  reason: Annotation<string>({
    reducer: (_previous, next) => next,
    default: () => '',
  }),
});

export type CampaignApprovalStateType = typeof CampaignApprovalState.State;

export function campaignApprovalThreadId(campaignId: string): string {
  return `campaign-approval:${campaignId}`;
}

export function buildCampaignApprovalGraph(checkpointer: BaseCheckpointSaver) {
  return new StateGraph(CampaignApprovalState)
    .addNode('humanApproval', (state) => {
      const response = interrupt({
        type: 'campaign_approval',
        companyId: state.companyId,
        campaignId: state.campaignId,
      }) as CampaignDecision;
      if (!response || !['approved', 'rejected'].includes(response.decision) || !response.actorId) {
        throw new Error('Invalid campaign approval decision');
      }
      return {
        decision: response.decision,
        actorId: response.actorId,
        reason: response.reason ?? '',
      };
    })
    .addEdge(START, 'humanApproval')
    .addEdge('humanApproval', END)
    .compile({ checkpointer });
}
