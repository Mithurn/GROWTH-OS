# @growthos/agent-core

Single-thread GrowthOS agent. Phase 2 is **shadow mode**: one planner, read +
control tools, observe and record beside `AgentOrchestrator`. No mutating
tools. Spec: `DESIGN.md`. Plan: `docs/ARCHITECTURE_V2.md` §3.

**No `package.json` here, same as `packages/domain` and `packages/contracts`.**
LangGraph is installed on the backend (`@langchain/langgraph`, `@langchain/core`)
and resolved through path aliases. Nested `tsconfig.json` maps `@langchain/*`
into `backend/node_modules` so esbuild can resolve them (same hole contracts
hit with `zod`).

This package owns the loop, the catalog, and the permission gate. It does not
know about RFM, campaigns, or Prisma — handlers live in
`backend/src/services/agent-tool-handlers.ts`.

## Layout

- `DESIGN.md` — sourced spec. A later change that violates §3 is a bug.
- `src/graph/run.ts` — planner → tools → route. Stop in code (finish, step
  budget, two idles, wall-clock, deny).
- `src/tools/` — namespaced catalog + deny-first `invokeTool`.
- `src/planner/scripted.ts` — offline planner so tests need no API key.
- `src/planner/observe-script.ts` — deterministic observe tape used when
  there is no LLM key. Reads prior tool results; does not invent rupees.
- `src/mcp/adapter.ts` — same catalog over list/call. Not a second server.
- `src/graph/shadow.ts` — leftover observe-only graph; kept for the original
  thread-isolation tests.

## Running the tests

```bash
cd backend && npx vitest run
```
