
CREATE TABLE public.global_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  style TEXT NOT NULL DEFAULT 'epic',
  color TEXT NOT NULL DEFAULT 'amber',
  icon TEXT NOT NULL DEFAULT 'Megaphone',
  duration_ms INTEGER NOT NULL DEFAULT 8000,
  sender_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.global_announcements TO authenticated;
GRANT ALL ON public.global_announcements TO service_role;

ALTER TABLE public.global_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "announcements readable by all auth"
  ON public.global_announcements FOR SELECT TO authenticated USING (true);

CREATE POLICY "admins create announcements"
  ON public.global_announcements FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = sender_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.global_announcements;
