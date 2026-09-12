Frontend
---------
Next.js 16 (App Router, Turbopack)
React 19
TypeScript
Tailwind CSS 4
shadcn/ui
Recharts

Backend
---------
Node.js 22
Express 5
TypeScript
Zod (LLM output validation)
BullMQ + ioredis (falls back to inline execution without REDIS_URL)

Database
---------
PostgreSQL
Supabase (Postgres + Auth)
Prisma 7

AI
---------
OpenRouter (OpenAI-compatible API)
Google Gemini Flash

Infrastructure
---------
Vercel (frontend)
Render (backend + channel service)
Supabase (database + auth)
cron-job.org (keep-alive ping so the free backend never sleeps)

Services
---------
Frontend (Next.js, Vercel)
Backend API (Express, Render)
Channel Service (Express delivery simulator, Render)
