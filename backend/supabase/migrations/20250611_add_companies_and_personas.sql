-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT UNIQUE NOT NULL,
  industry TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_company_name
  ON companies(company_name);

-- Personas table
CREATE TABLE IF NOT EXISTS personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  persona_name TEXT NOT NULL,
  persona_description TEXT NOT NULL,
  confidence_score DECIMAL(5, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT personas_company_customer_unique UNIQUE (company_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_personas_company_id
  ON personas(company_id);

CREATE INDEX IF NOT EXISTS idx_personas_customer_id
  ON personas(customer_id);

CREATE INDEX IF NOT EXISTS idx_personas_persona_name
  ON personas(persona_name);
