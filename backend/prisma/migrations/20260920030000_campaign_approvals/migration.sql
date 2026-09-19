CREATE TABLE campaign_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  campaign_id text NOT NULL UNIQUE REFERENCES campaigns(id) ON DELETE CASCADE,
  actor_id text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  reason text,
  policy_version integer NOT NULL DEFAULT 1,
  policy_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX campaign_approvals_company_id_idx ON campaign_approvals(company_id);
CREATE INDEX campaign_approvals_actor_id_idx ON campaign_approvals(actor_id);
CREATE INDEX campaign_approvals_created_at_idx ON campaign_approvals(created_at);

ALTER TABLE campaign_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON campaign_approvals
  USING (company_id = app_company_id())
  WITH CHECK (company_id = app_company_id());

REVOKE UPDATE, DELETE ON campaign_approvals FROM growthos_app;
