
CREATE TABLE public.videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  kind TEXT NOT NULL DEFAULT 'long',
  status TEXT NOT NULL DEFAULT 'published',
  scheduled_at TIMESTAMPTZ,
  is_premiere BOOLEAN NOT NULL DEFAULT false,
  premiere_at TIMESTAMPTZ,
  views_count INTEGER NOT NULL DEFAULT 0,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO authenticated;
GRANT SELECT ON public.videos TO anon;
GRANT ALL ON public.videos TO service_role;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "videos visible" ON public.videos FOR SELECT USING (
  status = 'published'
  OR auth.uid() = author_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
CREATE POLICY "users upload videos" ON public.videos FOR INSERT WITH CHECK (
  auth.uid() = author_id
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_banned = true)
);
CREATE POLICY "owner or admin update video" ON public.videos FOR UPDATE USING (
  auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'::app_role)
);
CREATE POLICY "owner or admin delete video" ON public.videos FOR DELETE USING (
  auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE TRIGGER trg_videos_updated BEFORE UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_videos_status_created ON public.videos(status, created_at DESC);
CREATE INDEX idx_videos_author ON public.videos(author_id);

CREATE TABLE public.video_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(video_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.video_likes TO authenticated;
GRANT SELECT ON public.video_likes TO anon;
GRANT ALL ON public.video_likes TO service_role;
ALTER TABLE public.video_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes readable" ON public.video_likes FOR SELECT USING (true);
CREATE POLICY "user like" ON public.video_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user unlike" ON public.video_likes FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.video_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL,
  author_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.video_comments TO authenticated;
GRANT SELECT ON public.video_comments TO anon;
GRANT ALL ON public.video_comments TO service_role;
ALTER TABLE public.video_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "video comments readable" ON public.video_comments FOR SELECT USING (true);
CREATE POLICY "user comment" ON public.video_comments FOR INSERT WITH CHECK (
  auth.uid() = author_id
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_banned = true)
);
CREATE POLICY "owner or admin delete comment" ON public.video_comments FOR DELETE USING (
  auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Counters
CREATE OR REPLACE FUNCTION public.bump_video_likes() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' THEN UPDATE public.videos SET likes_count = likes_count + 1 WHERE id = NEW.video_id;
  ELSIF TG_OP='DELETE' THEN UPDATE public.videos SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.video_id;
  END IF; RETURN NULL; END $$;
CREATE TRIGGER trg_video_likes_count AFTER INSERT OR DELETE ON public.video_likes
  FOR EACH ROW EXECUTE FUNCTION public.bump_video_likes();

CREATE OR REPLACE FUNCTION public.bump_video_comments() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' THEN UPDATE public.videos SET comments_count = comments_count + 1 WHERE id = NEW.video_id;
  ELSIF TG_OP='DELETE' THEN UPDATE public.videos SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.video_id;
  END IF; RETURN NULL; END $$;
CREATE TRIGGER trg_video_comments_count AFTER INSERT OR DELETE ON public.video_comments
  FOR EACH ROW EXECUTE FUNCTION public.bump_video_comments();

ALTER PUBLICATION supabase_realtime ADD TABLE public.videos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_comments;
