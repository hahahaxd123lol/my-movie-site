-- Flix2Watch v165 — realtime Staff grant/removal visibility
-- Safe to rerun. No return-type changes or function recreation.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_moderators;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_table THEN RAISE EXCEPTION 'public.chat_moderators is missing';
  END;
END $$;
