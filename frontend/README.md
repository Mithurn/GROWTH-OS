<h1 align="center">
  <br>
  <img width="120" height="120" alt="Xeno Growth OS" src="https://xeno-grow.vercel.app/logo.png" />
  <br>
  Xeno Growth OS — Frontend
  <br>
</h1>

<h4 align="center">The marketer-facing interface for an autonomous AI Growth Copilot. Built on Next.js 16 App Router.</h4>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss" alt="Tailwind">
  <img src="https://img.shields.io/badge/Deployed-Vercel-000000?style=flat-square&logo=vercel" alt="Vercel">
  <img src="https://img.shields.io/badge/Charts-Recharts-22C55E?style=flat-square" alt="Recharts">
</p>

<p align="center">
  <a href="#pages">Pages</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#key-design-decisions">Design Decisions</a> •
  <a href="#setup">Setup</a>
</p>

**Live:** https://xeno-grow.vercel.app

---

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Public landing page — what the product does, the architecture, and a link to sign in |
| `/login` | Email/password and Google sign-in via Supabase Auth |
| `/dashboard` | Overview — featured opportunity, AI activity stream, natural language command bar |
| `/onboarding` | 5-step wizard: industry → CSV upload → goal → mode → animated setup |
| `/opportunities` | AI-detected revenue opportunities with audience size, revenue potential, confidence scores |
| `/opportunities/[id]/campaign` | Campaign generation, channel selection, message preview, approve & launch |
| `/analytics` | Live campaign funnel — polls every 5s while a campaign is active |
| `/settings` | Company profile and AI guardrails |
| `/campaigns` | All campaigns with status tracking |
| `/personas` | AI-assigned persona distribution across the customer base |
| `/intelligence` | Customer intelligence view |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 App Router (Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Charts | Recharts (LineChart, PieChart) |
| Icons | Lucide React |
| Deployment | Vercel (automatic deploys from `main`) |
| API | All calls via `lib/api.ts` → Express backend |

---

## Key Design Decisions

**Auth in the proxy, tenancy on the server.** `proxy.ts` gates every route on a Supabase session and routes users by onboarding state. The company a request belongs to is never sent by the client — the backend resolves it from the JWT via `profiles.company_id`, so a tampered client cannot reach another tenant's data.

**Polling over WebSockets.** Analytics page polls `/api/campaigns/:id/analytics` every 5 seconds while status is `Launched`. Keeps the client stateless. At scale, Supabase Realtime replaces this.

**AI command bar on the dashboard.** Natural language input lets the marketer type a goal ("increase repeat purchases") and the backend generates a targeted opportunity from it — no segment builder required.

**Keep the backend warm, wake the channel service on demand.** Render's free tier gives 750 instance-hours a month across the whole workspace — enough to keep exactly one service up 24/7. An external cron holds the backend open, so the app is never cold for a visitor. The channel service is only needed at launch time, so the backend warms it itself before fanning out sends rather than paying to keep it running.

---

## Setup

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

**.env.local**
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

Runs at **http://localhost:3000**
