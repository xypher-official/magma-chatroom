ALTER TABLE public.text_overrides REPLICA IDENTITY FULL;
ALTER TABLE public.ui_settings REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.text_overrides; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ui_settings; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;