import type { Plan, Planner, ToolCall } from '../types';

/**
 * Offline planner (Zeno's mock provider). Tests the harness without an API key.
 * Each `next` return is one planner turn.
 */
export function scriptedPlanner(turns: Plan[]): Planner {
  let i = 0;
  return {
    async plan() {
      if (i >= turns.length) return { type: 'idle' };
      const turn = turns[i];
      i += 1;
      return turn;
    },
  };
}

export function calls(calls: ToolCall[]): Plan {
  return { type: 'calls', calls };
}

export function finish(summary: string): Plan {
  return { type: 'finish', summary };
}
