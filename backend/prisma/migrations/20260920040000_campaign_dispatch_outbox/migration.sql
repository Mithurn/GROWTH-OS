DROP TRIGGER IF EXISTS campaigns_status_transition ON campaigns;
DROP FUNCTION IF EXISTS enforce_campaign_status_transition();
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_status_valid;

ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_status_valid
  CHECK (status IN (
    'Draft', 'Approved', 'Dispatching', 'Running', 'Launched',
    'Completed', 'Partial', 'Failed', 'Cancelled', 'Rejected'
  ));

CREATE OR REPLACE FUNCTION enforce_campaign_status_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF (OLD.status = 'Draft' AND NEW.status IN ('Approved', 'Rejected', 'Cancelled'))
    OR (OLD.status = 'Approved' AND NEW.status IN ('Dispatching', 'Cancelled'))
    OR (OLD.status = 'Dispatching' AND NEW.status IN ('Launched', 'Completed', 'Partial', 'Failed', 'Cancelled'))
    OR (OLD.status = 'Running' AND NEW.status IN ('Launched', 'Completed', 'Failed', 'Cancelled'))
    OR (OLD.status = 'Launched' AND NEW.status IN ('Completed', 'Partial', 'Failed', 'Cancelled'))
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'invalid campaign status transition: % -> %', OLD.status, NEW.status
    USING ERRCODE = 'check_violation';
END;
$$;

CREATE TRIGGER campaigns_status_transition
BEFORE UPDATE OF status ON campaigns
FOR EACH ROW
EXECUTE FUNCTION enforce_campaign_status_transition();

DROP INDEX IF EXISTS campaigns_one_live_per_opportunity;
CREATE UNIQUE INDEX campaigns_one_live_per_opportunity
  ON campaigns (opportunity_id)
  WHERE status IN ('Draft', 'Approved', 'Dispatching', 'Running', 'Launched');

ALTER TABLE communications ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX communications_idempotency_key_key
  ON communications (idempotency_key);

INSERT INTO config_defaults (key, value, description)
VALUES (
  'queue.communication_dispatch.concurrency',
  '10',
  'BullMQ: per-recipient communication dispatch concurrency'
)
ON CONFLICT (key) DO NOTHING;
