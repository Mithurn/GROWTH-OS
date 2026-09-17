<h1 align="center">
  <br>
  <img width="120" height="120" alt="Xeno Growth OS" src="https://xeno-grow.vercel.app/logo.png" />
  <br>
  Xeno Growth OS — Backend API
  <br>
</h1>

<h4 align="center">The AI orchestration engine. Handles data ingestion, persona & opportunity generation, campaign lifecycle, webhook processing, and live analytics.</h4>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/Express.js-4-000000?style=flat-square&logo=express" alt="Express">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase" alt="Supabase">
  <img src="https://img.shields.io/badge/OpenRouter-Dynamic_Free_Router-F59E0B?style=flat-square" alt="OpenRouter">
  <img src="https://img.shields.io/badge/Deployed-Render-46E3B7?style=flat-square" alt="Render">
</p>

<p align="center">
  <a href="#ai-pipeline">AI Pipeline</a> •
  <a href="#api-endpoints">API Endpoints</a> •
  <a href="#webhook-loop">Webhook Loop</a> •
  <a href="#scale-tradeoffs">Scale Tradeoffs</a> •
  <a href="#setup">Setup</a>
</p>

**Production URL:** https://xeno-crm-backend-n6d8.onrender.com

---

## AI Pipeline

Every AI step routes through **`openrouter/free`** — OpenRouter's dynamic load-balancer that selects the fastest available free model at the moment of the request. Zero AI cost, no rate-limit cliff, automatic failover.

<p align="center">
  <img src="https://img.shields.io/badge/NVIDIA-Nemotron_Nano_120B-76B900?style=flat-square&logo=nvidia&logoColor=white" alt="NVIDIA">
  <img src="https://img.shields.io/badge/Meta-Llama_3.1_8B-0467DF?style=flat-square&logo=meta&logoColor=white" alt="Meta">
  <img src="https://img.shields.io/badge/Google-Gemma_4_31B-4285F4?style=flat-square&logo=google&logoColor=white" alt="Google">
  <img src="https://img.shields.io/badge/Liquid_AI-LFM_2.5_1.2B-8B5CF6?style=flat-square&logoColor=white" alt="Liquid AI">
  <img src="https://img.shields.io/badge/Poolside-Laguna_XS_2-EC4899?style=flat-square&logoColor=white" alt="Poolside">
  <img src="https://img.shields.io/badge/Alibaba-Qwen3_Coder-FF6A00?style=flat-square&logoColor=white" alt="Qwen3">
</p>

Every AI step uses a strict **structured prompt → JSON parse → validate → store** pattern. The LLM never outputs free-form text that touches the database or UI directly.

| Step | Service | Input | Output Stored |
|------|---------|-------|---------------|
| **Persona Engine** | `services/personas.ts` | RFM scores + purchase history per customer | `personas` table — label + reasoning per customer |
| **Opportunity Engine** | `services/opportunities.ts` | Persona distribution + revenue signals | `opportunities` table — typed objects with audience size + predicted revenue |
| **Campaign Generator** | `services/campaigns.ts` | Opportunity context + channel | `campaigns` table — name, copy, offer, predicted conversion |
| **Analytics Insights** | `services/analytics.ts` | Live funnel data | Returned inline — learnings + next best action |

Each prompt enforces a strict JSON schema contract. Malformed responses are caught, logged, and never written to the database — the application state never breaks due to LLM unpredictability.

---

## API Endpoints

### Data Ingestion
```
POST /api/upload/customers          # CSV multipart upload
POST /api/upload/orders             # CSV multipart upload
POST /api/process-ingestion         # Trigger enrichment pipeline
```

### Opportunities
```
GET  /api/opportunities             # List all opportunities
GET  /api/opportunities/:id         # Single opportunity detail
GET  /api/opportunities/:id/customers  # Audience for opportunity
POST /api/opportunities/from-goal   # Create from natural language goal
POST /api/opportunities/:id/refine  # AI refinement via natural language
```

### Campaigns
```
POST /api/campaigns/generate        # AI-generate campaign for opportunity
GET  /api/campaigns                 # List all campaigns
GET  /api/campaigns/:id             # Single campaign
POST /api/campaigns/:id/approve     # Approve (blocks re-approval after launch)
POST /api/campaigns/:id/launch      # Launch — creates communications + fires channel service
GET  /api/campaigns/:id/analytics   # Live funnel + AI insights
POST /api/campaigns/:id/refine-message  # Refine message copy via AI
```

### Webhooks
```
POST /api/webhooks/channel-status   # HMAC-verified webhook receiver from channel service
```

### Analytics & Intelligence
```
GET  /api/analytics/intelligence-brief
GET  /api/analytics/campaign-funnel
GET  /api/analytics/channel-performance
GET  /api/analytics/opportunity-pipeline
GET  /api/agent/recent-actions
```

```
GET  /health                        # Health check (used for cold-start warming)
```

