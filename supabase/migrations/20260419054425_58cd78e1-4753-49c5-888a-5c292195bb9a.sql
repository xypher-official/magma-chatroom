-- UI settings (key/value)
CREATE TABLE public.ui_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ui_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ui_settings readable by all" ON public.ui_settings FOR SELECT USING (true);
CREATE POLICY "admins manage ui_settings" ON public.ui_settings FOR ALL
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Public pages
CREATE TABLE public.site_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  emoji text NOT NULL DEFAULT '📄',
  icon text NOT NULL DEFAULT 'FileText',
  enabled boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_pages readable by all" ON public.site_pages FOR SELECT USING (true);
CREATE POLICY "admins manage site_pages" ON public.site_pages FOR ALL
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ui_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_pages;

-- Seed defaults
INSERT INTO public.ui_settings (key, value) VALUES
  ('app.name', 'Magma Chat Room'),
  ('tab.chats', 'Chats'),
  ('tab.groups', 'Grupos'),
  ('placeholder.message', 'Escribe un mensaje...'),
  ('placeholder.search', 'Buscar...'),
  ('theme.primary', '24 100% 50%'),
  ('theme.accent', '12 90% 55%')
ON CONFLICT (key) DO NOTHING;