
-- 1) USER BLOCKS
CREATE TABLE public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own blocks" ON public.user_blocks
  FOR SELECT USING (auth.uid() = blocker_id OR auth.uid() = blocked_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "users create own blocks" ON public.user_blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "users delete own blocks" ON public.user_blocks
  FOR DELETE USING (auth.uid() = blocker_id OR has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.is_blocked_between(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_blocks
    WHERE (blocker_id=_a AND blocked_id=_b) OR (blocker_id=_b AND blocked_id=_a));
$$;

-- Update messages INSERT policy to forbid sending when blocked
DROP POLICY IF EXISTS "Users send messages but not to support" ON public.messages;
CREATE POLICY "Users send messages but not to support" ON public.messages
FOR INSERT WITH CHECK (
  (auth.uid() = sender_id)
  AND (EXISTS (SELECT 1 FROM conversations c
       WHERE c.id = messages.conversation_id
       AND (auth.uid() = c.user_a OR auth.uid() = c.user_b)))
  AND NOT conversation_has_official(conversation_id)
  AND NOT (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.is_banned = true))
  AND NOT (EXISTS (
    SELECT 1 FROM conversations c, public.user_blocks b
    WHERE c.id = messages.conversation_id
      AND ((b.blocker_id = c.user_a AND b.blocked_id = c.user_b)
        OR (b.blocker_id = c.user_b AND b.blocked_id = c.user_a))
  ))
);

-- 2) SITE EFFECTS (global realtime)
CREATE TABLE public.site_effects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_effects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "effects readable by all" ON public.site_effects FOR SELECT USING (true);
CREATE POLICY "admins manage effects" ON public.site_effects FOR ALL
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

INSERT INTO public.site_effects(key, enabled) VALUES
  ('snow', false), ('hats', false), ('confetti', false), ('rain', false), ('fireworks', false)
  ON CONFLICT (key) DO NOTHING;

-- 3) EVENT DRAFTS / countdown
ALTER TABLE public.live_events
  ADD COLUMN IF NOT EXISTS publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS countdown_label text NOT NULL DEFAULT '';

-- 4) GROUP INVITES (pending invites from owner/mods to your contacts)
CREATE TABLE public.group_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  inviter_id uuid NOT NULL,
  invitee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, invitee_id)
);
ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "see own or related invites" ON public.group_invites FOR SELECT
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id
    OR is_group_mod_or_owner(group_id, auth.uid())
    OR has_role(auth.uid(),'admin'));
CREATE POLICY "mods create invites" ON public.group_invites FOR INSERT
  WITH CHECK (auth.uid() = inviter_id
    AND (is_group_mod_or_owner(group_id, auth.uid()) OR has_role(auth.uid(),'admin')));
CREATE POLICY "invitee or mod update invite" ON public.group_invites FOR UPDATE
  USING (auth.uid() = invitee_id OR is_group_mod_or_owner(group_id, auth.uid()) OR has_role(auth.uid(),'admin'));
CREATE POLICY "delete own invite" ON public.group_invites FOR DELETE
  USING (auth.uid() = inviter_id OR auth.uid() = invitee_id OR has_role(auth.uid(),'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_effects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_invites;
