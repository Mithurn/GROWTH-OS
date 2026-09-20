# Technology stack

## Product

- Next.js 16, React 19, TypeScript, Tailwind CSS, Base UI, and Recharts
- Express 5 API and channel-provider service on Node.js 22
- PostgreSQL with pgvector, Prisma, tenant context, and row-level security
- Supabase Auth using the public anon client
- Redis and BullMQ for ingestion, agent work, generation, and per-recipient delivery jobs
- LangGraph with PostgreSQL checkpoints for durable human approval
- OpenRouter through the OpenAI-compatible SDK; model selection is configuration
- Zod contracts at API and persisted generation boundaries

## Operations

- OpenTelemetry traces, Pino structured logs, Sentry error reporting, and Langfuse OTLP support
- Vitest unit tests and Testcontainers integration tests against real PostgreSQL
- GitHub Actions for lint, typecheck, test, build, dependency audit, Gitleaks, and artifact checks
- Vercel for the frontend; Render blueprints for the API and channel service

The backend contains a separate worker entrypoint. The current free-tier Render blueprint keeps workers in the API process because an additional always-on worker exceeds the shared allowance. Enable the dedicated worker service before production traffic.
