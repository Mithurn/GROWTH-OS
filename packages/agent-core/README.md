# @growthos/agent-core

Two LangGraph state machines, both real production paths (not shadow/demo
code): campaign approval and the campaign case review.

**No `package.json` here, same as `packages/domain` and `packages/contracts`.**
LangGraph is installed on the backend (`@langchain/langgraph`, `@langchain/core`)
and resolved through path aliases. Nested `tsconfig.json` maps `@langchain/*`
into `backend/node_modules` so esbuild can resolve them (same hole contracts
hit with `zod`).

Each graph is deterministic, typed state in, typed state out — no LLM picks
which node runs next. An LLM only appears inside a node's own function (draft
generation, the faithfulness judge, risk review), never as the router.

## Layout

- `src/graph/campaign-approval.ts` — the human approval gate. Pauses on a real
  LangGraph `interrupt()`, persisted by `PostgresSaver`; approve/reject resumes
  the same thread. Backs `backend/src/services/campaign-approval-workflow.ts`.
- `src/graph/campaign-case.ts` — scout (gather evidence) → strategist (record
  the drafted campaign) → reviewer (risk + faithfulness) → conditional revise
  loop, bounded by `maxRevisions`. Backs `backend/src/services/campaign-case.ts`.
- `src/checkpoint/postgres.ts` — the shared `PostgresSaver` checkpointer both
  graphs use.

An earlier single-thread ReAct-style agent (planner → tool-calling loop, role-
scoped tool catalog, `SHADOW_SUPERVISOR`/`SHADOW_AGENT` env gates) lived here
and was retired once the two deterministic graphs above became the real
production path — see `docs/breaks.md` if you're looking for why.

## Running the tests

```bash
cd backend && npx vitest run
```
