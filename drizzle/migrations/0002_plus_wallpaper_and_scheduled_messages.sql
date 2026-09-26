ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS wallpaper_url text,
  ADD COLUMN IF NOT EXISTS bubble_color text;

CREATE TABLE public.scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 4000),
  send_at timestamptz NOT NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_messages TO authenticated;
GRANT ALL ON public.scheduled_messages TO service_role;
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own scheduled select" ON public.scheduled_messages FOR SELECT TO authenticated USING (auth.uid() = sender_id);
CREATE POLICY "own scheduled insert" ON public.scheduled_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id AND sender_id <> recipient_id);
CREATE POLICY "own scheduled delete" ON public.scheduled_messages FOR DELETE TO authenticated USING (auth.uid() = sender_id AND sent_at IS NULL);
CREATE INDEX idx_sched_due ON public.scheduled_messages (send_at) WHERE sent_at IS NULL;

CREATE OR REPLACE FUNCTION public.process_scheduled_messages()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; _conv uuid; _a uuid; _b uuid; _n integer := 0;
BEGIN
  FOR r IN SELECT * FROM public.scheduled_messages WHERE sent_at IS NULL AND send_at <= now() ORDER BY send_at LIMIT 200 FOR UPDATE SKIP LOCKED LOOP
    IF public.is_blocked_between(r.sender_id, r.recipient_id) THEN
      UPDATE public.scheduled_messages SET sent_at = now() WHERE id = r.id; CONTINUE;
    END IF;
    _a := LEAST(r.sender_id, r.recipient_id); _b := GREATEST(r.sender_id, r.recipient_id);
    _conv := NULL;
    SELECT id INTO _conv FROM public.conversations WHERE user_a = _a AND user_b = _b;
    IF _conv IS NULL THEN
      INSERT INTO public.conversations (user_a, user_b) VALUES (_a, _b) RETURNING id INTO _conv;
    END IF;
    INSERT INTO public.messages (conversation_id, sender_id, content) VALUES (_conv, r.sender_id, r.content);
    UPDATE public.conversations SET last_message_at = now() WHERE id = _conv;
    UPDATE public.scheduled_messages SET sent_at = now() WHERE id = r.id;
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END $$;
GRANT EXECUTE ON FUNCTION public.process_scheduled_messages() TO authenticated;