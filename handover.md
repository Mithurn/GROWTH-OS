# GrowthOS handover

## Start here

- Branch: `phase-2-complete`
- Remote: `origin/phase-2-complete`
- Latest pushed checkpoint: `ea12d01 Harden CI and patch vulnerable dependencies`
- Canonical working plan: `docs/V3_PLAN.md` (intentionally local/ignored); this file is the tracked continuation guide.

GrowthOS is a human-approved AI growth system. It is not ready to claim autonomous production operation.

## Verified delivered work

- Tenant data access uses Prisma transactions with PostgreSQL RLS. Backend Supabase usage is Auth-only with `SUPABASE_ANON_KEY`; the service-role data client and `scoped-query.ts` are removed.
- Personas, onboarding, customer attributes, opportunities, campaigns, and analytics have moved from Supabase PostgREST to tenant-scoped Prisma.
- Campaign launch atomically creates communication rows and `QUEUED` events, then enqueues one BullMQ recipient job per communication. Dispatch retries, frequency-cap reservations, callback HMAC verification, webhook deduplication, and ordered delivery transitions are implemented.
- Campaign approval uses a PostgreSQL-persisted LangGraph interrupt/resume workflow. Typed involvement modes fail closed to approval.
- CI now runs backend lint, typecheck, unit tests, real PostgreSQL integration tests, API/worker builds, frontend lint/typecheck/build, channel-service build, critical runtime dependency audits, Gitleaks history scanning, and tracked-artifact rejection.
- `SECURITY.md`, `README.md`, backend documentation, and the public landing page were corrected to match the current behavior.

## Validation baseline

Run from `backend/`:

```bash
npm run lint
npx tsc --noEmit
npm test
DOCKER_HOST=unix:///Users/mithurnjeromme/.colima/default/docker.sock \
TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock \
npm run test:integration
npm run build
npm run build:worker
```

Current passing baseline: 197 unit tests and 19 real PostgreSQL integration tests. The frontend and channel service also pass their typecheck, lint/build where applicable, and critical dependency audit.

## Environment and deployment rules

- Never use or reintroduce a Supabase service-role key for application data access.
- Required backend runtime configuration includes `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_ANON_KEY`, `REDIS_URL`, `WEBHOOK_SECRET`, and `INTERNAL_API_SECRET`.
- Production deployments and shared-database migrations require a human. Do not run them from this workspace.
- `render.yaml` currently runs BullMQ workers in the API process because the free-tier budget cannot support a separate always-on worker. Before production traffic, enable the worker service and set `WORKERS_IN_API_PROCESS=false` on the API.
- CI runs on `main`, so the hosted workflow still needs confirmation after this branch is merged or its trigger scope is deliberately expanded.

## Known risks and external blocker

- A human must rotate the Supabase database password, Upstash token, and Stripe test secret, then record only the rotation date. No secret values belong in Git, logs, or this document.
- Backend `npm audit` still reports high-severity advisories through Prisma CLI-only dependencies. The application uses PostgreSQL and does not bundle that chain; `SECURITY.md` records the exception. CI blocks critical runtime advisories.
- Delivery is at-least-once. Resend receives an idempotency key; Twilio does not yet provide an equivalent durable provider-side key in this integration.
- The current frontend lint emits pre-existing warnings, not errors.

## Next work, in order

1. Complete Gate 1 launch policy: RBAC, consent/unsubscribe, quiet hours/timezone, channel allowlist, budget/quota reservation, audience validation, approval expiry/editing, and complete append-only audit trail.
2. Enable and validate the dedicated worker deployment once hosting is available.
3. Complete Gate 2: move the current shadow graph to the real typed LangGraph supervisor path; keep deterministic routing and approval-required rollout.
4. Complete Gate 3 RAG: provenance-rich pgvector records, hybrid retrieval, citations, deletion/offboarding, and an evaluation dataset.
5. Add the Python data platform only when its first real asset is ready: `uv`, pandas/NumPy/Pandera/DuckDB, then dbt and Dagster. Keep Tableau Public restricted to anonymized portfolio marts.
6. Add browser end-to-end coverage for signup → ingestion → approval → launch after the control plane is complete.

## Important files

- `docs/V3_PLAN.md`: phase gates and acceptance criteria
- `backend/src/services/campaigns.ts`: transactional campaign launch
- `backend/src/services/communication-dispatch.ts`: recipient dispatch/retry completion
- `backend/src/services/campaign-approval-workflow.ts`: durable approval interrupt/resume
- `backend/src/services/campaign-case.ts` and `packages/agent-core/src/graph/campaign-case.ts`: scout/strategist/reviewer/revise graph, current agent foundation
- `backend/src/lib/prisma.ts` and `tenant-context.ts`: tenant/RLS data boundary
- `backend/src/__tests__/integration/`: real PostgreSQL acceptance tests
- `.github/workflows/ci.yml` and `SECURITY.md`: CI and security policy

## Commit discipline

Keep commits small, validate before each commit, and push `phase-2-complete` after every coherent checkpoint. Do not commit generated artifacts, environment files, credentials, or changes unrelated to the active gate.
