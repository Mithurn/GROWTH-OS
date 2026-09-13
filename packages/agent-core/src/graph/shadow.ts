import { END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import { AgentState, type AgentStateType } from '../state';

/**
 * Smallest honest shadow graph: START → observe → END.
 *
 * No LLM. No mutating tools. Checkpointer is MemorySaver so a unit test can
 * prove thread isolation and resume without a database. PostgresSaver replaces
 * this at compile time once the checkpoint tables and `agent_runs` /
 * `agent_steps` migration exist — MemorySaver dies with the process, which is
 * exactly the Render spin-down failure Phase 2 is supposed to close.
 */
export function buildShadowGraph() {
  return new StateGraph(AgentState)
    .addNode('observe', (state: AgentStateType) => ({
      summary: `shadow observed company ${state.companyId}: ${state.goal}`,
    }))
    .addEdge(START, 'observe')
    .addEdge('observe', END)
    .compile({ checkpointer: new MemorySaver() });
}
