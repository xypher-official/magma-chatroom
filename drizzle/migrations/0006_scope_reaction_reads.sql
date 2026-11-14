CREATE OR REPLACE FUNCTION public.video_engagement_counts(_video uuid)
RETURNS TABLE(likes bigint, dislikes bigint, subscribers bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(*) FROM public.video_likes WHERE video_id = _video),
    (SELECT count(*) FROM public.video_dislikes WHERE video_id = _video),
    (SELECT count(*) FROM public.subscriptions s JOIN public.videos v ON v.author_id = s.channel_id WHERE v.id = _video)
  WHERE auth.uid() IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.video_engagement_counts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.video_engagement_counts(uuid) TO authenticated;

DROP POLICY IF EXISTS "likes readable by signed-in" ON public.social_likes;
CREATE POLICY "own likes readable" ON public.social_likes FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "video likes readable by signed-in" ON public.video_likes;
CREATE POLICY "own video likes readable" ON public.video_likes FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "dislikes readable by signed-in" ON public.video_dislikes;
CREATE POLICY "own video dislikes readable" ON public.video_dislikes FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "subs readable by signed-in" ON public.subscriptions;
CREATE POLICY "own or channel subs readable" ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = subscriber_id OR auth.uid() = channel_id OR public.has_role(auth.uid(),'admin'));