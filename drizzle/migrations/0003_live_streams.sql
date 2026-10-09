CREATE TABLE public.live_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Live',
  source text NOT NULL DEFAULT 'camera_front',
  status text NOT NULL DEFAULT 'live',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
GRANT SELECT ON public.live_streams TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_streams TO authenticated;
GRANT ALL ON public.live_streams TO service_role;
ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live read" ON public.live_streams FOR SELECT USING (true);
CREATE POLICY "live insert" ON public.live_streams FOR INSERT TO authenticated WITH CHECK (host_id = auth.uid());
CREATE POLICY "live update" ON public.live_streams FOR UPDATE TO authenticated USING (host_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "live delete" ON public.live_streams FOR DELETE TO authenticated USING (host_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.live_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.live_chat_messages TO anon;
GRANT SELECT, INSERT, DELETE ON public.live_chat_messages TO authenticated;
GRANT ALL ON public.live_chat_messages TO service_role;
ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lchat read" ON public.live_chat_messages FOR SELECT USING (true);
CREATE POLICY "lchat insert" ON public.live_chat_messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND length(content) <= 500);
CREATE POLICY "lchat delete" ON public.live_chat_messages FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.live_streams s WHERE s.id = stream_id AND s.host_id = auth.uid()));
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_streams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_messages;