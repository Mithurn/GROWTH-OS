ALTER TABLE campaigns
  ADD CONSTRAINT campaigns_status_valid
  CHECK (status IN (
    'Draft', 'Approved', 'Running', 'Launched',
    'Completed', 'Partial', 'Failed', 'Cancelled', 'Rejected'
  )) NOT VALID;

CREATE OR REPLACE FUNCTION enforce_campaign_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  IF (OLD.status = 'Draft' AND NEW.status IN ('Approved', 'Rejected', 'Cancelled'))
    OR (OLD.status = 'Approved' AND NEW.status IN ('Launched', 'Cancelled'))
    OR (OLD.status = 'Running' AND NEW.status IN ('Launched', 'Completed', 'Failed', 'Cancelled'))
    OR (OLD.status = 'Launched' AND NEW.status IN ('Completed', 'Partial', 'Failed', 'Cancelled'))
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'invalid campaign status transition: % -> %', OLD.status, NEW.status
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER campaigns_status_transition
BEFORE UPDATE OF status ON campaigns
FOR EACH ROW
EXECUTE FUNCTION enforce_campaign_status_transition();
