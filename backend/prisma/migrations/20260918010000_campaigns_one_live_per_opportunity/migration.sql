-- Two concurrent campaign-generation jobs for the same opportunity both passed
-- the application-level "does a live campaign already exist?" check before
-- either had written its row, so both created one. A retried or double-queued
-- job for the same opportunity produced a second real send. A partial unique
-- index makes the database itself the source of truth: only one campaign in a
-- "live" status can exist per opportunity, and Prisma's create then fails with
-- a P2002 the worker treats as "already handled" rather than racing on it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'campaigns_one_live_per_opportunity'
  ) THEN
    CREATE UNIQUE INDEX "campaigns_one_live_per_opportunity"
      ON "campaigns" ("opportunity_id")
      WHERE "status" IN ('Draft', 'Approved', 'Running', 'Launched');
  END IF;
END $$;
