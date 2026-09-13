-- ============================================================
-- Phase 2: queryable agent run trace.
--
-- These tables are product state — what the Run Trace UI and an auditor
-- read. They are NOT LangGraph's checkpoint tables. Checkpoint = how to
-- resume after a Render spin-down; this = what happened. See
-- packages/agent-core/DESIGN.md §3 and ARCHITECTURE_V2.md §3.1.
--
-- Written, not applied. Do not run prisma migrate deploy against a real
-- database without explicit per-command confirmation.
-- ============================================================

CREATE TABLE IF NOT EXISTS "agent_runs" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "agent_id" TEXT,
  "thread_id" TEXT NOT NULL,
  "goal" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "summary" TEXT NOT NULL DEFAULT '',
  "step_count" INTEGER NOT NULL DEFAULT 0,
  "mode" TEXT NOT NULL DEFAULT 'shadow',
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),

  CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "agent_runs_thread_id_key" ON "agent_runs"("thread_id");
CREATE INDEX IF NOT EXISTS "agent_runs_company_id_idx" ON "agent_runs"("company_id");
CREATE INDEX IF NOT EXISTS "agent_runs_agent_id_idx" ON "agent_runs"("agent_id");
CREATE INDEX IF NOT EXISTS "agent_runs_started_at_idx" ON "agent_runs"("started_at");

CREATE TABLE IF NOT EXISTS "agent_steps" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "node" TEXT NOT NULL,
  "tool_name" TEXT,
  "args" JSONB,
  "result" JSONB,
  "error" TEXT,
  "latency_ms" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "agent_steps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "agent_steps_run_id_idx" ON "agent_steps"("run_id");
CREATE INDEX IF NOT EXISTS "agent_steps_company_id_idx" ON "agent_steps"("company_id");
CREATE INDEX IF NOT EXISTS "agent_steps_created_at_idx" ON "agent_steps"("created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_runs_company_id_fkey'
  ) THEN
    ALTER TABLE "agent_runs"
      ADD CONSTRAINT "agent_runs_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_runs_agent_id_fkey'
  ) THEN
    ALTER TABLE "agent_runs"
      ADD CONSTRAINT "agent_runs_agent_id_fkey"
      FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'agent_steps_run_id_fkey'
  ) THEN
    ALTER TABLE "agent_steps"
      ADD CONSTRAINT "agent_steps_run_id_fkey"
      FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
