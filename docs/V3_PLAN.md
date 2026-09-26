# GrowthOS — Production Completion Plan

Updated 2026-09-21 (local verification and Phase 2 handoff). The execution plan
below is canonical. The original V3 backlog remains after it as detailed
historical context; where the two conflict, this section wins.

## Status snapshot (2026-09-20)

Branch: `main` (updated after Gate 1 merge). Local planning docs
(`PROGRESS.md`, this file) are gitignored.

**Gate 0 — complete except external credential rotation:**
- [x] Service-role data reads removed; `lib/scoped-query.ts` deleted
- [x] README / `docs/techstack.md` / security claims reconciled with live stack
- [x] Backend lint, dependency audit, Gitleaks, artifact CI checks
- [x] RLS: 19 integration tests pass locally against real PostgreSQL; hosted
  CI passed after merge
- [!] Credential rotation (Supabase DB password, Upstash, Stripe test secret)
  still blocked on a human action — record date only, never values

**Gate 1 — complete and locally verified:**
- [x] Typed `involvement_mode`; LangGraph `interrupt()` + PostgresSaver
- [x] Outbox → per-recipient `communication-dispatch` BullMQ jobs
- [x] Free-text involvement substring auto-launch deleted
- [x] Versioned approval snapshot: actor, audience/eligibility, predicted
  impact, tenant policy, guardrails, template markers, and provider mode
- [x] State machine: `PendingApproval → Approved → Dispatching → Completed |
  Partial | Failed | Cancelled`; drafts migrate into pending approval
- [x] Tenant-scoped launch rules: owner approval, consent/contact checks,
  unsubscribe, quiet hours/timezone, configured frequency cap, channel allowlist,
  max-budget guardrail, monthly recipient reservation, and non-empty audience
- [x] Approval inbox actions: owner-only approve/reject with reason, draft edit,
  approval expiry, cancellation, and LangGraph resume.
- [x] Gmail one-click unsubscribe plus provider request/callback and resume
  audit events.

**Gate 2 — campaign-case slice implemented; broader workflow remains:**
- [x] Typed LangGraph campaign case: Scout → Strategist → Reviewer → bounded
  revision, with durable Postgres checkpoints.
- [x] Evidence retrieval, faithfulness/risk review, reviewer audit events, and
  fail-closed human approval before launch.
- [x] Per-tenant agent controls, kill switch, max revisions, and campaign-case
  UI/run trace.
- [x] Local verification: 205 unit tests, 19 integration tests, frontend build,
  and channel-service build pass.
- [ ] Replace remaining deterministic discovery/persona paths with specialist
  graph nodes where evaluation proves a benefit.
- [ ] Add citations/evidence UI, parallel discovery, episodic outcome memory,
  per-tenant rollout controls, and browser end-to-end coverage.

**Remaining Gate 0 action:** rotate external credentials manually and record
only the rotation date. Gate 3–9 remain roadmap work.

## Handoff starter prompt

Continue from `main` at this checkpoint. Read this plan and inspect the current
diff before editing. The local stack runs with `./scripts/dev-local.sh`; full
verification runs with `./scripts/verify-local.sh`. Gate 0 is complete except
external credential rotation. Gate 1 is implemented and locally verified. Gate
2 has a working durable campaign-case graph and human approval path, but the
remaining unchecked Gate 2 items are intentional. Preserve deterministic
policy/launch ownership, tenant isolation, audit logging, and fail-closed
behavior. Start with the next unchecked Gate 2 item, add a focused test, and
run the relevant verification before changing later gates.

## Outcome

GrowthOS is complete only when one tenant can ingest imperfect retail data,
receive evidence-backed opportunities, let specialized agents draft a campaign,
approve or reject the exact proposed action, safely launch it, observe delivery
and revenue, and reproduce the result through tests, traces, data lineage, and a
public portfolio demo.

No framework, model, dashboard, or language counts because it is installed.
It counts only when it owns a real production responsibility and its failure is
covered by a runnable check.

## Product intent and delivery shape

GrowthOS is a usable, multi-tenant SaaS-style product and a serious portfolio
project—not a throwaway demo and not an attempt to reproduce every enterprise
marketing platform feature. The goal is a small number of complete, observable
workflows that real users can operate safely.

The project deliberately keeps the advanced stack, but introduces each part
only when it improves the customer workflow and has a measurable responsibility:

1. **Usable core:** ingest retail data, identify an opportunity, draft a
   campaign, require approval, send safely, and show the result.
2. **Working multi-agent system:** LangGraph coordinates specialist agents over
   typed state; a workflow can pause, recover, revise, and produce an execution
   receipt without bypassing the launch control plane.
3. **Evidence and data platform:** RAG, Python, pandas/NumPy, DuckDB, Pandera,
   dbt, and scheduled jobs earn their place by improving data quality, evidence,
   scoring, and reproducibility.
4. **Operating proof:** tenant analytics in the app, traces/evaluations, and an
   anonymized Tableau portfolio dashboard demonstrate outcomes and reliability.

The resume claim is the delivered behavior—multi-tenant isolation, durable
agent orchestration, evidence-backed decisions, safe execution, and tested data
workflows—not a list of installed frameworks.

## Engineering rules

1. **One owner per side effect.** LangGraph decides and pauses; the launch
   service validates and records; BullMQ dispatches. No second auto-launch path.
2. **Configuration where change is expected.** Tenant policy, plan limits,
   model choice, budgets, and operational thresholds are configuration. Stable
   algorithm constants and protocol values stay in code.
3. **Deterministic boundaries.** Models may rank, explain, retrieve, and draft.
   Code owns money, audiences, consent, quotas, policy verdicts, and sends.
4. **Evidence before claims.** A capability is `done` only after its acceptance
   scenario passes against the real service boundary it depends on.
5. **Use a framework for an owned problem.** A resume keyword without a live
   execution path is removed or moved to an explicit experiment.
6. **Incremental replacement.** Existing working paths stay available until the
   replacement passes parity tests; then the duplicate path is deleted.

Status: `[ ]` todo · `[~]` in progress · `[x]` verified · `[!]` blocked decision

## Architecture decisions

### Keep

| Technology | Decision |
|---|---|
| Next.js + React + TypeScript | Keep. Appropriate product/UI stack; add real query state and tests instead of replacing it. |
| Express 5 | Keep. Fastify would improve benchmarks, not this product's current bottlenecks; migration has no user value. |
| PostgreSQL/Supabase + Prisma | Keep. One transactional system of record, Auth, RLS, migrations, and pgvector. Service-role **data** reads are removed on `phase-2-complete`; Supabase JS remains Auth (and Storage when Gate 4 starts). |
| Redis + BullMQ | Keep for application jobs, retries, rate limits, streams, and recipient dispatch. It does not compete with the data orchestrator. |
| LangGraph + `@langchain/core` | Keep. This is already the LangChain ecosystem layer the product needs. LangGraph provides explicit state, subgraphs, checkpoints, `interrupt()` and `Command` resume. Do not add the umbrella `langchain` package without a concrete integration requiring it. |
| pgvector | Keep. Tenant data and vectors need transactional proximity; a hosted vector database adds another consistency boundary without current scale pressure. |
| OpenTelemetry + Sentry + Pino | Keep. Make Langfuse a verified OTLP consumer and preserve vendor-neutral tracing. |
| Vitest + Testcontainers | Keep. Extend into browser, queue, provider-contract, Python, and data-quality coverage. |
| OpenRouter/OpenAI-compatible SDK | Keep behind the current provider boundary; model choice remains configuration and eval-driven. |

