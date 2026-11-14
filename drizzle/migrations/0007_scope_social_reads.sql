CREATE OR REPLACE FUNCTION public.is_active_member(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user AND is_banned = false)
$$;
REVOKE ALL ON FUNCTION public.is_active_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_member(uuid) TO authenticated;

DROP POLICY IF EXISTS "Profiles viewable by signed-in users" ON public.profiles;
CREATE POLICY "Profiles viewable by active members" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin') OR public.is_active_member(auth.uid()));

DROP POLICY IF EXISTS "posts readable by signed-in" ON public.social_posts;
CREATE POLICY "posts readable by active members" ON public.social_posts FOR SELECT TO authenticated
  USING (auth.uid() = author_id OR public.has_role(auth.uid(),'admin') OR public.is_active_member(auth.uid()));

DROP POLICY IF EXISTS "comments readable by signed-in" ON public.social_comments;
CREATE POLICY "comments readable on visible posts" ON public.social_comments FOR SELECT TO authenticated
  USING (auth.uid() = author_id OR public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.social_posts p WHERE p.id = post_id
      AND (p.author_id = auth.uid() OR public.is_active_member(auth.uid()))));

DROP POLICY IF EXISTS "video comments readable by signed-in" ON public.video_comments;
CREATE POLICY "video comments readable on visible videos" ON public.video_comments FOR SELECT TO authenticated
  USING (auth.uid() = author_id OR public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.videos v WHERE v.id = video_id
      AND (v.author_id = auth.uid() OR (v.status = 'published' AND public.is_active_member(auth.uid())))));

DROP POLICY IF EXISTS "lchat read signed-in" ON public.live_chat_messages;
CREATE POLICY "lchat readable on running streams" ON public.live_chat_messages FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.live_streams s WHERE s.id = stream_id
      AND (s.host_id = auth.uid() OR (s.status <> 'ended' AND public.is_active_member(auth.uid())))));