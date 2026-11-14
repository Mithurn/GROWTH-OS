<h1 align="center">GrowthOS</h1>

<p align="center"><strong>A human-approved AI growth system that finds revenue gaps, drafts campaigns, delivers approved messages, and measures conversion.</strong></p>

**Live:** https://growos-ai.vercel.app (the demo needs no sign-up). Deployment and the on-demand AWS backend are covered in [DEPLOYMENT.md](DEPLOYMENT.md). Security notes are in [SECURITY.md](SECURITY.md).

## What it does

1. Ingests customer and order CSVs
2. Computes RFM segments and customer attributes
3. Assigns AI-generated personas
4. Surfaces revenue opportunities (e.g. dormant VIPs and the revenue recoverable)
5. Drafts campaign copy, audience and channel
6. Pauses for a marketer to review, approve and launch, then tracks delivery and conversion

No campaign sends without an approved state transition.

## Architecture

| Part | Path | Stack |
| --- | --- | --- |
| Frontend | `frontend/` | Next.js App Router, Tailwind, Supabase Auth (Vercel) |
| Backend API and workers | `backend/` | Express, Prisma, PostgreSQL with RLS, BullMQ, LangGraph |
| Channel service | `channel-service/` | Twilio, Resend or simulator, HMAC-signed status callbacks |
| Shared packages | `packages/` | `contracts`, `domain`, `ingest`, `agent-core`, `evals` |
| Deploy | `deploy/` | Docker, Caddy, AWS scripts |

Tenant isolation is enforced by PostgreSQL row-level security and covered by cross-tenant integration tests. Campaign launch creates one durable BullMQ job per recipient, and delivery status callbacks are verified, deduplicated and applied in order.

## Run locally

Prerequisites: Node 22+, PostgreSQL with pgvector, Redis, a Supabase project for Auth, an OpenRouter API key.

```bash
cp backend/.env.example backend/.env
cp channel-service/.env.example channel-service/.env
# frontend/.env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_URL=http://localhost:3001/api
./scripts/dev-local.sh
```

Frontend http://localhost:3000, API http://localhost:3001, channel service http://localhost:5001.

Demo data: `cd backend && npm run generate:data`, then upload the CSVs in `backend/generated-data/` through the onboarding page.

Full check (migrations, unit and integration tests, lint, builds): `./scripts/verify-local.sh`. Use `SKIP_INTEGRATION=1` without Docker.
