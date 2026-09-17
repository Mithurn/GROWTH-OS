# GrowthOS agent — design, sourced

This is the spec the code is written against. If a later change violates a
row in §3, that is a bug, not an enhancement.

---

## 1. What we are not building

The tempting architecture for a "growth agent" is a swarm: a planner agent, a
metrics agent, a copy agent, a launch agent, talking to each other. That is
the architecture Cognition (Devin) spent 2025 arguing **against**, and the
architecture Claude Code deliberately refused for anything that writes.

Cognition, *Don't Build Multi-Agents* (2025-06-12):

> Actions carry implicit decisions, and conflicting decisions carry bad
> results. … running multiple agents in collaboration only results in fragile
> systems. The decision-making ends up being too dispersed and context isn’t
> able to be shared thoroughly enough.

Claude Code's actual design (as of mid-2025, cited in the same essay): a
subagent is allowed to **answer a question**. It is never allowed to write
in parallel with the parent. The parent waits. There is one thread of
decisions.

Anthropic, *Building Effective Agents* (2024-12-19), still the right
definition in 2026:

> Agents are typically just LLMs using tools based on environmental feedback
> in a loop.

Zeno (HanishDhanwalkar/Zeno, 2026) — the lean open-source harness, not a
marketing swarm — ships **exactly four tools**, a permission gate *before*
invocation, a mock provider so the loop is testable offline, and a stateless
Python core that receives a pruned message list every turn.

HumanLayer *12-Factor Agents* (25k★): the products that survive production
are "mostly just software" with LLM steps at the points that need judgment.
Teams that grab a framework, hit an 80% quality ceiling, then reverse-engineer
the framework, start over. We will not start over.

**So we will not:** spawn a metrics agent and a copy agent; hide the prompt
inside `createReactAgent`; wrap every existing Express route as a tool; dump
the tenant's entire metrics table into the system prompt; let the model set
`companyId`; let the model invent rupees.

### Faces are not agents

GrowthOS has several *faces* — discovery, sizing, copy, approval, launch,
analytics, MCP, chat. That is a product surface area, not a reason to run
four LLM brains at once.

| What you see in the product | What it actually is | How many models decide |
|---|---|---|
| Opportunity discovery | A *skill* + read tools + later a mutating tool | One planner, same thread |
| Campaign draft | A *skill* loaded when the planner chooses `draft_campaign` | Same planner. Copy is a tool result, not a second agent |
| Guardrails / approval | Code + `interrupt()` (a human-as-tool) | Zero models. A veto the planner cannot skip |
| Launch | An `external` tool behind the same gate | Same thread. Claim-then-send is already code |
| Analytics / MCP | The same read registry, different transport | No new brain |
| Cron tick vs chat | Factor 11: trigger from anywhere, same `run()` | Same agent |

Claude Code looks like it has "many agents" (Explore, Plan, implement). Under
the hood that is **one parent** plus **question-only subagents that return a
paragraph and die**. They never write in parallel. Cognition's rule: if two
writers cannot see each other's implicit decisions (tone, audience, budget),
the join step inherits the conflict.

The current orchestrator already looks like "two agents" (discover job, then
campaign job). That is a **workflow** — a predefined code path — not a
multi-agent system. We keep that DAG for the known pipeline. The new graph
is the *judgment* layer on top: which segment, whether to continue, when to
stop. It calls tools. It does not hire colleagues.

When context overflows on a long investigate (Phase 7 RAG, a fat campaign
history), the allowed exception is Claude Code's: spawn a **read-only
investigator**, parent waits, investigator returns ≤2k tokens, dies. No
parallel writes. That is a later optimization, not the starting shape.

---

## 2. What the best systems actually share

Convergent design, 2024–2026, across Anthropic, Cognition, HumanLayer, Claude
Agent SDK, Zeno:

