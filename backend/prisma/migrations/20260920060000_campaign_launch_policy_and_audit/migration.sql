ALTER TABLE customers
  ADD COLUMN email_marketing_consent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN email_unsubscribed_at TIMESTAMP(3),
  ADD COLUMN sms_marketing_consent BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE companies
  ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC';

CREATE TABLE campaign_audit_events (
  id TEXT NOT NULL DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT campaign_audit_events_pkey PRIMARY KEY (id),
  CONSTRAINT campaign_audit_events_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT campaign_audit_events_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

CREATE INDEX campaign_audit_events_company_id_campaign_id_created_at_idx
  ON campaign_audit_events(company_id, campaign_id, created_at);

ALTER TABLE campaign_audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON campaign_audit_events
  USING (company_id = app_company_id())
  WITH CHECK (company_id = app_company_id());
REVOKE UPDATE, DELETE ON campaign_audit_events FROM growthos_app;

INSERT INTO config_defaults (key, value, description)
VALUES ('campaign.quiet_hours', '{"startHour":21,"endHour":9}', 'Local-time quiet hours for promotional campaigns')
ON CONFLICT (key) DO NOTHING;
