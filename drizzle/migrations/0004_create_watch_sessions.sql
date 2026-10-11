CREATE TABLE public.watch_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  conversation_id uuid,
  group_id uuid,
  source_type text NOT NULL DEFAULT 'url',
  source text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT 'Watch Together',
  is_playing boolean NOT NULL DEFAULT false,
  position double precision NOT NULL DEFAULT 0,
  position_at timestamptz NOT NULL DEFAULT now(),
  rate double precision NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_sessions TO authenticated;
GRANT ALL ON public.watch_sessions TO service_role;
ALTER TABLE public.watch_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watch view" ON public.watch_sessions FOR SELECT TO authenticated USING (
  host_id = auth.uid()
  OR (conversation_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid())))
  OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid()))
  OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "watch insert" ON public.watch_sessions FOR INSERT TO authenticated WITH CHECK (host_id = auth.uid());
CREATE POLICY "watch update" ON public.watch_sessions FOR UPDATE TO authenticated USING (host_id = auth.uid()) WITH CHECK (host_id = auth.uid());
CREATE POLICY "watch delete" ON public.watch_sessions FOR DELETE TO authenticated USING (host_id = auth.uid());
ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_sessions;