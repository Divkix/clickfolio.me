-- These three tables were created by the deploy login instead of clickfolio_owner, which owns
-- every other table. Hand them over so that login can be retired. Skipped on databases without
-- clickfolio_owner (fresh self-hosted setups).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'clickfolio_owner') THEN
    ALTER TABLE public.rate_limit_locks OWNER TO clickfolio_owner;
    ALTER TABLE public.indexnow_state OWNER TO clickfolio_owner;
    ALTER TABLE public.indexnow_urls OWNER TO clickfolio_owner;
  END IF;
END $$;
