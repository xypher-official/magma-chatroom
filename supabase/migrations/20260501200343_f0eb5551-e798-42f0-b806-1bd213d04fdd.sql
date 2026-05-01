-- ============== GROUP ROLES ==============
CREATE TYPE public.group_role AS ENUM ('owner', 'moderator', 'member');

CREATE TABLE public.group_member_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role public.group_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
ALTER TABLE public.group_member_roles ENABLE ROW LEVEL SECURITY;

INSERT INTO public.group_member_roles (group_id, user_id, role)
SELECT id, owner_id, 'owner' FROM public.groups
ON CONFLICT DO NOTHING;

INSERT INTO public.group_member_roles (group_id, user_id, role)
SELECT gm.group_id, gm.user_id, 'member'
FROM public.group_members gm
LEFT JOIN public.group_member_roles gmr
  ON gmr.group_id = gm.group_id AND gmr.user_id = gm.user_id
WHERE gmr.id IS NULL;

CREATE OR REPLACE FUNCTION public.get_group_role(_group uuid, _user uuid)
RETURNS public.group_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.group_member_roles WHERE group_id = _group AND user_id = _user; $$;

CREATE OR REPLACE FUNCTION public.is_group_mod_or_owner(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.group_member_roles
  WHERE group_id = _group AND user_id = _user AND role IN ('owner','moderator')); $$;

CREATE OR REPLACE FUNCTION public.is_group_owner(_group uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.group_member_roles
  WHERE group_id = _group AND user_id = _user AND role = 'owner'); $$;

CREATE POLICY "members read roles" ON public.group_member_roles
  FOR SELECT USING (public.is_group_member(group_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "owner or admin assign roles" ON public.group_member_roles
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR public.is_group_owner(group_id, auth.uid())
    OR (auth.uid() = user_id AND role = 'member')
  );
CREATE POLICY "owner or admin update roles" ON public.group_member_roles
  FOR UPDATE USING (public.has_role(auth.uid(),'admin') OR public.is_group_owner(group_id, auth.uid()));
CREATE POLICY "owner or admin remove roles" ON public.group_member_roles
  FOR DELETE USING (
    public.has_role(auth.uid(),'admin')
    OR public.is_group_owner(group_id, auth.uid())
    OR auth.uid() = user_id
  );

-- ============== GROUP COLUMNS ==============
ALTER TABLE public.groups
  ADD COLUMN write_mode TEXT NOT NULL DEFAULT 'everyone' CHECK (write_mode IN ('everyone','mods_only')),
  ADD COLUMN avatar_url TEXT;

DROP POLICY IF EXISTS "members send group messages" ON public.group_messages;
CREATE POLICY "members send group messages" ON public.group_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND public.is_group_member(group_id, auth.uid())
    AND NOT (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_banned = true))
    AND (
      (SELECT g.write_mode FROM public.groups g WHERE g.id = group_id) = 'everyone'
      OR public.is_group_mod_or_owner(group_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "owner or admin update group" ON public.groups;
CREATE POLICY "owner mod or admin update group" ON public.groups
  FOR UPDATE USING (
    public.has_role(auth.uid(),'admin')
    OR public.is_group_mod_or_owner(id, auth.uid())
  );

DROP POLICY IF EXISTS "admins delete group messages" ON public.group_messages;
CREATE POLICY "mods owners admins delete group messages" ON public.group_messages
  FOR DELETE USING (
    public.has_role(auth.uid(),'admin')
    OR public.is_group_mod_or_owner(group_id, auth.uid())
    OR auth.uid() = sender_id
  );

CREATE OR REPLACE FUNCTION public.ensure_group_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.group_member_roles (group_id, user_id, role)
  VALUES (NEW.group_id, NEW.user_id,
    CASE WHEN EXISTS (SELECT 1 FROM public.groups g WHERE g.id = NEW.group_id AND g.owner_id = NEW.user_id)
         THEN 'owner'::public.group_role ELSE 'member'::public.group_role END)
  ON CONFLICT (group_id, user_id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_ensure_group_role
AFTER INSERT ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.ensure_group_role();

CREATE OR REPLACE FUNCTION public.ensure_group_owner_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.group_member_roles (group_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner'::public.group_role)
  ON CONFLICT (group_id, user_id) DO UPDATE SET role = 'owner'::public.group_role;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_ensure_group_owner_role
AFTER INSERT ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.ensure_group_owner_role();

-- ============== CALLS WEBRTC ==============
ALTER TABLE public.calls ADD COLUMN room_id TEXT;
CREATE INDEX IF NOT EXISTS idx_call_signals_call_to ON public.call_signals (call_id, to_user, created_at);
CREATE INDEX IF NOT EXISTS idx_calls_status ON public.calls (status, started_at DESC);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='calls') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.calls';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='call_signals') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='group_member_roles') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.group_member_roles';
  END IF;
END $$;

-- ============== PROFILES ==============
ALTER TABLE public.profiles
  ADD COLUMN terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN avatar_url TEXT,
  ADD COLUMN language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('es','en','de','it','fr','pt'));

-- ============== MESSAGES MEDIA ==============
ALTER TABLE public.messages
  ADD COLUMN media_url TEXT,
  ADD COLUMN media_type TEXT;

ALTER TABLE public.group_messages
  ADD COLUMN media_url TEXT,
  ADD COLUMN media_type TEXT;

-- ============== STORAGE: avatars bucket ==============
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars upload own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "avatars update own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "avatars delete own or admin" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin'))
  );