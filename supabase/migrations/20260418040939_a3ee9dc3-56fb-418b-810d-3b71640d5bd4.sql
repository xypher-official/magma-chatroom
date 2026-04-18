
-- ============ CMS: secciones del sitio + banner ============
CREATE TABLE public.site_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.site_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_sections readable by all"
  ON public.site_sections FOR SELECT USING (true);
CREATE POLICY "admins manage site_sections"
  ON public.site_sections FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.site_banner (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT false,
  message TEXT NOT NULL DEFAULT '',
  link TEXT,
  color TEXT NOT NULL DEFAULT 'amber',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.site_banner (id) VALUES (1);
ALTER TABLE public.site_banner ENABLE ROW LEVEL SECURITY;
CREATE POLICY "banner readable by all"
  ON public.site_banner FOR SELECT USING (true);
CREATE POLICY "admins update banner"
  ON public.site_banner FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ GRUPOS ============
CREATE TABLE public.groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  avatar_initials TEXT NOT NULL DEFAULT 'GR',
  owner_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

CREATE TABLE public.group_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- security definer to avoid recursion
CREATE OR REPLACE FUNCTION public.is_group_member(_group UUID, _user UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.group_members WHERE group_id = _group AND user_id = _user);
$$;

CREATE POLICY "members see group"
  ON public.groups FOR SELECT
  USING (public.is_group_member(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "users create groups"
  ON public.groups FOR INSERT
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner or admin update group"
  ON public.groups FOR UPDATE
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner or admin delete group"
  ON public.groups FOR DELETE
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "members see members"
  ON public.group_members FOR SELECT
  USING (public.is_group_member(group_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner or admin add members"
  ON public.group_members FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
    OR auth.uid() = user_id
  );
CREATE POLICY "owner or self or admin remove member"
  ON public.group_members FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin')
    OR auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.owner_id = auth.uid())
  );

CREATE POLICY "members read group messages"
  ON public.group_messages FOR SELECT
  USING (public.is_group_member(group_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "members send group messages"
  ON public.group_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_group_member(group_id, auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_banned = true)
  );
CREATE POLICY "admins send any group message"
  ON public.group_messages FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete group messages"
  ON public.group_messages FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ EVENTOS EN VIVO ============
CREATE TABLE public.live_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE public.live_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.live_events(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.live_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events readable by all"
  ON public.live_events FOR SELECT USING (true);
CREATE POLICY "admins manage events"
  ON public.live_events FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "updates readable by all"
  ON public.live_updates FOR SELECT USING (true);
CREATE POLICY "admins manage updates"
  ON public.live_updates FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ Realtime ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_sections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_banner;
ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_updates;

-- Seed default sections
INSERT INTO public.site_sections (key, title, content) VALUES
  ('welcome', '🌋 Bienvenido a Magma Chat Room', 'La plataforma de chat más caliente del planeta.'),
  ('footer', 'Footer', '© Magma Chat Room — Forjado en lava digital');
