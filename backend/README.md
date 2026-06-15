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
  <img src="https://img.shields.io/badge/OpenRouter-Gemini_2.5_Flash-F59E0B?style=flat-square" alt="OpenRouter">
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
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_APP_NAME=xeno-grow
OPENROUTER_MODEL=google/gemini-2.5-flash
CHANNEL_SERVICE_URL=http://localhost:5001
WEBHOOK_SECRET=your_shared_secret
```

Runs at **http://localhost:3001**

### Generate demo data
```bash
TOTAL_CUSTOMERS=500 TOTAL_ORDERS=3000 npm run generate:data
# Outputs: generated-data/customers.csv + orders.csv
```
