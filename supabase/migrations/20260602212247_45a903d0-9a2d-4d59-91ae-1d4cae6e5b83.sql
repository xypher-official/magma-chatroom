-- Email verification (optional second factor)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS keyboard_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS keyboard_theme text NOT NULL DEFAULT 'magma';

CREATE TABLE IF NOT EXISTS public.email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.email_verifications TO authenticated;
GRANT ALL ON public.email_verifications TO service_role;

ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own verif"
ON public.email_verifications FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_email_verif_user ON public.email_verifications(user_id, created_at DESC);
