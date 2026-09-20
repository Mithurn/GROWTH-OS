INSERT INTO config_defaults ("key", value, description) VALUES
  ('agent.max_revisions', '1', 'Maximum evidence-driven campaign revisions per case'),
  ('agent.campaign_cases_enabled', 'true', 'Enable the tenant campaign-case workflow'),
  ('agent.kill_switch', 'false', 'Stop scheduled agent work for a tenant')
ON CONFLICT ("key") DO NOTHING;
