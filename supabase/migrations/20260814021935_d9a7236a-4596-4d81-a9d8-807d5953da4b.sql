CREATE TABLE public.ai_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT '',
  api_key text NOT NULL DEFAULT '',
  base_url text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_providers TO authenticated;
GRANT ALL ON public.ai_providers TO service_role;

ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ai providers" ON public.ai_providers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_ai_providers_updated BEFORE UPDATE ON public.ai_providers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.text_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_text text NOT NULL UNIQUE,
  to_text text NOT NULL,
  match_mode text NOT NULL DEFAULT 'exact',
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.text_overrides TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.text_overrides TO authenticated;
GRANT ALL ON public.text_overrides TO service_role;

ALTER TABLE public.text_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read text overrides" ON public.text_overrides
  FOR SELECT USING (true);

CREATE POLICY "Admins insert text overrides" ON public.text_overrides
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update text overrides" ON public.text_overrides
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete text overrides" ON public.text_overrides
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_text_overrides_updated BEFORE UPDATE ON public.text_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();