### Replace or consolidate

| Current approach | Replacement |
|---|---|
| Custom frontend “SWR” Map/localStorage cache | TanStack Query for server state, invalidation, mutations, retries, and hydration. Keep localStorage only for intentional offline/demo state. |
| Supabase JS service-role data queries | **Done on `phase-2-complete`.** Prisma through tenant context/RLS. Supabase JS remains Auth and Storage only. |
| Free-text involvement substring auto-launch | **Done on `phase-2-complete`** (path deleted). Typed `involvement_mode` plus a versioned approval policy evaluated in code — policy snapshot still incomplete (Gate 1 `[~]`). |
| Campaign-wide `Promise.allSettled` fan-out | **Done on `phase-2-complete`.** Transactional outbox plus one idempotent BullMQ recipient job per communication. |
| `{ interrupt: true }` convention | **Interrupt/checkpoint done on `phase-2-complete`.** Real LangGraph `interrupt()` with PostgresSaver; approval inbox/`Command({ resume })` UI still open. |
| Plain-string agent handoffs | Typed shared graph state containing findings, evidence, draft, policy verdict, approval, and execution receipt. |
| Manual campaign embedding backfill | Event-driven embedding/upsert when campaign outcome or evidence changes. |
| Node.js row aggregation for analytics | dbt marts served from Postgres; API reads prepared aggregates. |
| Buffered fixed-schema CSV parsing | Object storage + DuckDB profiling + Pandera contracts + deterministic mapping executor. |
| Manual Python evaluation scripts | Versioned Python package used by the scheduled feature pipeline and CI. |

### Add when the owning phase starts

| Technology | Real responsibility |
|---|---|
| Python 3.12 + uv | Reproducible data/ML runtime and CI environment. |
| DuckDB | CSV dialect/type profiling and large-file analytical scans. |
| Pandera | DataFrame contracts, coercion reports, and quarantine reasons. |
| pandas + NumPy | Feature computation, calibration, statistical validation, and batch analytics. |
| dbt-core + dbt-postgres | Tested staging/intermediate/mart SQL and BI contracts. |
| Dagster | Scheduling, retries, backfills, lineage, partitions, and orchestration of Python assets plus dbt. Add after the first assets work from the CLI. |
| Langfuse | Agent/RAG traces, prompt versions, datasets, experiments, feedback, and calibrated evaluator scores. |
| Tableau Public | Public, anonymized portfolio BI dashboard fed from dbt export marts. It is not the tenant analytics runtime. |
| Playwright | One real browser journey from signup through approval and launch. |

### Defer unless evidence justifies them

| Technology | Reason |
|---|---|
| CrewAI/AutoGen | Replaces working LangGraph infrastructure without closing a product gap. Reconsider only if an eval shows LangGraph cannot express a required orchestration pattern. |
| MLflow | Add with the first genuinely trained/versioned CLV or churn model, not before a model artifact exists. |
| LightGBM + SHAP | Requires defensible labeled churn outcomes. Until then, rules or survival/CLV outputs must be labelled as estimates. |
| RAGAS/promptfoo | Use only for metrics not already covered by deterministic tests and Langfuse experiments. Do not duplicate failure signals. |
| Pinecone/Qdrant/Weaviate | No demonstrated pgvector capacity or isolation problem. |
| Spark/Ray/Kafka/Kubernetes/Temporal | No workload or reliability requirement currently justifies their operational surface. |
| Tableau Cloud embedded analytics | Requires licensing and tenant-aware authentication. Use the native app for private tenant analytics and Tableau Public only for anonymized portfolio data. |

## Canonical execution order

### Gate 0 — Truthful, secure baseline

- [x] RLS migration and runtime enforcement passed locally against real
      PostgreSQL (19 integration tests) and hosted CI/merge.
- [x] Remove the remaining service-role data reads and delete
      `lib/scoped-query.ts` after parity tests.
- [!] Rotate the Supabase DB password, Upstash token, and Stripe test secret;
      record only the rotation date, never values.
- [x] Reconcile the public README, current stack documentation, security policy,
      and live behavior. Remove
      “autonomous” claims until Gate 2 passes.
- [x] Add backend lint, dependency audit, secret scanning, and a CI assertion
      that generated/build artifacts are not committed.

**Pass:** two real tenants cannot read or mutate each other through Prisma,
raw SQL, REST, background jobs, or RLS-bypassing mistakes; CI is green from a
fresh clone; public claims match reachable behavior.

**2026-09-20 note:** credential rotation is the only remaining Gate 0 action.

### Gate 1 — Production launch control plane

- [x] Add typed `involvement_mode`: `manual`, `approve_above_threshold`,
      `autonomous_within_policy`. Existing strings are migrated; all modes fail
      closed to human approval until the policy control plane is complete.
- [x] Human approve/reject decisions atomically store an append-only,
      versioned policy snapshot with tenant, actor, audience eligibility,
      channel, predicted impact, timezone, quiet hours, frequency cap,
      approval TTL, budget, allowlist, template markers, provider, and reason.
- [x] PostgreSQL rejects launch without approval and enforces the dispatch
      state machine:
      `DRAFT → PENDING_APPROVAL → APPROVED → DISPATCHING → COMPLETED | PARTIAL | FAILED | CANCELLED`.
- [x] Enforce tenant ownership/RBAC, consent/unsubscribe, quiet hours/timezone,
      configured frequency cap, channel allowlist, quota reservation, budget
      guardrail, non-empty audience, and idempotency in the launch path.
- [x] Campaign drafts now pause in a real LangGraph `interrupt()` persisted by
      PostgresSaver and approve/reject resumes the deterministic campaign thread.
- [x] Approval inbox/API supports owner-only approve/reject with reason,
      draft editing, expiry, cancellation, pending-approval filtering, and
      `Command({ resume })`.
- [x] Replace fan-out with transactional outbox → per-recipient BullMQ jobs →
      provider adapter. Retries reuse the communication idempotency key.
- [x] Append-only audit events cover proposal, policy result, approval, resume,
      edit/override, claim, quota reservation, provider request/callback,
      delivery completion, cancellation, unsubscribe, and expiry.
- [x] Delete the queue substring auto-launch path after parity coverage.

**Pass:** implementation is complete. Re-run the real Postgres/Redis suite in
a Docker-enabled environment before describing Gate 1 as independently verified.

### Gate 2 — Working agent system

