CREATE TABLE campaign_risk_reviews (
  id TEXT NOT NULL DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('ALLOW', 'BLOCK')),
  reasons JSONB NOT NULL,
  reviewed_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT campaign_risk_reviews_pkey PRIMARY KEY (id),
  CONSTRAINT campaign_risk_reviews_campaign_id_key UNIQUE (campaign_id),
  CONSTRAINT campaign_risk_reviews_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  CONSTRAINT campaign_risk_reviews_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

CREATE INDEX campaign_risk_reviews_company_id_idx ON campaign_risk_reviews(company_id);

ALTER TABLE campaign_risk_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON campaign_risk_reviews
  USING (company_id = app_company_id())
  WITH CHECK (company_id = app_company_id());
