-- The existing table has RLS enabled. Allow only the dedicated backend role
-- to read its rows. This does not grant SELECT to anonymous/public users.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'clergy_id_cards'
          AND policyname = 'rkp_api_reader_select'
    ) THEN
        CREATE POLICY rkp_api_reader_select
        ON public.clergy_id_cards
        FOR SELECT TO rkp_licence_reader
        USING (true);
    END IF;
END;
$$;
