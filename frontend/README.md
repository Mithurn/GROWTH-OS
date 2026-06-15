# Xeno Growth OS — Frontend

Next.js 16 app for the Xeno Growth OS platform. Provides the onboarding wizard, AI opportunity discovery, campaign management, live analytics, and the home activity dashboard.

**Production URL:** https://xeno-grow.vercel.app  
**Deployed on:** Vercel

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.x |
| Language | TypeScript | 5.x |
| UI | React | 19.x |
| Styling | Tailwind CSS | 4.x |
| Components | shadcn/ui + Base UI | — |
| Icons | Lucide React | 1.x |
| Charts | Recharts | 2.x |
| HTTP | Native fetch (lib/api.ts) | — |

---

## Architecture

```
Browser
   │
   ▼
Next.js App Router (Vercel)
   │
   ├── app/page.tsx                  Home dashboard
   │    ├── Opportunity cards         GET /api/opportunities
   │    ├── Xeno Activity feed        GET /api/activity-stream  (polls every 30s)
   │    └── AI goal input             POST /api/opportunities/generate
   │
   ├── app/onboarding/page.tsx       4-step wizard
   │    ├── Step 1: Brand info        POST /api/companies
   │    ├── Step 2: Data upload       Connect pre-loaded demo data
   │    ├── Step 3: Primary goal      (local state)
   │    └── Step 4: AI mode           POST /api/onboarding/profile
   │                                  POST /api/agents
   │
   ├── app/opportunities/            Opportunity discovery
   │    ├── page.tsx                  GET /api/opportunities
   │    └── [id]/page.tsx             GET /api/opportunities/:id
   │         └── [id]/campaign/       POST /api/campaigns/generate
   │                                  POST /api/campaigns/:id/launch
   │
   ├── app/campaigns/page.tsx        Campaign management
   │    └──                           GET /api/campaigns
   │
   ├── app/analytics/page.tsx        Live campaign analytics
   │    └──                           GET /api/analytics/overview
   │                                  GET /api/campaigns/:id/analytics (polls 5s when LIVE)
   │
   └── app/personas/page.tsx         Customer persona breakdown
```

---

## Pages

### Home (`/`)
The central command dashboard. Shows:
- AI-detected top opportunity with one-click launch
- Grid of other opportunities
- Live Xeno Activity feed (AI agent decisions, real-time)
- Natural language goal input → triggers new opportunity generation

### Onboarding (`/onboarding`)
4-step wizard for new users:
1. **Brand info** — company name + industry
2. **Data** — CSV upload boxes (visible/disabled for demo) + "Connect Pre-loaded Demo Data" button
3. **Primary goal** — select growth objective (repeat purchases, churn reduction, etc.)
4. **AI mode** — Operator (you approve) vs Autonomous (full autopilot)

Onboarding bypasses the upload flow for reviewers by pre-loading a demo company with 500 customers and 3000 orders already in the DB.

### Opportunities (`/opportunities`)
Lists all AI-detected revenue opportunities. Each card shows:
- Opportunity title + type
- Audience size
- Predicted revenue uplift
- Confidence score + priority badge

### Opportunity Detail (`/opportunities/[id]`)
Deep-dive on a single opportunity with tabs for customer audience breakdown, AI intelligence + persona insights, and campaign generation and launch.

### Campaigns (`/campaigns`)
All campaigns across all opportunities. Filter by status (DRAFT / ACTIVE / COMPLETED).

### Analytics (`/analytics`)
Live campaign performance dashboard:
- Funnel chart (sent → delivered → read → clicked)
- Revenue velocity chart (rolling)
- Channel breakdown donut
- AI-generated learnings + next best action (typewriter reveal)
- Polls every 5s while a campaign is LIVE

### Personas (`/personas`)
Visual breakdown of AI-assigned customer segments — persona labels, sizes, and behavioural descriptions.

---

## Key Components

| Component | Path | Purpose |
|---|---|---|
| `main-layout.tsx` | `components/` | Shell with sidebar nav |
| `nav-header.tsx` | `components/` | Top bar with greeting + context |
| `sidebar.tsx` | `components/` | Left nav (Home, Opportunities, Campaigns, Analytics) |
| `ui/card.tsx` | `components/ui/` | shadcn card primitive |
| `ui/phone-mockup.tsx` | `components/ui/` | WhatsApp message preview |

---

## API Client

All backend calls go through `lib/api.ts`. It reads `NEXT_PUBLIC_API_URL` for the base URL and attaches `xeno_company_id` from `localStorage` on every request.

```typescript
// lib/api.ts — example shape
getOpportunityDashboard(companyId?)     → GET /api/opportunities
getActivityStream(companyId, limit)     → GET /api/activity-stream
createOpportunityFromGoal(...)          → POST /api/opportunities/generate
uploadCustomerCSV(file)                 → POST /api/upload-customers
startIngestion(customerFile, orderFile) → POST /api/process-ingestion
getIngestionStatus(sessionId)           → GET /api/ingestion-status/:id
```

---

## Environment Variables

```env
NEXT_PUBLIC_API_URL=https://xeno-crm-backend-n6d8.onrender.com
```

For local development pointing to local backend:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Running Locally

```bash
cd frontend
npm install
npm run dev        # Next.js dev server with hot reload
```

App runs at `http://localhost:3000`. Requires the backend running at `NEXT_PUBLIC_API_URL`.

## Production Build

```bash
npm run build      # Next.js production build
npm run start      # Serve production build
```

---

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx                  # Root layout (font, metadata)
│   ├── globals.css                 # Tailwind base styles
│   ├── page.tsx                    # Home dashboard
│   ├── onboarding/
│   │   ├── page.tsx                # 4-step onboarding wizard
│   │   └── loading/page.tsx        # Onboarding loading state
│   ├── opportunities/
│   │   ├── page.tsx                # Opportunity list
│   │   ├── layout.tsx
│   │   └── [id]/
│   │       ├── page.tsx            # Opportunity detail
│   │       ├── layout.tsx
│   │       ├── campaign/page.tsx   # Campaign builder + launch
│   │       └── intelligence/page.tsx
│   ├── campaigns/page.tsx          # Campaign list
│   ├── analytics/page.tsx          # Live analytics dashboard
│   ├── personas/page.tsx           # Persona breakdown
│   ├── intelligence/page.tsx       # AI intelligence centre
│   └── settings/page.tsx           # Settings
│
├── components/
│   ├── main-layout.tsx             # App shell with sidebar
│   ├── nav-header.tsx              # Top navigation bar
│   ├── sidebar.tsx                 # Left sidebar nav
│   └── ui/                         # shadcn/ui primitives
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── phone-mockup.tsx        # WhatsApp preview component
│       ├── progress.tsx
│       └── select.tsx
│
├── lib/
│   ├── api.ts                      # All backend API calls
│   └── utils.ts                    # cn() and shared helpers
│
├── public/
│   └── logo.png                    # Xeno logo
│
├── next.config.ts
├── tsconfig.json
└── package.json
```
