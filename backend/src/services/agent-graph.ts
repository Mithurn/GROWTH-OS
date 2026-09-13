/**
 * Backend entry onto @growthos/agent-core.
 *
 * The orchestrator now invokes `runShadowObserve` (planner → tools loop).
 * This re-export stays so the original observe-only graph remains testable
 * and so anything that still imported it does not break.
 */
export { buildShadowGraph } from '@growthos/agent-core';
