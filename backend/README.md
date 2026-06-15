# Xeno Growth OS — Backend API

Express.js REST API powering the Xeno Growth OS platform. Handles data ingestion, AI pipeline execution, campaign lifecycle, webhook processing, and analytics.

**Production URL:** https://xeno-crm-backend-n6d8.onrender.com  
**Deployed on:** Render (free tier)

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | 18+ |
| Framework | Express.js | 5.x |
| Language | TypeScript | 6.x |
| ORM | Prisma | 7.x |
| Database | Supabase (PostgreSQL) | — |
| AI | OpenRouter → Gemini 2.5 Flash | — |
| CSV parsing | csv-parser | 3.x |
| File uploads | multer | 2.x |
| Build | esbuild | 0.28.x |
| Dev runner | tsx | 4.x |

---

## Architecture

```
                        ┌─────────────────────────────────────────┐
                        │           Express.js API                 │
                        │           src/server.ts                  │
                        │                                          │
  CSV Upload ──────────▶│  /api/process-ingestion                  │
                        │  /api/opportunities                      │
  Frontend ────────────▶│  /api/campaigns/*                        │──▶ Supabase (PostgreSQL)
                        │  /api/analytics/*                        │
  Channel Service ─────▶│  /api/webhooks/channel-status            │
                        │                                          │
                        │         Services Layer                   │
                        │  ┌──────────────────────────────────┐    │
                        │  │ personas.ts     → AI persona gen │    │──▶ OpenRouter
                        │  │ opportunities.ts → AI opp engine │    │    (Gemini 2.5 Flash)
                        │  │ campaigns.ts    → AI copy gen    │    │
                        │  │ analytics.ts    → funnel engine  │    │
                        │  │ webhooks.ts     → event receiver │    │
                        │  │ agent-logger.ts → activity feed  │    │
                        │  └──────────────────────────────────┘    │
                        └─────────────────────────────────────────┘
```

---

## Data Model

```
companies
 ├── customers          (external_id, RFM scores, persona_id, city, signup_date)
 │    └── orders        (order_date, amount, channel)
 │         └── order_items → products
 │
 ├── personas           (AI-assigned segment labels, reasoning, distribution counts)
 │
 ├── opportunities      (AI-detected, audience_size, potential_revenue, confidence)
 │    └── campaigns     (AI-generated copy, channel, status: DRAFT→ACTIVE→COMPLETED)
 │         └── communications   (one row per recipient, status tracked)
 │              └── communication_events
 │                   (QUEUED → SENT → DELIVERED → READ → CLICKED | FAILED)
 │
 ├── agent_actions      (activity log — every AI decision recorded)
 └── onboarding_profiles (brand info, primary goal, operating mode)
```

---

## API Routes

### Ingestion
| Method | Route | Description |
|---|---|---|
| `POST` | `/api/process-ingestion` | Upload + validate customer & order CSVs, seed DB, compute metrics, run AI pipeline |
| `GET` | `/api/ingestion-status/:sessionId` | Poll ingestion progress |
| `POST` | `/api/upload-customers` | Preview-only CSV validate (no DB write) |
| `POST` | `/api/upload-orders` | Preview-only CSV validate (no DB write) |

### Opportunities
| Method | Route | Description |
|---|---|---|
| `GET` | `/api/opportunities` | List all AI-detected opportunities for a company |
| `POST` | `/api/opportunities/generate` | Trigger AI opportunity discovery |
| `GET` | `/api/opportunities/:id` | Single opportunity detail |

### Campaigns
| Method | Route | Description |
|---|---|---|
| `POST` | `/api/campaigns/generate` | AI generates campaign draft from opportunity |
| `GET` | `/api/campaigns` | List campaigns |
| `GET` | `/api/campaigns/:id` | Single campaign |
| `POST` | `/api/campaigns/:id/launch` | Launch campaign → enqueues to channel service |
| `PATCH` | `/api/campaigns/:id` | Update draft |

### Analytics
| Method | Route | Description |
|---|---|---|
| `GET` | `/api/campaigns/:id/analytics` | Live funnel, delivery breakdown, AI insights |
| `GET` | `/api/analytics/overview` | Company-wide metrics (revenue, orders, customers) |

### Webhooks
| Method | Route | Description |
|---|---|---|
| `POST` | `/api/webhooks/channel-status` | Receive delivery events from channel service (HMAC-verified) |

### Activity & Misc
| Method | Route | Description |
|---|---|---|
| `GET` | `/api/activity-stream` | Recent AI agent actions for home feed |
| `POST` | `/api/companies` | Create company record during onboarding |
| `POST` | `/api/onboarding/profile` | Save brand profile post-onboarding |
| `POST` | `/api/agents` | Create AI agent config |

