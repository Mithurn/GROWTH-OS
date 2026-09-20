CREATE TABLE campaign_cases (
  id TEXT NOT NULL DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  agent_id TEXT,
  opportunity_id TEXT NOT NULL,
  campaign_id TEXT,
  run_id TEXT,
  status TEXT NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'READY_FOR_APPROVAL', 'BLOCKED', 'FAILED')),
  evidence JSONB,
  reviewer_report JSONB,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT campaign_cases_pkey PRIMARY KEY (id),
  CONSTRAINT campaign_cases_opportunity_id_key UNIQUE (opportunity_id),
  CONSTRAINT campaign_cases_campaign_id_key UNIQUE (campaign_id),
  CONSTRAINT campaign_cases_run_id_key UNIQUE (run_id),
  CONSTRAINT campaign_cases_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT campaign_cases_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL,
  CONSTRAINT campaign_cases_opportunity_id_fkey FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE,
  CONSTRAINT campaign_cases_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
  CONSTRAINT campaign_cases_run_id_fkey FOREIGN KEY (run_id) REFERENCES agent_runs(id) ON DELETE SET NULL
);

CREATE INDEX campaign_cases_company_id_status_idx ON campaign_cases(company_id, status);

ALTER TABLE campaign_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON campaign_cases
  USING (company_id = app_company_id())
  WITH CHECK (company_id = app_company_id());
