CREATE TYPE "InvolvementMode" AS ENUM (
  'manual',
  'approve_above_threshold',
  'autonomous_within_policy'
);

ALTER TABLE agents
  ADD COLUMN involvement_mode "InvolvementMode" NOT NULL DEFAULT 'manual';

UPDATE agents
SET involvement_mode = CASE
  WHEN lower(COALESCE(guardrails->>'involvement', '')) LIKE '%autopilot%'
    OR lower(COALESCE(guardrails->>'involvement', '')) LIKE '%autonomous%'
    THEN 'autonomous_within_policy'::"InvolvementMode"
  WHEN lower(COALESCE(guardrails->>'involvement', '')) LIKE '%major%'
    THEN 'approve_above_threshold'::"InvolvementMode"
  ELSE 'manual'::"InvolvementMode"
END;
