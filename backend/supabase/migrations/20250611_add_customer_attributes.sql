-- Customer attributes table for deterministic customer intelligence

CREATE TABLE IF NOT EXISTS customer_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID UNIQUE NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  favorite_category TEXT,
  second_favorite_category TEXT,
  preferred_channel TEXT,
  discount_affinity TEXT,
  avg_days_between_orders DECIMAL(10, 2),
  dominant_price_band TEXT,
  category_diversity_score DECIMAL(5, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_attributes_favorite_category
  ON customer_attributes(favorite_category);

CREATE INDEX IF NOT EXISTS idx_customer_attributes_preferred_channel
  ON customer_attributes(preferred_channel);

CREATE INDEX IF NOT EXISTS idx_customer_attributes_discount_affinity
  ON customer_attributes(discount_affinity);

CREATE INDEX IF NOT EXISTS idx_customer_attributes_dominant_price_band
  ON customer_attributes(dominant_price_band);
