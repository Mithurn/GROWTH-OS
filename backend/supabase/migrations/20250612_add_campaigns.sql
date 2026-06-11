-- ============================================
-- PHASE 2: Campaign Planner Tables
-- ============================================

-- Campaigns Table
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  objective TEXT NOT NULL,
  channel VARCHAR(50) NOT NULL, -- 'WhatsApp', 'Email', 'SMS'
  offer TEXT,
  message_angle TEXT,
  message_content TEXT NOT NULL,
  expected_outcome TEXT,
  reasoning TEXT,

  status VARCHAR(50) NOT NULL DEFAULT 'Draft', -- 'Draft', 'Approved', 'Launched', 'Completed'

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  launched_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT campaigns_channel_check CHECK (channel IN ('WhatsApp', 'Email', 'SMS')),
  CONSTRAINT campaigns_status_check CHECK (status IN ('Draft', 'Approved', 'Launched', 'Completed'))
);

CREATE INDEX idx_campaigns_company_id ON campaigns(company_id);
CREATE INDEX idx_campaigns_opportunity_id ON campaigns(opportunity_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_created_at ON campaigns(created_at DESC);

-- Communications Table
CREATE TABLE IF NOT EXISTS communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  channel VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'QUEUED', -- 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'CLICKED', 'FAILED'

  provider_message_id VARCHAR(255), -- External ID from channel service
  failure_reason TEXT,
  retry_count INT DEFAULT 0,

  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT communications_channel_check CHECK (channel IN ('WhatsApp', 'Email', 'SMS')),
  CONSTRAINT communications_status_check CHECK (status IN ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'CLICKED', 'FAILED'))
);

CREATE INDEX idx_communications_campaign_id ON communications(campaign_id);
CREATE INDEX idx_communications_customer_id ON communications(customer_id);
CREATE INDEX idx_communications_status ON communications(status);
CREATE INDEX idx_communications_provider_message_id ON communications(provider_message_id);
CREATE INDEX idx_communications_created_at ON communications(created_at DESC);

-- Communication Events Table (Event Sourcing)
CREATE TABLE IF NOT EXISTS communication_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id UUID NOT NULL REFERENCES communications(id) ON DELETE CASCADE,

  event_type VARCHAR(50) NOT NULL, -- 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'CLICKED', 'FAILED'
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  sequence_number INT NOT NULL, -- 1=QUEUED, 2=SENT, 3=DELIVERED, 4=READ, 5=CLICKED

  provider_message_id VARCHAR(255),
  provider_event_id VARCHAR(255), -- External event ID from webhook
  error_message TEXT,
  metadata JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT communication_events_type_check CHECK (event_type IN ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'CLICKED', 'FAILED')),
  CONSTRAINT communication_events_sequence_check CHECK (sequence_number >= 1 AND sequence_number <= 5)
);

CREATE INDEX idx_communication_events_communication_id ON communication_events(communication_id);
CREATE INDEX idx_communication_events_type ON communication_events(event_type);
CREATE INDEX idx_communication_events_timestamp ON communication_events(event_timestamp DESC);
CREATE INDEX idx_communication_events_sequence ON communication_events(sequence_number);
CREATE INDEX idx_communication_events_provider_event_id ON communication_events(provider_event_id);

-- Processed Webhook Events Table (Idempotency)
CREATE TABLE IF NOT EXISTS processed_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(255) NOT NULL UNIQUE, -- External event ID from webhook
  communication_id UUID REFERENCES communications(id) ON DELETE SET NULL,

  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT processed_webhook_events_event_id_unique UNIQUE(event_id)
);

CREATE INDEX idx_processed_webhook_events_event_id ON processed_webhook_events(event_id);
CREATE INDEX idx_processed_webhook_events_processed_at ON processed_webhook_events(processed_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_communications_updated_at
  BEFORE UPDATE ON communications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