---

## AI Pipeline

Every AI call follows a **structured prompt → JSON parse → DB store** pattern. No free-form text is ever rendered directly from AI output.

```
CSV Data
   │
   ▼
customer-metrics.ts   → RFM scores (recency, frequency, monetary)
customer-attributes.ts → behavioural attributes per customer
   │
   ▼
personas.ts ──────────▶ OpenRouter (Gemini 2.5 Flash)
   │                    Prompt: RFM distribution + purchase patterns
   │                    Output: persona labels + customer assignments
   ▼
opportunities.ts ─────▶ OpenRouter (Gemini 2.5 Flash)
   │                    Prompt: persona mix + revenue data
   │                    Output: opportunity objects { title, audience_size, revenue_potential }
   ▼
campaigns.ts ─────────▶ OpenRouter (Gemini 2.5 Flash)
                        Prompt: opportunity context + channel
                        Output: campaign name + personalised message copy
```

---

## Key Services

### `services/webhooks.ts`
Receives delivery status callbacks from the channel service. Each event is HMAC-verified, deduplicated by `event_id`, and only advances status if `sequenceNumber` ≥ current (out-of-order safety).

### `services/agent-logger.ts`
Writes every AI decision (persona run, opportunity detected, campaign launched) to `agent_actions` table — surfaced on the home dashboard as the live Xeno Activity feed.

### `services/analytics.ts`
Aggregates `communications` + `communication_events` into funnel metrics (sent → delivered → read → clicked) and calls AI for per-campaign learnings and next best action recommendations.

### `data-generator/generate-data.ts`
Synthetic data generator using `@faker-js/faker`. Produces realistic Indian retail customer and order data.

```bash
TOTAL_CUSTOMERS=500 TOTAL_ORDERS=3000 npm run generate:data
# → backend/generated-data/customers.csv
# → backend/generated-data/orders.csv
```

---

## Environment Variables

```env
DATABASE_URL=postgresql://...          # Supabase connection string
NEXT_PUBLIC_SUPABASE_URL=https://...   # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=eyJ...       # Supabase service role key
OPENROUTER_API_KEY=sk-or-...           # OpenRouter API key
CHANNEL_SERVICE_URL=https://...        # Channel service base URL
WEBHOOK_SECRET=...                     # Shared HMAC secret with channel service
PORT=3001
```

---

## Running Locally

```bash
cd backend
npm install
npm run dev          # tsx watch src/server.ts — hot reloads on save
```

Server starts at `http://localhost:3001`.

## Production Build (Render)

```bash
npx prisma generate --schema=prisma/schema.prisma
npx esbuild src/server.ts --bundle --platform=node --target=node18 \
  --outfile=dist/server.js --external:pg --external:pg-native
node dist/server.js
```

---

## Database Migrations

Managed via Prisma. Migration files live in `prisma/migrations/`.

```bash
npx prisma migrate dev     # apply + generate client (local)
npx prisma generate        # regenerate client only
```

---

## Project Structure

```
backend/
├── src/
│   ├── server.ts                   # All route definitions
│   ├── lib/
│   │   └── prisma.ts               # Prisma client singleton
│   ├── config/
│   │   └── openrouter.ts           # OpenAI-compatible client for OpenRouter
│   ├── services/
│   │   ├── personas.ts             # AI persona generation
│   │   ├── opportunities.ts        # AI opportunity detection
│   │   ├── opportunity-discovery.ts
│   │   ├── campaigns.ts            # Campaign CRUD + launch
│   │   ├── campaign-planner.ts     # AI copy generation
│   │   ├── analytics.ts            # Funnel + AI insights
│   │   ├── webhooks.ts             # Delivery event receiver
│   │   ├── customer-metrics.ts     # RFM computation
│   │   ├── customer-attributes.ts  # Behavioural attributes
│   │   ├── agent-logger.ts         # Activity feed writer
│   │   ├── agent-orchestrator.ts   # AI agent coordination
│   │   └── onboarding-chat.ts      # Onboarding AI chat
│   └── data-generator/
│       ├── generate-data.ts        # Synthetic data generator
│       └── products.ts             # Product catalogue
├── prisma/
│   ├── schema.prisma               # Data model
│   └── migrations/                 # Migration history
├── generated-data/
│   ├── customers.csv               # Demo dataset (500 customers)
│   └── orders.csv                  # Demo dataset (3000 orders)
├── package.json
├── tsconfig.json
└── render.yaml                     # Render deployment config
```