| # | Principle | Source | What it means here |
|---|---|---|---|
| 1 | Agent = LLM + tools in a loop | Anthropic 2024; 12-factor §1 | One planner, one thread, observations feed the next turn |
| 2 | Own the prompt | 12-factor §2; Anthropic "don't hide under a framework" | Versioned markdown in this package, not a LangGraph default |
| 3 | Own the context window | 12-factor §3; Anthropic *Effective context engineering* 2025-09-29 | JIT tools, not a preamble dump. Compact errors. Prune old tool results |
| 4 | Tools are structured outputs | 12-factor §4; Anthropic *Writing effective tools* 2025-09-11 | Zod in `@growthos/contracts`. Same schema for the graph and MCP |
| 5 | Unify execution state and business state | 12-factor §5 | `agent_runs` / `agent_steps` are queryable product state. The LangGraph checkpoint is only *how to resume* |
| 6 | Launch / pause / resume | 12-factor §6; Claude Agent SDK sessions | `thread_id` = `runId`. Render spin-down is resume, not restart |
| 7 | Contact humans with tools | 12-factor §7; Claude `canUseTool` / `interrupt()` | Approval is a tool-shaped pause, not a `String.includes('autopilot')` |
| 8 | Own control flow; pause between **select** and **invoke** | 12-factor §8; Claude Agent SDK permission pipeline | PreToolUse hook + kind filter + tenant injection *before* the handler runs |
| 9 | Compact errors into context | 12-factor §9; Anthropic ACI | Tool errors are short, actionable, never a stack trace |
| 10 | Small, focused agent | 12-factor §10; Zeno "exactly 4 tools" | Shadow mode: read + think + finish. Not 40 overlapping wrappers |
| 11 | Trigger from anywhere | 12-factor §11 | Same `run()` from cron, `runAgentOnce`, and (later) chat |
| 12 | Stateless reducer | 12-factor §12; Zeno "Node sends the full pruned list" | `(state, event) → state`. The process holds nothing that a restart would lose |
| 13 | Permission is deny-first and outside the model | Claude Agent SDK: hooks → deny → mode → allow → `canUseTool` | The model cannot talk past a `readOnly` registry |
| 14 | Share the full trace | Cognition principle 1 | Every step sees prior steps. No parallel writers |
| 15 | Offline-testable loop | Zeno mock provider | Scripted planner in tests. No API key to prove the harness |
| 16 | Numbers the model must never produce | Our §5 determinism boundary | Revenue, audience size, guardrail verdicts are code |

---

## 3. Locked architecture for GrowthOS

```
                    ┌──────────────────────────────────────┐
  goal + runCtx ───▶│  reduce(state, event)                │
                    │                                      │
                    │  event: start | observation |        │
                    │         tool_error | budget |        │
                    │         human_decision | stop        │
                    └──────────────────┬───────────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              ▼                        ▼                        ▼
        plan (LLM)              execute tools              END
        owns the prompt         PreToolUse ──┐             summary
        cannot see companyId    strip companyId            required
        cannot invent rupees    kind allowlist
                                inject companyId
                                handler (backend)
                                PostToolUse (trace)
                                compact error
```

