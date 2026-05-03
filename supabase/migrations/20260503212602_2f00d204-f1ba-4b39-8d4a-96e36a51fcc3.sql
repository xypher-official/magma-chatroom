-- ============ STORAGE: voice messages bucket ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-messages', 'voice-messages', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "voice msgs: read own folder"
ON storage.objects FOR SELECT
USING (bucket_id = 'voice-messages' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "voice msgs: read if shared in conversation"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'voice-messages'
  AND EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    WHERE m.media_url LIKE '%' || name || '%'
      AND (auth.uid() = c.user_a OR auth.uid() = c.user_b)
  )
);

CREATE POLICY "voice msgs: read if shared in group"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'voice-messages'
  AND EXISTS (
    SELECT 1 FROM public.group_messages gm
    WHERE gm.media_url LIKE '%' || name || '%'
      AND public.is_group_member(gm.group_id, auth.uid())
  )
);

CREATE POLICY "voice msgs: upload own"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'voice-messages' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "voice msgs: delete own"
ON storage.objects FOR DELETE
USING (bucket_id = 'voice-messages' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============ SCHEDULED CALLS ============
CREATE TABLE public.scheduled_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Magma Call',
  description text NOT NULL DEFAULT '',
  scheduled_at timestamptz NOT NULL,
  call_type text NOT NULL DEFAULT 'video' CHECK (call_type IN ('video','audio')),
  group_id uuid,
  invitee_ids uuid[] NOT NULL DEFAULT '{}',
  room_id text NOT NULL DEFAULT gen_random_uuid()::text,
  share_link text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scheduled_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "host or invitee or admin read sched"
ON public.scheduled_calls FOR SELECT
USING (auth.uid() = host_id OR auth.uid() = ANY(invitee_ids) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "users create sched"
ON public.scheduled_calls FOR INSERT
WITH CHECK (auth.uid() = host_id);
CREATE POLICY "host or admin update sched"
ON public.scheduled_calls FOR UPDATE
USING (auth.uid() = host_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "host or admin delete sched"
ON public.scheduled_calls FOR DELETE
USING (auth.uid() = host_id OR public.has_role(auth.uid(),'admin'));

-- ============ LOCATION SHARES ============
CREATE TABLE public.location_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conversation_id uuid,
  group_id uuid,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.location_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES public.location_shares(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.location_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_pings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner create share" ON public.location_shares FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner update share" ON public.location_shares FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "owner delete share" ON public.location_shares FOR DELETE USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "participants read share" ON public.location_shares FOR SELECT USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(),'admin')
  OR (conversation_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (auth.uid() = c.user_a OR auth.uid() = c.user_b)))
  OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid()))
);
CREATE POLICY "owner insert ping" ON public.location_pings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.location_shares s WHERE s.id = share_id AND s.user_id = auth.uid())
);
CREATE POLICY "participants read pings" ON public.location_pings FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.location_shares s
    WHERE s.id = share_id AND (
      s.user_id = auth.uid()
      OR public.has_role(auth.uid(),'admin')
      OR (s.conversation_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = s.conversation_id AND (auth.uid() = c.user_a OR auth.uid() = c.user_b)))
      OR (s.group_id IS NOT NULL AND public.is_group_member(s.group_id, auth.uid()))
    )
  )
);

-- ============ CALL THEME (admin global) ============
CREATE TABLE public.call_theme (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  primary_color text NOT NULL DEFAULT '#f97316',
  accent_color text NOT NULL DEFAULT '#d946ef',
  background_style text NOT NULL DEFAULT 'magma',
  button_position text NOT NULL DEFAULT 'bottom',
  show_timer boolean NOT NULL DEFAULT true,
  show_participants boolean NOT NULL DEFAULT true,
  hangup_label text NOT NULL DEFAULT 'End',
  mute_label text NOT NULL DEFAULT 'Mute',
  camera_label text NOT NULL DEFAULT 'Camera',
  custom_css text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.call_theme (id) VALUES (1) ON CONFLICT DO NOTHING;
ALTER TABLE public.call_theme ENABLE ROW LEVEL SECURITY;
CREATE POLICY "theme readable by all" ON public.call_theme FOR SELECT USING (true);
CREATE POLICY "admins update theme" ON public.call_theme FOR UPDATE USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ CALL EVENTS (joined / left / reactions) ============
CREATE TABLE public.call_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL,
  user_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('joined','left','muted','unmuted','camera_on','camera_off')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.call_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read events"
ON public.call_events FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.calls c WHERE c.id = call_id AND (auth.uid() = c.caller_id OR auth.uid() = c.callee_id))
  OR public.has_role(auth.uid(),'admin')
);
CREATE POLICY "users insert own event"
ON public.call_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============ IMPORTANT USERS (admin pin) ============
CREATE TABLE public.important_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  marked_by uuid NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.important_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage important users"
ON public.important_users FOR ALL
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ BANNER additions ============
ALTER TABLE public.site_banner
  ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT 'Megaphone',
  ADD COLUMN IF NOT EXISTS position text NOT NULL DEFAULT 'top',
  ADD COLUMN IF NOT EXISTS cta_label text NOT NULL DEFAULT '';

-- ============ Realtime ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.location_pings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.location_shares;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_calls;
ALTER TABLE public.call_events REPLICA IDENTITY FULL;
ALTER TABLE public.location_pings REPLICA IDENTITY FULL;
ALTER TABLE public.location_shares REPLICA IDENTITY FULL;