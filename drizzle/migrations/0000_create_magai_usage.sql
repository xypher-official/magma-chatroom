CREATE TABLE public.magai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  credits integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

GRANT SELECT, INSERT, UPDATE ON public.magai_usage TO authenticated;
GRANT ALL ON public.magai_usage TO service_role;

ALTER TABLE public.magai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own usage select" ON public.magai_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own usage insert" ON public.magai_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own usage update" ON public.magai_usage FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.magai_consume(_cost integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _day date := (now() at time zone 'utc')::date;
  _used integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  INSERT INTO public.magai_usage (user_id, day, credits) VALUES (_uid, _day, 0)
  ON CONFLICT (user_id, day) DO NOTHING;
  SELECT credits INTO _used FROM public.magai_usage WHERE user_id = _uid AND day = _day;
  IF _used + _cost > 10 THEN RETURN -1; END IF;
  UPDATE public.magai_usage SET credits = credits + _cost, updated_at = now()
  WHERE user_id = _uid AND day = _day RETURNING credits INTO _used;
  RETURN _used;
END $$;

CREATE OR REPLACE FUNCTION public.magai_used_today()
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT credits FROM public.magai_usage
    WHERE user_id = auth.uid() AND day = (now() at time zone 'utc')::date), 0);
$$;