import { Annotation } from '@langchain/langgraph';

/**
 * Graph state for the shadow-mode agent.
 *
 * `companyId` is written by the runtime from the authenticated run context.
 * The model never sees a tool that can set it — that invariant is enforced
 * later when tools are bound; the field is required on input so a run
 * without a tenant cannot start.
 */
export const AgentState = Annotation.Root({
  companyId: Annotation<string>,
  goal: Annotation<string>,
  /**
   * Last observation the graph produced. Shadow mode's only write: a sentence
   * the Run Trace can show later. Not a campaign, not a send.
   */
  summary: Annotation<string>({
    reducer: (_prev: string, next: string) => next,
    default: () => '',
  }),
});

export type AgentStateType = typeof AgentState.State;
