ALTER TABLE config_defaults ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS config_read ON config_defaults;
CREATE POLICY config_read ON config_defaults FOR SELECT USING (true);

ALTER TABLE plan_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS config_read ON plan_config;
CREATE POLICY config_read ON plan_config FOR SELECT USING (true);

ALTER TABLE campaign_embeddings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON campaign_embeddings;
CREATE POLICY tenant_isolation ON campaign_embeddings
  USING (company_id = app_company_id()) WITH CHECK (company_id = app_company_id());

ALTER TABLE persona_embeddings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON persona_embeddings;
CREATE POLICY tenant_isolation ON persona_embeddings
  USING (company_id = app_company_id()) WITH CHECK (company_id = app_company_id());

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_my_company_id' AND pronamespace = 'public'::regnamespace) THEN
    ALTER FUNCTION public.get_my_company_id() SET search_path = public;
    REVOKE EXECUTE ON FUNCTION public.get_my_company_id() FROM anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'app_company_id' AND pronamespace = 'public'::regnamespace) THEN
    ALTER FUNCTION public.app_company_id() SET search_path = public;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'enforce_campaign_status_transition' AND pronamespace = 'public'::regnamespace) THEN
    ALTER FUNCTION public.enforce_campaign_status_transition() SET search_path = public;
  END IF;
END $$;
