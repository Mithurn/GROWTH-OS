DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_my_company_id' AND pronamespace = 'public'::regnamespace) THEN
    REVOKE EXECUTE ON FUNCTION public.get_my_company_id() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;
