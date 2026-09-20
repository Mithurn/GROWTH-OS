# GrowthOS backend

Express 5 API and BullMQ worker for the GrowthOS human-approved growth-agent platform.

## Runtime architecture

- Supabase Auth validates user sessions with the public anon client; no privileged database client is used.
- Prisma owns application data access. Each request transaction sets the tenant context and PostgreSQL RLS enforces isolation.
- PostgreSQL stores customers, orders, agent runs, LangGraph checkpoints, campaigns, approvals, delivery outbox rows, and analytics events.
- Redis/BullMQ runs retryable opportunity, campaign-generation, and per-recipient delivery jobs.
- The API and worker have separate production entry points: `src/server.ts` and `src/worker.ts`.
- Campaigns pause in a durable LangGraph workflow until a human approves or rejects them.

## Main endpoints

```text
POST /api/upload/customers
POST /api/upload/orders
POST /api/process-ingestion

GET  /api/opportunities
POST /api/opportunities/from-goal
POST /api/opportunities/:id/refine

POST /api/campaigns/generate
POST /api/campaigns
POST /api/campaigns/:id/approve
POST /api/campaigns/:id/reject
POST /api/campaigns/:id/launch
GET  /api/campaigns/:id/analytics
GET  /api/campaigns/:id/events

GET  /api/analytics/campaign-funnel
GET  /api/analytics/channel-performance
GET  /api/analytics/opportunity-distribution
GET  /api/analytics/intelligence-brief

POST /api/webhooks/channel-status
POST /api/internal/agents/run-scheduled
```

User routes require a Supabase access token and resolve `companyId` from the authenticated profile. Internal scheduler routes require `INTERNAL_API_SECRET`. Channel callbacks require a valid HMAC signature.

## Campaign delivery

Launching an approved campaign atomically changes its state to `Dispatching`, creates one communication per recipient, records `QUEUED` events, and enqueues jobs using the communication ID as the job ID. The worker applies a Redis frequency-cap reservation, calls the provider, and retries transient failures with backoff. A startup and periodic sweep resumes queued communications after process interruption.

Provider delivery callbacks are signature-verified, deduplicated, and prevented from moving a communication backward in its state machine.

## Local setup

Requirements: Node.js 22+, PostgreSQL 16 with pgvector, Redis, and a Supabase Auth project.

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Copy `.env.example` to `.env`. Required values include `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_ANON_KEY`, `REDIS_URL`, `WEBHOOK_SECRET`, and `INTERNAL_API_SECRET`.

Run the worker separately:

```bash
npm run dev:worker
```

## Verification

```bash
npm test
npm run test:integration
npm run build
npm run build:worker
```

The unit suite isolates external boundaries. The integration suite starts real PostgreSQL with Testcontainers, applies every migration, and verifies RLS, constraints, concurrency, approval persistence, analytics isolation, and durable campaign dispatch.

With Colima:

```bash
DOCKER_HOST=unix:///Users/your-user/.colima/default/docker.sock \
TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock \
npm run test:integration
```
