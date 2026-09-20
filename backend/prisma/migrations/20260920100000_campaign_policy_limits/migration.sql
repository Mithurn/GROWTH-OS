INSERT INTO config_defaults (key, value, description)
VALUES
  ('campaign.frequency_cap_per_day', '2', 'Maximum campaign messages per customer per UTC day'),
  ('campaign.approval_ttl_hours', '24', 'Hours an approval remains valid before re-review'),
  ('campaign.monthly_recipient_quota', '10000', 'Maximum recipient reservations per company per UTC month')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE campaign_quota_reservations (
  id TEXT NOT NULL DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  period_start TIMESTAMP(3) NOT NULL,
  recipients INTEGER NOT NULL CHECK (recipients > 0),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT campaign_quota_reservations_pkey PRIMARY KEY (id),
  CONSTRAINT campaign_quota_reservations_campaign_id_key UNIQUE (campaign_id),
  CONSTRAINT campaign_quota_reservations_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT campaign_quota_reservations_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

CREATE INDEX campaign_quota_reservations_company_id_period_start_idx
  ON campaign_quota_reservations(company_id, period_start);

ALTER TABLE campaign_quota_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON campaign_quota_reservations
  USING (company_id = app_company_id())
  WITH CHECK (company_id = app_company_id());