---

## Webhook Loop

When a campaign launches, the async delivery lifecycle works as follows:

```
Backend → POST /send (parallel, per recipient) → Channel Service
                                                        ↓ async
Backend ← POST /api/webhooks/channel-status ←  Channel Service
    ↓
communication_events table
    ↓
Analytics page (polls every 5s)
```

**Three production-grade properties of the webhook receiver (`services/webhooks.ts`):**

- **Idempotency** — every event carries a unique `event_id`; deduplicated via `processed_webhook_events` table before any write
- **Out-of-order safety** — events carry a `sequenceNumber`; status only advances forward (QUEUED=1 → SENT=2 → DELIVERED=3 → READ=4 → CLICKED=5), never backwards
- **HMAC signature verification** — channel service signs every payload with a shared secret (`WEBHOOK_SECRET`); backend rejects unsigned or tampered requests with 401

---

## Scale Tradeoffs

| Concern | This Implementation | Production Alternative |
|---------|-------------------|----------------------|
| Webhook ingestion | Inline Supabase upsert per event | SQS / Kafka → worker pool with batched writes |
| AI calls | Sequential, per-request | BullMQ job queue with retries + dead-letter |
| Campaign launch | `Promise.allSettled` — all sends in parallel | Chunked batching with rate limiting + backpressure |
| Analytics | 5s polling | Supabase Realtime or WebSockets |
| Auth | Company ID in localStorage | JWT + Row Level Security on all tables |
| Webhook retries | 3 retries at 15s / 30s / 60s | Exponential backoff with jitter + dead-letter queue |

---

## Services

```
backend/src/
├── server.ts                 # All API routes (single file, ~1400 lines)
└── services/
    ├── personas.ts           # AI persona assignment per customer
    ├── opportunities.ts      # AI opportunity detection + refinement
    ├── campaigns.ts          # Campaign CRUD, launch, AI generation
    ├── analytics.ts          # Funnel, channel performance, AI insights
    ├── webhooks.ts           # HMAC verification + idempotent event processing
    ├── agent-orchestrator.ts # Runs every 5 min — detects new opportunities autonomously
    ├── agent-logger.ts       # Logs agent actions for the activity stream
    ├── customer-metrics.ts   # Deterministic RFM scoring
    ├── customer-attributes.ts # Behavioural enrichment
    ├── onboarding-chat.ts    # Conversational onboarding via AI
    └── data-generator/       # Synthetic CSV generator (500 customers, 3000 orders)
```

---

## Setup

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

**.env**
```
PORT=3001
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=            # Get free at openrouter.ai
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_APP_NAME=xeno-grow
OPENROUTER_MODEL=openrouter/free  # Dynamic router — auto-selects fastest free model at runtime
CHANNEL_SERVICE_URL=http://localhost:5001
WEBHOOK_SECRET=your_shared_secret
```

### Local database

Local runs one Supabase stack, so Auth and the app tables live in the same Postgres, the
same as production. Only the env files differ.

```bash
supabase start                                   # from the repo root, needs Docker
supabase status -o env                           # API_URL, ANON_KEY, SERVICE_ROLE_KEY, DB_URL
cd backend && DIRECT_URL=<DB_URL> npx prisma migrate deploy
```

Set `DATABASE_URL` and `DIRECT_URL` to `DB_URL`, `NEXT_PUBLIC_SUPABASE_URL` to `API_URL`,
and `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env`; the URL and `ANON_KEY` go in
`frontend/.env.local`. Sign up with email and password (Google sign-in is not configured
locally), finish onboarding, then optionally reseed with
`COMPANY_ID=<id> npx tsx scripts/seed-local-demo.ts`.

## Testing

```bash
npm test               # unit tests — mocked Prisma/Redis/queues, no external services
npm run test:integration   # real Postgres via Testcontainers — needs Docker running
```

`test:integration` starts a real `pgvector/pgvector:pg16` container (Postgres 16 plus the `vector` extension Supabase ships), runs the actual
`prisma migrate deploy` against it, and tests things the mocked suite can't — tenant
isolation with two live tenants, real constraint enforcement, real concurrent writes.
Needs a working Docker daemon. If you're on Colima rather than Docker Desktop, Ryuk
(Testcontainers' cleanup sidecar) can't bind-mount Colima's socket into itself, so run
with it disabled:

```bash
DOCKER_HOST="unix://$HOME/.colima/default/docker.sock" \
TESTCONTAINERS_RYUK_DISABLED=true \
npm run test:integration
```

Containers still get cleaned up (each test's `afterAll` stops its own), Ryuk is just a
belt-and-braces reaper for crashed test runs.

Runs at **http://localhost:3001**

### Generate demo data
```bash
TOTAL_CUSTOMERS=500 TOTAL_ORDERS=3000 npm run generate:data
# Outputs: generated-data/customers.csv + orders.csv
```