**Objective:** deliver one production-usable multi-agent campaign workflow,
not a collection of disconnected agent demos. The first release is a durable,
deterministic route: Discovery → Strategy → Evidence → Policy → Approval →
Execution. Each specialist has typed inputs/outputs and tool-scoped authority;
only the control plane can send.

**Implementation rules confirmed from LangGraph/Langfuse guidance:** keep graph
state raw and typed, format prompts at the node boundary, and make deterministic
code—not the model—own routing, policy, budgets, and sends. Every node that can
be retried must make pre-interrupt side effects idempotent, because resuming an
interrupt re-runs that node. Trace each agent, retrieval, model call, tool, and
approval as nested observations; redact PII and credentials before export.

**Build order:** complete the typed graph, deterministic route, evidence/policy
reflection, approval/restart path, and execution receipt first. Add parallel
discovery, episodic memory, tenant flags, and the graph/timeline UI after that
path has passing end-to-end coverage.

**2026-09-27 note:** the old single-thread ReAct supervisor (planner → tool
loop, `SHADOW_SUPERVISOR`/`SHADOW_AGENT` env gates, role-scoped tool catalog —
`packages/agent-core/src/{supervisor,tools,planner,mcp}/*`,
`backend/src/services/{agent-shadow,agent-tool-handlers,agent-planner,agent-graph}.ts`)
was confirmed dead (only reachable behind an env var, wrapped in a swallow-all
try/catch, no other file depended on it) and deleted. It ran alongside, not
inside, the real path below and had fully diverged from it.

**Current slice:** the real, always-on path is `packages/agent-core/src/graph/campaign-case.ts` —
a typed LangGraph state machine: scout (gather evidence + prior-campaign RAG)
→ strategist (record the already-drafted campaign for the trace) → reviewer
(risk + faithfulness) → conditional revise loop, bounded by
`agent.max_revisions`. It runs on every real campaign, not in shadow — a
blocked or unrevisable review stops launch even after human approval.
Feature-gating already exists per tenant via config
(`agent.campaign_cases_enabled`, `agent.kill_switch` in
`agent-orchestrator.ts`), not an env var.

- [x] Replace the supervisor loop with LangGraph nodes/subgraphs over typed
      state — done by deleting it; the campaign-case graph above is the only
      path left, and it was already typed-state LangGraph.
- [~] Keep deterministic routing first: Discovery → Strategy → Evidence →
      Policy → Approval → Execution. The sequence exists but split across two
      graphs (campaign-case for evidence/policy, campaign-approval for the
      human gate) rather than one; "Policy" isn't a distinct node, it's folded
      into the reviewer's risk check.
- [x] Add bounded reflection: failed evidence/policy returns specific
      objections to Strategy, with retry and wall-clock budgets. Both exist now:
      `agent.max_revisions` and `agent.max_wall_clock_ms`, checked together in
      the graph's conditional edge (`campaign-case.ts`).
- [ ] Use parallel discovery only for independent segments, then reduce into a
      deduplicated ranked opportunity set.
- [x] Make mutating tools real and idempotent. The launch tool calls the control
      plane; it never talks directly to providers — already true: there is no
      agent "tool" that sends anything. `communication-dispatch.ts` is the only
      code path that calls the channel service (confirmed by grep), and every
      graph node calls a plain deterministic service function, never a provider.