**One thread.** The planner sees the full step trace. If we ever add a
read-only "investigator" (Claude Code's question-only subagent), it returns a
paragraph and dies. It never writes opportunities or campaigns.

**Two kinds of state, on purpose** (ARCHITECTURE_V2 §3.1, 12-factor §5):

- Checkpoint (MemorySaver now, PostgresSaver when the migration is applied):
  how to resume after Render sleeps.
- `agent_runs` / `agent_steps`: what happened, what the Run Trace UI queries,
  what an auditor reads. A checkpoint you cannot query is not an audit log.

**Permission mode default: `shadow`.** Equivalent to Claude's `plan`
mode. The registry physically does not contain mutating tools unless
`resolvePermissionMode` returns `live` (`AGENT_LIVE=1` **and**
`guardrails.live === true`). The orchestrator never sets live. A model that
emits `create_opportunity` in shadow gets a compact error. `request_approval`
returns `{ interrupt: true }` and the graph stops for a human. Launch never
sends — the Launch button owns claim-then-send.

**`companyId` is run context, never a tool argument.** If the model sends it
anyway, it is stripped and ignored. The handler receives it from the runtime.

---

## 4. Tool surface (shadow)

Anthropic: few tools, distinct jobs, namespaced, token-efficient,
`response_format`, errors that teach. Zeno: four tools that cover the
job. We have a different job (read a tenant's growth state), so a different
four-plus-two, not forty wrappers.

| Tool | Why it exists | What it refuses to be |
|---|---|---|
| `growthos_query_metrics` | One snapshot: counts, AOV, segment sizes. JIT context. | `list_customers` (brute-force into the window) |
| `growthos_segment_customers` | Size + sample for one `OpportunityType`. Audience is code. | A tool that lets the model invent a predicate |
| `growthos_list_opportunities` | What already exists, concise. | A second discovery LLM |
| `growthos_estimate_impact` | Domain Bayesian estimator. | Asking the model for rupees |
| `growthos_read_campaign_performance` | Funnel numbers for one campaign. | The analytics LLM-insights path |
| `growthos_search_prior_campaigns` | Stub until Phase 7 RAG. Honest empty + reason. | Fake semantic search |
| `growthos_check_guardrails` | Domain `checkGuardrails`. | A prompt that "keeps budget in mind" |
| `growthos_think` | Anthropic think-tool: scratchpad before a choice. | Hidden chain-of-thought we cannot audit |
| `growthos_finish` | Terminal edge. Requires a summary. | Implicit "I think we're done" |

`response_format: concise | detailed` on list/read tools. Default `concise`.
Hard cap on rows (8). Truncation tells the model to narrow the query.

---

## 5. Stop conditions — code, not vibe

Enforced as graph edges / reducer cases, never as "please stop eventually":

1. `growthos_finish` called with a non-empty summary
2. Step budget exhausted (default 8 in shadow; 12 later)
3. Wall-clock slice exceeded
4. Planner returns no tool calls twice in a row (confused → stop, don't spin)
5. PreToolUse hard-deny of a mutating tool in `shadow` (does not consume the
   step budget as a success)
6. Later: cost-ledger veto; `interrupt()` for approval

---

## 6. What Phase 2 ships versus what it prepares

Ships now:

- This spec
- The reducer + permissioned registry + scripted-planner tests
- The nine tool schemas in `@growthos/contracts`
- Backend handlers for the six read tools (Prisma, tenant-scoped)
- `agent_runs` / `agent_steps` migration **written, not applied**
- Fail-soft shadow invoke on the existing orchestrator tick
- MCP list/call adapter over the same registry (no second schema)

Prepared, not faked:

- PostgresSaver (needs the migration applied + `setup()` ownership decision)
- Per-tenant live invoke from the orchestrator (handlers exist; flag stays off)
- Real RAG for `search_prior_campaigns` (pgvector migration written, not applied)
- OTel exporter to Langfuse (Phase 9) — spans are recorded as `agent_steps`
  in the shape an exporter can later lift. Do not add a fake vendor span.

---

## 7. Sources

- Anthropic, *Building Effective Agents*, 2024-12-19
- Anthropic, *Writing effective tools for agents — with agents*, 2025-09-11
- Anthropic, *Effective context engineering for AI agents*, 2025-09-29
- Anthropic, *The think tool*, 2025-03-20
- Cognition / Walden Yan, *Don't Build Multi-Agents*, 2025-06-12
- HumanLayer, *12-Factor Agents*, https://github.com/humanlayer/12-factor-agents
- Claude Agent SDK overview, permission pipeline, sessions, hooks
- Zeno lean harness, https://github.com/HanishDhanwalkar/Zeno (4 tools,
  permission-before-invoke, mock provider, stateless pruned context)
- GrowthOS `docs/ARCHITECTURE_V2.md` §3, §5, §12
