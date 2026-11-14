-- profiles: signed-in only, hide email column from other users
DROP POLICY IF EXISTS "Profiles viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by signed-in users" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, user_id, username, display_name, avatar_initials, is_verified, is_banned, is_official, last_seen, created_at, updated_at, allow_dms, terms_accepted_at, avatar_url, language, email_verified_at, keyboard_enabled, keyboard_theme, bio, wallpaper_url, bubble_color) ON public.profiles TO authenticated;
CREATE OR REPLACE FUNCTION public.get_my_email() RETURNS TABLE(email text, email_verified_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.email, p.email_verified_at FROM public.profiles p WHERE p.user_id = auth.uid()
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_email() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_email() TO authenticated;

-- user_roles: own roles or admins
DROP POLICY IF EXISTS "Roles readable by everyone authenticated" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- user_mutes: own mute or admins
DROP POLICY IF EXISTS "mutes readable by all" ON public.user_mutes;
CREATE POLICY "mutes readable by self or admin" ON public.user_mutes FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

-- scheduled_calls: host, invitees, group members, admins
DROP POLICY IF EXISTS "auth read sched" ON public.scheduled_calls;
CREATE POLICY "participants read sched" ON public.scheduled_calls FOR SELECT TO authenticated USING (
  auth.uid() = host_id OR auth.uid() = ANY(invitee_ids)
  OR (group_id IS NOT NULL AND public.is_group_member(group_id, auth.uid()))
  OR public.has_role(auth.uid(),'admin'));

-- social/video content: signed-in users only
DROP POLICY IF EXISTS "posts readable by all" ON public.social_posts;
CREATE POLICY "posts readable by signed-in" ON public.social_posts FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "comments readable by all" ON public.social_comments;
CREATE POLICY "comments readable by signed-in" ON public.social_comments FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "likes readable by all" ON public.social_likes;
CREATE POLICY "likes readable by signed-in" ON public.social_likes FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "subs readable by all" ON public.subscriptions;
CREATE POLICY "subs readable by signed-in" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "likes readable" ON public.video_likes;
CREATE POLICY "video likes readable by signed-in" ON public.video_likes FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "video comments readable" ON public.video_comments;
CREATE POLICY "video comments readable by signed-in" ON public.video_comments FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "dislikes viewable by everyone" ON public.video_dislikes;
CREATE POLICY "dislikes readable by signed-in" ON public.video_dislikes FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "lchat read" ON public.live_chat_messages;
CREATE POLICY "lchat read signed-in" ON public.live_chat_messages FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);