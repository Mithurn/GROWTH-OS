CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  opportunity_key TEXT NOT NULL,
  opportunity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  audience_size INTEGER NOT NULL DEFAULT 0,
  potential_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
  confidence_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  priority_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  supporting_customer_segment TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  audience_definition JSONB NOT NULL DEFAULT '{}'::jsonb,
  trigger_reason TEXT NOT NULL DEFAULT '',
  ai_summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Detected' CHECK (
    status IN (
      'Detected',
      'Accepted',
      'Rejected',
      'Campaign Created',
      'Completed',
      'Archived'
    )
  ),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT opportunities_company_key_unique UNIQUE (company_id, opportunity_key)
);

CREATE INDEX IF NOT EXISTS idx_opportunities_company_id
  ON opportunities(company_id);

CREATE INDEX IF NOT EXISTS idx_opportunities_opportunity_type
  ON opportunities(opportunity_type);

CREATE INDEX IF NOT EXISTS idx_opportunities_status
  ON opportunities(status);

CREATE INDEX IF NOT EXISTS idx_opportunities_priority_score
  ON opportunities(priority_score DESC);

CREATE TABLE IF NOT EXISTS opportunity_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT opportunity_customers_unique UNIQUE (opportunity_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_opportunity_customers_opportunity_id
  ON opportunity_customers(opportunity_id);

CREATE INDEX IF NOT EXISTS idx_opportunity_customers_customer_id
  ON opportunity_customers(customer_id);
