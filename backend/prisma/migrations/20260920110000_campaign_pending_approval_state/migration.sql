DROP TRIGGER IF EXISTS campaigns_status_transition ON campaigns;
DROP FUNCTION IF EXISTS enforce_campaign_status_transition();
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_status_valid;

UPDATE campaigns SET status = 'PendingApproval' WHERE status = 'Draft';
ALTER TABLE campaigns ALTER COLUMN status SET DEFAULT 'PendingApproval';

ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_status_valid
  CHECK (status IN (
    'Draft', 'PendingApproval', 'Approved', 'Dispatching', 'Running', 'Launched',
    'Completed', 'Partial', 'Failed', 'Cancelled', 'Rejected'
  ));

CREATE OR REPLACE FUNCTION enforce_campaign_status_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF (OLD.status = 'Draft' AND NEW.status IN ('PendingApproval', 'Cancelled'))
    OR (OLD.status = 'PendingApproval' AND NEW.status IN ('Approved', 'Rejected', 'Cancelled'))
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
  WHERE status IN ('Draft', 'PendingApproval', 'Approved', 'Dispatching', 'Running', 'Launched');
