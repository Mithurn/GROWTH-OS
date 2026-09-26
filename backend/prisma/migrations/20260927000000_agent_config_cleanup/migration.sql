-- agent.max_steps_per_role / agent.max_steps_single backed the old
-- single-thread supervisor loop, deleted after confirming it had no real
-- callers. Their seed rows are now orphaned config with no reader.
DELETE FROM "config_defaults" WHERE "key" IN ('agent.max_steps_per_role', 'agent.max_steps_single');

-- Wall-clock budget for the campaign-case graph's revise loop, alongside the
-- existing revision-count budget.
INSERT INTO "config_defaults" ("key", "value", "description") VALUES
  ('agent.max_wall_clock_ms', '120000', 'Campaign case graph: max wall-clock time for the full scout/strategist/reviewer/revise run')
ON CONFLICT ("key") DO NOTHING;
