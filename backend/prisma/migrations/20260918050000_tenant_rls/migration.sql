-- App queries SET LOCAL ROLE to this (NOLOGIN, no bypass). prismaSystem stays
-- connected as the migration role (superuser / BYPASSRLS) for cross-tenant sweeps.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'growthos_app') THEN
    CREATE ROLE growthos_app NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
END $$;

DO $$
DECLARE migration_role name := current_user;
BEGIN
  EXECUTE format('GRANT growthos_app TO %I', migration_role);
END $$;
GRANT USAGE ON SCHEMA public TO growthos_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO growthos_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO growthos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO growthos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO growthos_app;

CREATE OR REPLACE FUNCTION app_company_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.company_id', true), '')
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'customers', 'products', 'ingestion_sessions',
    'orders', 'order_items', 'customer_metrics', 'customer_attributes',
    'personas', 'opportunities', 'campaigns', 'agents', 'agent_runs',
    'integrations', 'cost_ledger', 'company_config'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (company_id = app_company_id()) WITH CHECK (company_id = app_company_id())',
      t
    );
  END LOOP;
END $$;

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON companies;
CREATE POLICY tenant_isolation ON companies
  USING (id = app_company_id())
  WITH CHECK (id = app_company_id());

ALTER TABLE opportunity_customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON opportunity_customers;
CREATE POLICY tenant_isolation ON opportunity_customers
  USING (EXISTS (
    SELECT 1 FROM opportunities o
    WHERE o.id = opportunity_customers.opportunity_id AND o.company_id = app_company_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM opportunities o
    WHERE o.id = opportunity_customers.opportunity_id AND o.company_id = app_company_id()
  ));

ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON communications;
CREATE POLICY tenant_isolation ON communications
  USING (EXISTS (
    SELECT 1 FROM campaigns c
    WHERE c.id = communications.campaign_id AND c.company_id = app_company_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM campaigns c
    WHERE c.id = communications.campaign_id AND c.company_id = app_company_id()
  ));

ALTER TABLE communication_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON communication_events;
CREATE POLICY tenant_isolation ON communication_events
  USING (EXISTS (
    SELECT 1 FROM communications m
    JOIN campaigns c ON c.id = m.campaign_id
    WHERE m.id = communication_events.communication_id AND c.company_id = app_company_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM communications m
    JOIN campaigns c ON c.id = m.campaign_id
    WHERE m.id = communication_events.communication_id AND c.company_id = app_company_id()
  ));

ALTER TABLE agent_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON agent_steps;
CREATE POLICY tenant_isolation ON agent_steps
  USING (EXISTS (
    SELECT 1 FROM agent_runs r
    WHERE r.id = agent_steps.run_id AND r.company_id = app_company_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM agent_runs r
    WHERE r.id = agent_steps.run_id AND r.company_id = app_company_id()
  ));

ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON agent_actions;
CREATE POLICY tenant_isolation ON agent_actions
  USING (EXISTS (
    SELECT 1 FROM agents a
    WHERE a.id = agent_actions.agent_id AND a.company_id = app_company_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM agents a
    WHERE a.id = agent_actions.agent_id AND a.company_id = app_company_id()
  ));