- [~] Add episodic memory from measured outcomes, with retention and tenant
      isolation; do not store hidden reasoning. Partially exists already:
      `campaign_embeddings` is real, tenant-scoped, event-driven (embedded once
      a campaign's delivery completes, `webhooks.ts`), and excludes reasoning
      (only objective/channel/offer/message/measured outcome). Missing:
      retention/expiry, and it's campaign-scoped only — personas, opportunity
      outcomes, and a playbook corpus are still Gate 3 work. Doing full episodic
      memory properly means doing it as part of Gate 3's corpus/provenance
      design, not a second bolt-on here — see Gate 3 below.
- [x] Replace environment-only enablement with per-tenant feature flags and a
      kill switch — already done in `agent-orchestrator.ts` via
      `agent.campaign_cases_enabled` / `agent.kill_switch` config keys.
- [ ] Build the agent graph/timeline UI with tool, retriever, agent, approval,
      and execution nodes.

**Pass:** the supervisor discovers an opportunity, retrieves evidence, drafts,
fails and revises when evidence is insufficient, pauses for approval, resumes
after restart, and produces an execution receipt under enforced budgets.

### Gate 3 — Complete RAG lifecycle

- [~] Define corpora and provenance: tenant campaign outcomes, personas,
      opportunity outcomes, product/catalog facts, and a curated public playbook.
      Campaign outcomes done (see below); personas, opportunity outcomes,
      product facts, and the public playbook are still open.
- [x] Add unique/version constraints and event-driven upserts (for the
      campaign-outcomes corpus). `campaign_embeddings` had neither: the write
      path already read `ON CONFLICT DO NOTHING` assuming a unique constraint
      that was never created, so a re-embed silently created a duplicate row.
      Added a partial unique index on `campaign_id` and converted the write to
      a real upsert (`source_version` bumps only on real content changes).
      Deletion is already reflected — `campaign_embeddings.campaign_id` cascades
      on the campaign FK. Still open for the other corpora once they exist.
- [x] Store source type/id/version, tenant scope, timestamps, model/version,
      content hash, and visibility with every embedding — done for the
      campaign-outcomes corpus (`source_type`, `source_version`,
      `model_version`, `content_hash`, `updated_at` columns).
- [x] Implement hybrid retrieval: pgvector cosine + PostgreSQL full-text,
      reciprocal-rank fusion, configurable `top_k` — done for the
      campaign-outcomes corpus (`searchSimilarCampaigns` in
      `campaign-embeddings.ts`; `rag.top_k`/`rag.candidate_limit`/`rag.rrf_k`
      config keys). Proven against real Postgres: an exact rare-term match
      outranks semantically-unrelated decoys. Metadata filters and a reranker
      not added — no evaluation yet showing either would help; revisit with
      Gate 3's eval dataset once it exists.
- [x] Require citations from draft claims to retrieved evidence. Unsupported
      numeric or historical claims fail closed. `campaign-faithfulness.ts`'s
      judge now splits a draft into individual claims and cites which
      retrieved campaign id backs each one, not just an overall pass/fail. A
      citation to an id that was never actually retrieved (a hallucinated
      citation) is downgraded to unsupported rather than trusted — validated
      against the real retrieval set, not the model's own say-so. Still
      unsupported → `needsRevision` → the graph's existing revise loop, same
      as before.
- [x] Add a bounded retrieve → draft → faithfulness → revise loop — this is
      exactly what `campaign-case.ts`'s scout → strategist → reviewer →
      revise graph already is (Gate 2), bounded by both revision count and
      wall-clock time.
- [ ] Create a real evaluation dataset from reviewed traces: retrieval hit,
      citation correctness, policy compliance, and unsupported-claim rate.
- [ ] Prove the embedding model on the deployment target for memory, download,
      cold-start, latency, and concurrency; swap models only on measured results.

**Pass:** new outcomes become searchable automatically; deletion is reflected;
cross-tenant retrieval is impossible; a versioned evaluation run beats the
agreed baseline and regressions fail CI or block rollout.

### Gate 4 — Python data platform

- [ ] Create `services/data-platform/` using uv, with unit tests and one CLI.
- [ ] Move uploads to Supabase Storage and store immutable ingestion manifests
      in Postgres.
- [ ] DuckDB profiles dialect, header, types, nulls, cardinality, ranges, and
      malformed rows without buffering the whole file.
- [ ] Pandera validates canonical customer/order frames and emits row-level
      quarantine reasons.
- [ ] Mapping proposal is reviewable; execution is deterministic and versioned.
- [ ] Promote NumPy/pandas RFM and estimator calibration into reusable package
      functions called by both Dagster assets and CI.
- [ ] Persist feature tables with `computed_at`, input snapshot, code version,
      model version, and quality status.
- [ ] Build dbt `staging → intermediate → marts` models for customer 360,
      campaign funnel, channel performance, opportunity pipeline, agent runs,
      and cost/usage. Add schema and relationship tests.
- [ ] After CLI materialization works, orchestrate Python and dbt assets with
      Dagster schedules, sensors, partitions, retries, backfills, and freshness
      checks.
- [ ] Add CLV/churn models only with adequate outcomes and a documented baseline;
      then add MLflow experiment/model tracking.

**Pass:** a non-template CSV moves from object storage through profile, reviewed
mapping, validation, quarantine, canonical tables, features, and dbt marts with
lineage; rerunning the same manifest is idempotent; Python tests and dbt build run
in CI.

**Current ingestion limit:** the TypeScript importer now normalizes headers,
trims values, validates mandatory order fields and numeric/date ranges, skips
malformed rows, prevents empty orders, and avoids replaying known external order
IDs. It is safe for the supplied schema, not a general arbitrary-CSV cleaning
platform; DuckDB profiling, Pandera quarantine, reviewed mappings, and a database
uniqueness constraint belong to Gate 4.

### Gate 5 — Analytics and Tableau

- [ ] Change API analytics reads to dbt marts and define freshness/error states.
- [ ] Keep the in-product Recharts dashboard for authenticated, tenant-private,
      operational analytics.
- [ ] Build a Tableau workbook from anonymized demo marts: executive overview,
      customer segments, campaign funnel, channel performance, opportunity
      pipeline, and agent/evidence quality.
- [ ] Publish to Tableau Public and embed the public view on the portfolio/demo
      page with Tableau Embedding API v3.
- [ ] Add export metadata: snapshot time, pipeline run id, mart version, and
      anonymization statement.

**Pass:** product charts and Tableau agree on defined metrics for the same
snapshot; the workbook is publicly accessible, contains no tenant PII, and can
be regenerated from a documented pipeline run.

### Gate 6 — AI/LLM engineering and observability

- [ ] Configure Langfuse ingestion and verify a real trace after deployment.
      Agent roles use `agent`, retrieval uses `retriever`, model calls use
      `generation`, and nesting reflects the actual graph.
- [ ] Capture model, prompt version, token usage, cost, latency, tenant/user,
      run/thread id, tool result summaries, retrieval ids, approval outcome, and
      errors without PII or credentials.
- [ ] Move stable prompts into version control/Langfuse prompt management with
      explicit versions and rollback; code contracts remain in Zod.
- [ ] Use provider-native structured output from Zod-derived schemas.
- [ ] Build datasets from reviewed production/demo traces. Prefer deterministic
      evaluators for schema, citations, policy, tool choice, and state-machine
      correctness; calibrate every LLM judge against human-labelled examples.
- [ ] Run offline experiments before model/prompt/retrieval changes and sample
      useful online evaluations after release.
- [ ] Capture explicit approval edits/rejections and downstream conversion as
      feedback signals; do not treat clicks alone as model quality.

**Pass:** a production trace reconstructs the agent's available evidence and
actions without leaking private data; a versioned experiment can compare two
variants; calibrated quality gates prevent a known regression.

### Gate 7 — Full-stack product completion

- [ ] Replace custom cache with TanStack Query and centralize typed API errors.
- [ ] Componentize oversized pages around product boundaries, not arbitrary file
      length.
- [ ] Complete responsive, keyboard, focus, empty, loading, partial-failure,
      reconnect, and accessibility states.
- [ ] Ship onboarding mapping review, approval inbox, agent graph, evidence
      citations, pipeline health, analytics freshness, integration health, and
      audit views.
- [ ] Add component tests for critical state and Playwright for signup → ingest
      → opportunity → draft → approve → launch → delivery analytics.

**Pass:** the Playwright journey runs against an isolated full stack; an operator
can understand and recover every failure without reading server logs.

### Gate 8 — Reliability, delivery, and operations

- [ ] Deploy API and worker as separate services; verify graceful drain and job
      continuation during independent restarts.
- [ ] Add staging/preview configuration, migration verification, seed/reset, and
      backup/restore drills. Never run tests against shared production data.
- [ ] Add CI jobs for TypeScript, Python, dbt, migrations, provider contracts,
      Playwright, secret/dependency scanning, builds, and selected agent/RAG
      experiments.
- [ ] Define SLOs for API availability, queue delay, launch completion,
      ingestion completion, agent success, retrieval latency, and data freshness.
- [ ] Add dashboards and actionable alerts tied to those SLOs, plus runbooks for
      stuck jobs, provider outage, bad migration, data-quality failure, and model
      rollback.
- [ ] Load-test webhook ordering/idempotency and recipient dispatch; publish
      measured p50/p95/p99 and correctness results.

**Pass:** a staged release survives restart, duplicate events, provider failure,
bad input, and rollback drills; alerts identify the failed boundary; recovery is
documented and repeatable.

### Gate 9 — Portfolio proof

- [ ] Record the complete demo and publish architecture, agent, RAG, data-lineage,
      and deployment diagrams.
- [ ] Publish only measured metrics: tests, eval dataset size, retrieval/quality
      scores, pipeline duration, load latency, correctness, and recovery time.
- [ ] Link the live app, repository, Tableau dashboard, trace screenshots, and
      a short engineering case study covering failures and tradeoffs.
- [ ] Generate resume/LinkedIn bullets only from passed gates.

**Pass:** every portfolio claim links to code, a runnable check, a measured
result, or a public artifact; no roadmap item is presented as shipped.

## First implementation slice

Work begins with Gate 0, then the smallest vertical slice of Gate 1:

1. Finish and verify tenant RLS/data-access consolidation.
2. Introduce typed involvement mode and campaign state transitions.
3. Replace the substring launch rule with one policy function plus tests.
4. Add real LangGraph approval interrupt/resume around that policy.
5. Route one approved campaign through the existing safe launch function.
6. Only then replace fan-out with recipient jobs/outbox.

This produces a demonstrable production control path before adding another
framework.

---

## Historical V3 backlog

Written 2026-09-18. One pass, in dependency order. Every step is sequenced so
that nothing later has to be redone.

**Three rules this plan enforces everywhere:**

1. **Nothing hardcoded.** No magic number, threshold, weight, rate, model name,
   plan limit, or currency lives in a `.ts` file. It lives in the database,
   resolved per tenant, with a typed schema and a default. See Phase 1.
2. **Nothing hand-rolled.** If a maintained library does it, use the library.
   Our own implementations of Sentry, JSON-mode parsing, rate-limit stores, and
   pagination all get deleted. See the "Hand-rolled → replace" table.
3. **Real usage only.** Every model is fitted on real rows, every metric is
   measured not asserted, every eval runs in CI against real data. Nothing
   ships as a simulator, a stub, or a number we chose because it looked right.

Status legend: `[ ]` todo · `[x]` done

---

## Phase 0 — Stop the bleeding

These are live defects. Nothing else should start until they're closed, because
several later phases increase the traffic that triggers them.

### 0.1 Rate limiting is one global bucket

`backend/src/server.ts` never sets `trust proxy`, so behind Render's proxy every
request keys to the same IP. All four limiters in
`backend/src/middleware/rate-limits.ts` are therefore a single shared bucket for
the entire platform, and the store is in-memory so it also breaks on a second
instance.

- [x] `app.set('trust proxy', 1)` in `server.ts` before any limiter mounts
- [x] Add `rate-limit-redis`, back every limiter with the existing ioredis client
- [x] `keyGenerator` keys on `req.companyId` where present, falling back to IP —
      per-tenant quotas, not per-IP
- [ ] Limits come from `plan_limits` (Phase 3), not from literals

### 0.2 Deploys kill in-flight jobs

No `SIGTERM` handler exists anywhere, and `startWorkers()` runs inside the API
process (`server.ts:100`). Every deploy drops jobs mid-send.

- [x] Split workers into their own Render service (`worker: node dist/worker.js`)
      with a shared build; API and workers stop competing for the same event loop
- [x] `SIGTERM`/`SIGINT` handler: stop accepting connections, `worker.close()`
      to drain, `queue.close()`, `prisma.$disconnect()`, `redis.quit()`, then exit
- [ ] `server.close()` with a drain deadline read from config, not a literal

### 0.3 Campaign creation can double-send

`backend/src/lib/queues.ts:155` checks for an existing campaign then creates one.
Two concurrent jobs both pass the check. Combined with 0.2's stalled-job re-runs,
this is a live duplicate-WhatsApp-message path.

- [x] Migration: partial unique index
      `CREATE UNIQUE INDEX ON campaigns(opportunity_id) WHERE status IN ('Draft','Approved','Running','Launched')`
- [x] Replace the read-then-write with an upsert, catching `P2002` as "already
      handled" — the database decides, not application code

### 0.4 Stripe webhooks have no idempotency

`backend/src/services/billing.ts:86` processes every delivery, with no event-id
record and no ordering guard — while `processed_webhook_events` already exists
and is used correctly for delivery webhooks (`backend/src/services/webhooks.ts:142`).

- [x] Record `event.id` in `processed_webhook_events` inside the same transaction
      as the plan update; a duplicate insert short-circuits the handler
- [x] Ignore events older than the stored `planUpdatedAt` so out-of-order
      retries cannot downgrade a paying tenant
- [ ] Return 200 immediately, enqueue processing — Stripe's timeout is 10s and
      cold Render instances lose that race

### 0.5 Sentry is hand-rolled

`backend/src/lib/sentry.ts` is a bare DSN poster called from exactly one place
(`errorHandler.ts:4`). It cannot see unhandled rejections, worker crashes, or
anything outside the Express error path.

- [x] `npm i @sentry/node`, init with the OTel integration so spans and errors
      share trace ids
- [x] Delete `lib/sentry.ts` entirely
- [x] Init in both the API and the new worker entrypoint

### 0.6 Auto-launch decides by substring match

`queues.ts:172-176` sends real messages when a free-text field contains `'auto'`,
below a hardcoded `20000` threshold.

- [x] Threshold itself now reads `approval.auto_launch_max_value` from config
      instead of a bare `20000` literal
- [ ] Replace with an `involvement_mode` enum column and an approval policy read
      from config (Phase 1)
- [ ] Above the threshold, raise a LangGraph `interrupt()` for human approval
      (Phase 5.4) instead of silently not launching

---

## Phase 1 — Configuration layer: nothing hardcoded

The foundation for everything after it. Every later phase reads its constants
from here, so this comes before the pipeline and before the agent work.

### 1.1 Schema

```
config_defaults   key, value (jsonb), schema_version, description
plan_config       plan_id, key, value      -- per-plan overrides
company_config    company_id, key, value   -- per-tenant overrides
```

Resolution order, implemented once in `backend/src/lib/config.ts`:
**company → plan → global default → Zod schema default.** No other path exists.

### 1.2 Typing and safety

- [x] One Zod schema per config key in `packages/contracts/src/config/`, so an
      invalid value fails at write time, not at read time
- [x] `getConfig(companyId, key)` returns a parsed, typed value; Redis-cached
      with a pub/sub invalidation on write
- [x] A startup assertion that every key in the Zod registry has a
      `config_defaults` row — a missing default is a boot failure, not a silent
      `undefined`

### 1.3 Migrate every literal

Full inventory in the **Hardcoded values** table at the bottom. Each one becomes
a config key in the same commit that removes the literal.

- [x] Scoring weights and thresholds (`packages/domain/src/rfm/scoring.ts`)
- [x] Estimator prior, prior weight, z-score (`packages/domain/src/impact/estimate.ts`)
- [x] Queue attempts, backoff, concurrency (`backend/src/lib/queues.ts`)
- [x] Rate limits, upload caps, page sizes, chunk sizes
- [~] LLM model, timeout, retries, max tokens — done for the global default
      (`config/openrouter.ts` now reads `schemaDefault`, not a literal) and for
      `llm.pricing.*` (`cost-ledger.ts`, live per-tenant). `llm.parse_retry.*`
      (`lib/ai.ts`) still hardcoded — ~20 call sites rely on its default param,
      not converted this pass. Per-tenant live model override not wired either
      (13 call sites read `openRouterConfig.defaultModel` directly)
- [x] Currency and locale — `₹` is hardcoded in `queues.ts:118` and
      `campaign-embeddings.ts:23`; it becomes a company column formatted through
      `Intl.NumberFormat`
- [ ] ESLint rule banning numeric literals in `packages/domain` so this cannot
      regress

---

## Phase 2 — One data access layer, real tenant isolation

Today Supabase JS (service role, RLS bypassed) and Prisma both write the same
Postgres — `backend/src/services/ingestion.ts:52-67` reads a company through one
and creates it through the other. Tenancy is enforced only by application code,
on four tables (`backend/src/middleware/auth.ts:90`), while `orders`,
`order_items`, `customer_metrics`, and `customer_attributes` carry no
`company_id` at all (`backend/src/lib/scoped-query.ts:15`).

- [x] Migration: add `company_id` to those four tables, backfill from the parent
      customer, then `SET NOT NULL` + FK + composite index `(company_id, id)`
- [x] Prisma client extension that throws when `companyId` is absent on
      list/bulk ops (`findMany`/`count`/`updateMany`/`deleteMany`) — isolation
      becomes structural, not a thing each route remembers. Does not inject a
      companyId (throw > guess). Single-row `findUnique`/`update`/`delete` still
      rely on `requireCompanyOwnership`.
- [ ] Enable RLS on every tenant table as a second layer; the app connects as a
      non-superuser role with `SET LOCAL app.company_id` per transaction
- [ ] Delete `lib/scoped-query.ts` — still used by opportunities/campaigns/
      personas/insights (Supabase REST). Dead once those queries go through Prisma
- [x] Replace `supabase.auth.getUser()` with local JWKS/HS256 verification via
      `jose`, cached. Cloud project is ES256 (JWKS live). HS256 needs
      `SUPABASE_JWT_SECRET`.
- [ ] Supabase JS stays for Auth only, never for data — `resolveCompanyMiddleware`
      still reads `profiles` via the service-role client

**Verification:** extend `backend/src/__tests__/integration/tenant-isolation.integration.test.ts`
to assert that a query missing `companyId` throws, and that RLS blocks a
cross-tenant read even when the app-layer filter is deliberately removed.

---

## Phase 3 — Entitlements, metering, and a real paywall

Today there is exactly one entitlement check in the codebase
(`backend/src/services/campaigns.ts:48`) and the plan model is a two-value string
(`backend/src/services/billing.ts:5`).

### 3.1 Plans come from Stripe, not from code

- [ ] `plans` and `plan_limits` tables, populated by syncing Stripe Products and
      Prices on boot and on `product.updated` — adding a plan is a Stripe
      dashboard action, never a deploy
- [ ] `plan_limits` rows: `max_customers`, `max_campaigns_per_month`,
      `max_messages_per_month`, `max_agent_runs_per_month`, `max_seats`,
      `monthly_llm_budget_usd`, `queue_priority`, `rate_limit_rpm`

### 3.2 Enforcement in one place

- [ ] `assertQuota(companyId, metric, n)` middleware, applied declaratively per
      route; the limit is looked up, never passed in
- [ ] `usage_counters (company_id, metric, period_start, value)` incremented via
      an atomic `INSERT ... ON CONFLICT DO UPDATE SET value = value + n` so
      concurrent jobs cannot race past a limit
- [ ] Reserve-then-commit for expensive operations: reserve the quota before the
      LLM call, release on failure — fixes the check-then-spend race in
      `backend/src/services/cost-ledger.ts:55`
- [ ] Budget enforcement fails **closed** once a real budget exists; today
      `cost-ledger.ts:61` and `:82` both fail open

### 3.3 Billing lifecycle

- [ ] Stripe Customer Portal for card updates, plan changes, cancellation
- [ ] Handle `invoice.payment_failed` → dunning state, `invoice.paid` → clear it,
      `checkout.session.expired`, `customer.subscription.trial_will_end`
- [ ] Grace period from config, not an instant drop to free (`billing.ts:105`)
- [ ] Trials with a real end date, enforced by the same quota layer
- [ ] Seats: drop the unique constraint on `companies.user_id`
      (`20260627175139_add_profiles_and_formalize_schema/migration.sql:30`), add
      a `memberships` table with roles. One company/one user caps pricing forever
- [ ] Stripe metered billing for message volume, reported from `usage_counters`

---

## Phase 4 — The data platform

A separate Python service. TypeScript stops computing analytics and becomes the
serving layer.

### 4.1 Service scaffold

- [ ] `services/feature-pipeline/`, managed with `uv`, deployed as a Render
      cron job
- [ ] `pandera` schemas at every boundary — the CSV contract, the feature table
      contract, the model input contract. This is also the enabler for the
      arbitrary-schema CSV importer that was deferred
- [ ] `duckdb` reads the uploaded CSV directly from object storage and profiles
      it without loading it into memory, replacing the buffer-everything
      `parseCSV` at `backend/src/services/ingestion.ts:18`
- [ ] CSVs move to Supabase Storage; stop writing 10MB `bytea` blobs onto
      `ingestion_sessions` rows (`ingestion.ts:75`)

### 4.2 dbt

- [ ] `analytics/` dbt project against Supabase Postgres
- [ ] `staging` → `intermediate` → `marts` layers
- [ ] The marts replace the in-JS aggregation in
      `backend/src/services/analytics.ts`, which today fetches rows and sums them
      in Node
- [ ] dbt tests (`unique`, `not_null`, `relationships`, `accepted_values`) run in
      CI — data quality becomes a gate

### 4.3 Real models, fitted on real rows

- [ ] **Quantile RFM.** Promote `packages/evals/python/rfm_analysis.py` from a
      manual script to a pipeline stage. Real R/F/M quintiles replace the
      hand-weighted composite in `packages/domain/src/rfm/scoring.ts` — that file
      is not RFM, it's six invented constants
- [ ] **CLV** via BG/NBD + Gamma-Gamma (`lifetimes`), giving expected future
      transactions and value per customer
- [ ] **Churn probability** via `lightgbm`, with SHAP values persisted so the
      agent can cite *why* a customer is at risk instead of asserting it
- [ ] **Empirical Bayes prior**: fit the global conversion prior per opportunity
      type across all tenants, replacing the hardcoded `0.05` at
      `packages/domain/src/impact/estimate.ts:66`. The prior becomes measured
- [ ] **Monte Carlo revenue interval**: sample the rate from the Beta posterior
      and AOV from its empirical distribution. Replaces the normal approximation
      at `estimate.ts:88`, which ignores AOV variance entirely and is why the
      interval is too narrow
- [ ] Output lands in `customer_features` and `opportunity_priors`, both with
      `computed_at` and `model_version`. TypeScript reads these tables and does
      no statistics of its own

### 4.4 Orchestration and model tracking

- [ ] **Dagster** for the DAG, with software-defined assets so lineage from CSV
      to feature to campaign is visible and backfillable. Replaces the ad-hoc
      re-queue loop at `backend/src/lib/queues.ts:231`
- [ ] **MLflow** for experiment tracking and the model registry; the serving
      layer reads the model version from the registry, never a pinned file path

---

## Phase 5 — An actual multi-agent system

LangGraph already supports all of this. Today `packages/agent-core/src/supervisor/run.ts:84`
is a `while` loop over a fixed four-element array (`supervisor/roles.ts:41`). No
new framework is needed — CrewAI or AutoGen would be a downgrade.

### 5.1 Typed blackboard state

- [ ] Replace the plain-string handoff (`run.ts:88`, `priorSummary`) with a typed
      `Annotation` channel per artifact: findings, drafts, evidence, verdicts.
      Today Strategy receives prose and has to re-parse what Discovery found

### 5.2 Reflection loop

- [ ] Conditional edge: faithfulness fails → route back to Strategy with the
      judge's specific objections, bounded by a retry budget from config
- [ ] Today a failed check just ends the run. A critic that forces revision is
      the clearest structural difference between an agent and a pipeline

### 5.3 Parallel fan-out

- [ ] Use LangGraph's `Send` API to run Discovery across N segments concurrently,
      then a reducer node merges findings
- [ ] This is what "multi-agent" actually means; a sequential loop is not it

### 5.4 Human-in-the-loop

- [ ] Wire `interrupt()` into the production graph. It's already proven against a
      real resume cycle in
      `backend/src/__tests__/integration/agent-checkpoint.integration.test.ts`
      but nothing in production calls it
- [ ] Approval thresholds come from config; this is also the correct fix for 0.6

### 5.5 Cross-run memory

- [ ] `agent_memory` table: episodic records of what was tried and what the
      measured outcome was, embedded and retrieved at run start
- [ ] Every run starts blind today. A table plus the existing pgvector is smaller
      than adding LangMem and does the same job

### 5.6 Routing

- [ ] Once 5.1–5.5 land and evals show the fixed sequence falling short, replace
      `nextRole()` (`run.ts:40`) with LLM-driven routing under a hard step budget
      and a circuit breaker. Not before — the current comment is right that a
      loop without a breaker is the expensive failure

---

## Phase 6 — RAG completeness

The stack is right: pgvector with an HNSW cosine index
(`backend/prisma/migrations/20260913171000_campaign_embeddings_pgvector/migration.sql:36`)
and MiniLM-L6-v2 in-process (`backend/src/lib/embeddings.ts:29`). Do not migrate
to a hosted vector DB. The problems are the write path and the corpus.

### 6.1 Fix the write path

- [ ] `embedCampaignOutcome` (`backend/src/services/campaign-embeddings.ts:36`)
      has no production caller — only tests and the manual backfill. Retrieval
      therefore returns `[]` for every tenant, always. Call it on campaign
      completion and on every performance update
- [ ] Add the unique constraint on `campaign_embeddings(campaign_id)` that
      `ON CONFLICT DO NOTHING` (`:59`) already assumes exists; without it that
      clause is dead and re-embedding duplicates rows
- [ ] Re-embed on performance change, so evidence stops reading
      "no delivery outcome recorded yet" forever

### 6.2 Fix the cold start

The corpus is the tenant's own campaigns only, so a new customer retrieves
nothing — the user who most needs guidance gets the least.

- [ ] Embed personas and opportunity outcomes, not just campaigns
- [ ] A shared, non-tenant playbook corpus so a day-one tenant has real evidence
      to ground against, clearly labelled as general rather than their own history

### 6.3 Retrieval quality

- [ ] Hybrid search: Postgres `tsvector` full-text alongside the vector query,
      fused with Reciprocal Rank Fusion. Pure SQL, no new dependency
- [ ] Rerank with `bge-reranker-base` through the `@huggingface/transformers`
      dependency already present
- [ ] Query rewriting / HyDE before retrieval
- [ ] `top_k` and score thresholds from config, not call sites

---

## Phase 7 — Observability and evals

- [ ] **Langfuse**: the OTLP env vars already exist unused in `render.yaml:57`.
      Setting them gives the agent graph view, per-tenant LLM cost, prompt
      versioning, and eval storage. Cheapest large win in this document
- [ ] **Prompts move to Langfuse** — out of inline strings, versioned, editable
      without a deploy
- [ ] **Structured output**: replace the markdown-strip-then-parse in
      `backend/src/lib/ai.ts:22` with OpenAI structured outputs
      (`response_format: json_schema`), generated from the existing Zod schemas
      via `zod-to-json-schema`. Stop parsing model prose
- [ ] **RAGAS** in CI: context precision/recall, faithfulness, answer relevance,
      against a golden set built from real tenant data
- [ ] **promptfoo** in CI: prompt regressions fail the build
- [ ] **Python evals in CI**: the harness in `packages/evals/python` already
      found two real bugs and still runs only by hand
- [ ] **PostHog**: product analytics, feature flags, session replay in one
      dependency. Flags replace `SHADOW_SUPERVISOR=1`-style env gating
- [ ] Add `npm audit`, `gitleaks`, and backend lint to `.github/workflows/ci.yml`

---

## Phase 8 — Platform surface

- [ ] **OpenAPI generated from the existing Zod contracts** via
      `@asteasolutions/zod-to-openapi` — `packages/contracts` already holds the
      schemas, so the spec and docs are nearly free
- [ ] Customer-facing API keys and outbound webhooks, so tenants can integrate
- [ ] `audit_log` table for every mutating action — a B2B requirement
- [ ] Expose the MCP adapter (`packages/agent-core/src/mcp/adapter.ts`) over
      Streamable HTTP; the list/call surface exists but has no transport
- [ ] Rotate the three credentials noted in `handover.md`

---

## Hardcoded values to migrate (Phase 1.3 checklist)

Every row is a literal in code today that must become a config key.

| Value | Location | Becomes |
|---|---|---|
| `>= 8` orders, `<= 45` days | `packages/domain/src/rfm/scoring.ts:42` | `rfm.frequency.high` |
| `>= 3` orders, `<= 120` days | `rfm/scoring.ts:45` | `rfm.frequency.medium` |
| `365` day recency decay | `rfm/scoring.ts:59` | `rfm.recency.window_days` |
| `totalOrders * 12` | `rfm/scoring.ts:61` | superseded by real quintiles (4.3) |
| `log10(spent+1) / 4` | `rfm/scoring.ts:64` | superseded by real quintiles (4.3) |
| `0.45 / 0.35 / 0.2` weights | `rfm/scoring.ts:66` | superseded by real quintiles (4.3) |
| `0.05` global prior | `packages/domain/src/impact/estimate.ts:66` | fitted, empirical Bayes (4.3) |
| `20` prior weight | `estimate.ts:67` | `estimator.prior_weight` |
| `1.645` z-score | `estimate.ts:89` | superseded by Monte Carlo (4.3) |
| `20000` auto-launch cap | `backend/src/lib/queues.ts:176` | `approval.auto_launch_max_value` |
| `attempts: 3`, `delay: 2000` | `queues.ts:33-38` | `queue.retry.*` |
| concurrency `2 / 3 / 1 / 1` | `queues.ts:141,197,209,219` | `queue.<name>.concurrency` |
| `200`/15m, `10`/60s, `20`/15m, `600`/60s | `backend/src/middleware/rate-limits.ts:4-43` | `plan_limits.rate_limit_rpm` |
| `10 MB`, `files: 2` | `backend/src/middleware/upload.ts:7-11` | `plan_limits.max_upload_bytes` |
| `200` chunk, `1000` page, `5000` max read | `backend/src/lib/scoped-query.ts:8,52,53` | deleted with the file (Phase 2) |
| `60_000` timeout, `maxRetries: 1` | `backend/src/config/openrouter.ts:30,38` | `llm.timeout_ms`, `llm.max_retries` |
| `maxAttempts = 3`, `1000 * 2^n` | `backend/src/lib/ai.ts:15,29` | `llm.parse_retry.*` |
| `0.30 / 2.50` per Mtok | `backend/src/services/cost-ledger.ts:44-45` | `llm.pricing.<model>`, synced from OpenRouter |
| `₹` and `en-IN` | `queues.ts:118`, `campaign-embeddings.ts:23` | `companies.currency` + `Intl.NumberFormat` |
| `maxStepsPerRole ?? 6` | `packages/agent-core/src/supervisor/run.ts:96` | `agent.max_steps_per_role` |
| `21_600_000` agent interval | `backend/src/server.ts:105` | `agent.interval_ms` |
| `24h` cutoff, `take: 20` | `backend/src/services/ingestion.ts:234,242` | `ingestion.resume.*` |
| `FAILURE_RATE: 10` | `render.yaml` | simulator-only; removed when sends are real |

## Hand-rolled → replace

| Hand-rolled today | Replace with | Why |
|---|---|---|
| `backend/src/lib/sentry.ts` DSN poster | `@sentry/node` | Misses unhandled rejections, worker crashes, everything outside the Express error path |
| Markdown-strip + JSON.parse (`lib/ai.ts:22`) | OpenAI structured outputs + `zod-to-json-schema` | Stop parsing prose when the API can guarantee the shape |
| In-memory rate-limit store | `rate-limit-redis` | Breaks on the second instance |
| `lib/scoped-query.ts` batching/paging | Prisma queries | Exists only to work around the Supabase REST client |
| `supabase.auth.getUser()` per request | `jose` + cached JWKS | A network round-trip on every single request |
| In-JS analytics aggregation | dbt marts | Fetching rows to sum them in Node does not scale |
| `parseCSV` buffering (`ingestion.ts:18`) | DuckDB + Pandera | Whole file in memory on a 512MB instance |
| Manual quintile/statistics code | numpy / pandas / lifetimes / lightgbm | Real libraries, real fitted parameters |
| Ad-hoc job re-queue (`queues.ts:231`) | Dagster assets | Backfills and lineage instead of a boot-time sweep |

---

## Tech stack — what and why

One line each, so this is checkable.

### Already in use, keeping

| Tool | Why |
|---|---|
| **TypeScript** | Shared types across API, workers, contracts, and agent core. |
| **Express 5** | Native async error handling; the app is routes and middleware, nothing more exotic is warranted. |
| **Prisma 7** | Typed queries and a real migration history; client extensions are how tenant scoping becomes structural. |
| **Supabase (Postgres + Auth)** | One managed Postgres with auth attached; pgvector and RLS come with it. |
| **pgvector** | Vectors live beside the rows they describe, so retrieval joins tenant data without a second datastore. |
| **BullMQ + ioredis** | Durable retries and backoff for work that outlives a request. |
| **Redis (Upstash)** | Queue backing, config cache, rate-limit store, and Streams for live updates. |
| **LangGraph** | Explicit graph state with Postgres checkpointing, so an agent run is resumable and inspectable. |
| **@huggingface/transformers** | Embeddings in-process via ONNX: no API cost, no second service, no network hop. |
| **OpenRouter + OpenAI SDK** | One API across model providers, so the model is a config value rather than a rewrite. |
| **Zod** | One schema definition drives validation, tool contracts, config typing, and the OpenAPI spec. |
| **Stripe** | Subscriptions, hosted checkout, portal, and metered billing without building any of it. |
| **OpenTelemetry** | Vendor-neutral traces across API, workers, and both services. |
| **pino** | Structured JSON logs that correlate to trace ids. |
| **Vitest + Testcontainers** | Unit tests fast, integration tests against a real Postgres running real migrations. |
| **esbuild** | Fast bundles; the CI build runs the identical command Render does. |
| **pandas / numpy** | The analysis layer where statistics belong, on real `customer_metrics` rows. |

### Adding

| Tool | Why |
|---|---|
| **Langfuse** | LLM tracing, prompt versioning, and eval storage; the OTLP variables are already declared and unused. |
| **RAGAS** | Measures retrieval and faithfulness, turning a judge we built into a number we can defend. |
| **promptfoo** | Makes prompt regressions fail CI instead of reaching production. |
| **dbt** | Versioned, tested SQL transforms replacing aggregation done in Node. |
| **Dagster** | Software-defined assets give lineage from CSV to feature to campaign, and real backfills. |
| **DuckDB** | Profiles and reads large CSVs without loading them into memory. |
| **Pandera** | Schema contracts on every dataframe boundary; also unlocks arbitrary-schema CSV mapping. |
| **lifetimes** | BG/NBD and Gamma-Gamma CLV — the standard models, not a heuristic we invented. |
| **LightGBM + SHAP** | Churn probability with per-customer reasons the agent can actually cite. |
| **MLflow** | Model versions and metrics tracked, so serving reads a registry rather than a pinned path. |
| **PostHog** | Product analytics, feature flags, and session replay in one dependency. |
| **@sentry/node** | Real error tracking, correlated to OTel traces. |
| **rate-limit-redis** | Rate limits that survive more than one instance. |
| **jose** | Local JWT verification, removing a network call from every request. |
| **zod-to-json-schema** | Turns existing Zod schemas into enforced LLM output schemas. |
| **@asteasolutions/zod-to-openapi** | Generates the public API spec from contracts that already exist. |
| **uv** | Fast, reproducible Python environments for the pipeline service. |

### Deliberately not adding

| Tool | Why not |
|---|---|
| **CrewAI / AutoGen / Swarm** | Would replace LangGraph with less control over state and checkpointing. |
| **LangChain proper** | Only LangGraph is used today; the retriever and model wrappers would add indirection over working code. |
| **Pinecone / Qdrant / Weaviate** | pgvector with HNSW is sufficient and keeps vectors transactionally consistent with their rows. |
| **Feast** | A `customer_features` table with `computed_at` does the same job at this scale. |
| **Spark / Ray** | No data volume here justifies distributed compute. |
| **Airflow** | Heavier than Dagster with worse local development and no asset lineage. |
| **Temporal** | BullMQ plus the LangGraph Postgres checkpointer already provide durable execution. |
| **Terraform / Pulumi** | `render.yaml` is the whole infrastructure. |
| **Kong / API gateway** | Express middleware covers auth, limits, and routing at this size. |

---

## Sequencing

Phases 0 → 1 → 2 must run in order; each depends on the one before. After Phase
2, these can proceed in parallel:

- **3** (paywall) — independent, and the fastest path to a sellable product
- **4** (data platform) — the longest phase, start it early
- **5 + 6** (agent + RAG) — share the config and tenancy work from 1 and 2
- **7** (observability) — Langfuse can land at any point and makes everything
  after it easier to debug
- **8** (platform surface) — last, because it exposes everything above it

Each phase ends the same way: `tsc`, unit tests, integration tests, the real
build, CI green, then merge. Every real bug found goes into `docs/breaks.md` in
the same session.
