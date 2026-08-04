CREATE TABLE public.video_dislikes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (video_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.video_dislikes TO authenticated;
GRANT SELECT ON public.video_dislikes TO anon;
GRANT ALL ON public.video_dislikes TO service_role;
ALTER TABLE public.video_dislikes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dislikes viewable by everyone" ON public.video_dislikes FOR SELECT USING (true);
CREATE POLICY "users manage own dislikes" ON public.video_dislikes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "users delete own dislikes" ON public.video_dislikes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.playlists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Watch later',
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlists TO authenticated;
GRANT SELECT ON public.playlists TO anon;
GRANT ALL ON public.playlists TO service_role;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "playlists visible to owner or public" ON public.playlists FOR SELECT USING (is_public OR owner_id = auth.uid());
CREATE POLICY "owner creates playlists" ON public.playlists FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "owner updates playlists" ON public.playlists FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "owner deletes playlists" ON public.playlists FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE TABLE public.playlist_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playlist_id, video_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.playlist_items TO authenticated;
GRANT SELECT ON public.playlist_items TO anon;
GRANT ALL ON public.playlist_items TO service_role;
ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "playlist items follow playlist visibility" ON public.playlist_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND (p.is_public OR p.owner_id = auth.uid()))
);
CREATE POLICY "owner adds playlist items" ON public.playlist_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.owner_id = auth.uid())
);
CREATE POLICY "owner removes playlist items" ON public.playlist_items FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.owner_id = auth.uid())
);