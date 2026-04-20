
-- ============= SOCIAL (YouTube-style) =============
CREATE TABLE public.social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image','video') OR media_type IS NULL),
  thumbnail_url TEXT,
  likes_count INT NOT NULL DEFAULT 0,
  comments_count INT NOT NULL DEFAULT 0,
  views_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_social_posts_author ON public.social_posts(author_id);
CREATE INDEX idx_social_posts_created ON public.social_posts(created_at DESC);
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posts readable by all" ON public.social_posts FOR SELECT USING (true);
CREATE POLICY "users create own posts" ON public.social_posts FOR INSERT WITH CHECK (
  auth.uid() = author_id AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_banned = true)
);
CREATE POLICY "owner update post" ON public.social_posts FOR UPDATE USING (auth.uid() = author_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "owner or admin delete post" ON public.social_posts FOR DELETE USING (auth.uid() = author_id OR has_role(auth.uid(),'admin'));

CREATE TRIGGER social_posts_updated BEFORE UPDATE ON public.social_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Comments
CREATE TABLE public.social_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_comments_post ON public.social_comments(post_id);
ALTER TABLE public.social_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments readable by all" ON public.social_comments FOR SELECT USING (true);
CREATE POLICY "users create comments" ON public.social_comments FOR INSERT WITH CHECK (
  auth.uid() = author_id AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_banned = true)
);
CREATE POLICY "owner or admin delete comment" ON public.social_comments FOR DELETE USING (auth.uid() = author_id OR has_role(auth.uid(),'admin'));

-- Likes
CREATE TABLE public.social_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);
ALTER TABLE public.social_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes readable by all" ON public.social_likes FOR SELECT USING (true);
CREATE POLICY "users like" ON public.social_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users unlike" ON public.social_likes FOR DELETE USING (auth.uid() = user_id);

-- Triggers to maintain counters
CREATE OR REPLACE FUNCTION public.bump_likes_count() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN UPDATE public.social_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN UPDATE public.social_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_likes_count AFTER INSERT OR DELETE ON public.social_likes FOR EACH ROW EXECUTE FUNCTION public.bump_likes_count();

CREATE OR REPLACE FUNCTION public.bump_comments_count() RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN UPDATE public.social_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN UPDATE public.social_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_comments_count AFTER INSERT OR DELETE ON public.social_comments FOR EACH ROW EXECUTE FUNCTION public.bump_comments_count();

-- Subscriptions (channels = users)
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL,
  subscriber_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(channel_id, subscriber_id),
  CHECK (channel_id <> subscriber_id)
);
CREATE INDEX idx_subs_channel ON public.subscriptions(channel_id);
CREATE INDEX idx_subs_subscriber ON public.subscriptions(subscriber_id);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subs readable by all" ON public.subscriptions FOR SELECT USING (true);
CREATE POLICY "users subscribe" ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = subscriber_id);
CREATE POLICY "users unsubscribe" ON public.subscriptions FOR DELETE USING (auth.uid() = subscriber_id);

-- ============= CALLS (WebRTC signaling) =============
CREATE TABLE public.calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id UUID NOT NULL,
  callee_id UUID,
  conversation_id UUID,
  group_id UUID,
  call_type TEXT NOT NULL DEFAULT 'video' CHECK (call_type IN ('audio','video')),
  status TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing','active','ended','rejected','missed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);
CREATE INDEX idx_calls_callee ON public.calls(callee_id);
CREATE INDEX idx_calls_caller ON public.calls(caller_id);
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants see call" ON public.calls FOR SELECT USING (
  auth.uid() = caller_id OR auth.uid() = callee_id OR has_role(auth.uid(),'admin')
);
CREATE POLICY "users create call" ON public.calls FOR INSERT WITH CHECK (auth.uid() = caller_id);
CREATE POLICY "participants update call" ON public.calls FOR UPDATE USING (
  auth.uid() = caller_id OR auth.uid() = callee_id OR has_role(auth.uid(),'admin')
);

-- WebRTC signaling messages
CREATE TABLE public.call_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  from_user UUID NOT NULL,
  to_user UUID NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('offer','answer','ice','hangup')),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_signals_call ON public.call_signals(call_id);
CREATE INDEX idx_signals_to ON public.call_signals(to_user);
ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signals readable by participants" ON public.call_signals FOR SELECT USING (
  auth.uid() = from_user OR auth.uid() = to_user
);
CREATE POLICY "send signals" ON public.call_signals FOR INSERT WITH CHECK (auth.uid() = from_user);

-- ============= MUTES =============
CREATE TABLE public.user_mutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  muted_until TIMESTAMPTZ NOT NULL,
  reason TEXT,
  muted_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_mutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mutes readable by all" ON public.user_mutes FOR SELECT USING (true);
CREATE POLICY "admins manage mutes" ON public.user_mutes FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- ============= STORAGE for social media =============
INSERT INTO storage.buckets (id, name, public) VALUES ('social-media','social-media', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "social media public read" ON storage.objects FOR SELECT USING (bucket_id = 'social-media');
CREATE POLICY "users upload own social media" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'social-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "users delete own social media" ON storage.objects FOR DELETE
  USING (bucket_id = 'social-media' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(),'admin')));

-- ============= REALTIME =============
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.social_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_signals;

-- Helper: check if user is muted
CREATE OR REPLACE FUNCTION public.is_user_muted(_user UUID) RETURNS BOOLEAN
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS(SELECT 1 FROM public.user_mutes WHERE user_id = _user AND muted_until > now());
$$;
