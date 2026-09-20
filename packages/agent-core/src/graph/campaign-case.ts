import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';

export type CampaignCaseEvidence = Record<string, unknown>;
export type CampaignCaseReview = {
  blocked: boolean;
  needsRevision: boolean;
  report: Record<string, unknown>;
};

export interface CampaignCaseNodes {
  scout: () => Promise<CampaignCaseEvidence>;
  strategist: () => Promise<Record<string, unknown>>;
  reviewer: () => Promise<CampaignCaseReview>;
  revise: (report: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

const CampaignCaseState = Annotation.Root({
  caseId: Annotation<string>,
  revisionCount: Annotation<number>({ reducer: (_previous, next) => next, default: () => 0 }),
  maxRevisions: Annotation<number>,
  evidence: Annotation<CampaignCaseEvidence>({ reducer: (_previous, next) => next, default: () => ({}) }),
  strategy: Annotation<Record<string, unknown>>({ reducer: (_previous, next) => next, default: () => ({}) }),
  review: Annotation<CampaignCaseReview>({
    reducer: (_previous, next) => next,
    default: () => ({ blocked: false, needsRevision: false, report: {} }),
  }),
  status: Annotation<'RUNNING' | 'READY_FOR_APPROVAL' | 'BLOCKED'>({ reducer: (_previous, next) => next, default: () => 'RUNNING' }),
});

export type CampaignCaseStateType = typeof CampaignCaseState.State;

export function campaignCaseThreadId(caseId: string): string {
  return `campaign-case:${caseId}`;
}

export function buildCampaignCaseGraph(nodes: CampaignCaseNodes, checkpointer: BaseCheckpointSaver) {
  return new StateGraph(CampaignCaseState)
    .addNode('scout', async () => ({ evidence: await nodes.scout() }))
    .addNode('strategist', async () => ({ strategy: await nodes.strategist() }))
    .addNode('reviewer', async () => ({ review: await nodes.reviewer() }))
    .addNode('revise', async (state) => ({
      strategy: await nodes.revise(state.review.report),
      revisionCount: state.revisionCount + 1,
    }))
    .addNode('complete', (state) => ({ status: state.review.blocked || state.review.needsRevision ? 'BLOCKED' : 'READY_FOR_APPROVAL' }))
    .addEdge(START, 'scout')
    .addEdge('scout', 'strategist')
    .addEdge('strategist', 'reviewer')
    .addConditionalEdges('reviewer', (state) => {
      if (state.review.blocked) return 'complete';
      if (state.review.needsRevision && state.revisionCount < state.maxRevisions) return 'revise';
      return 'complete';
    }, { revise: 'revise', complete: 'complete' })
    .addEdge('revise', 'reviewer')
    .addEdge('complete', END)
    .compile({ checkpointer });
}
