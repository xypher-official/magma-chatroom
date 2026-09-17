-- Track individual usage events for burst detection
CREATE TABLE IF NOT EXISTS public.magai_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cost integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.magai_events TO authenticated;
GRANT ALL ON public.magai_events TO service_role;

ALTER TABLE public.magai_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "own magai events select" ON public.magai_events
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "own magai events insert" ON public.magai_events
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS magai_events_user_time_idx ON public.magai_events (user_id, created_at DESC);

-- Cooldown state
ALTER TABLE public.magai_usage ADD COLUMN IF NOT EXISTS blocked_until timestamptz;

-- Unlimited credits, but 24h cooldown on intensive bursts
CREATE OR REPLACE FUNCTION public.magai_consume(_cost integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _blocked timestamptz;
  _recent integer;
  _heavy integer;
  _total integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT max(blocked_until) INTO _blocked FROM public.magai_usage WHERE user_id = _uid;
  IF _blocked IS NOT NULL AND _blocked > now() THEN
    RETURN -1;
  END IF;

  -- burst detection: last 60 minutes
  SELECT COALESCE(sum(cost), 0), COALESCE(count(*) FILTER (WHERE cost >= 3), 0)
    INTO _recent, _heavy
  FROM public.magai_events
  WHERE user_id = _uid AND created_at > now() - interval '60 minutes';

  IF (_recent + _cost) > 120 OR (_heavy + (CASE WHEN _cost >= 3 THEN 1 ELSE 0 END)) > 30 THEN
    INSERT INTO public.magai_usage (user_id, day, credits, blocked_until)
    VALUES (_uid, (now() AT TIME ZONE 'utc')::date, 0, now() + interval '24 hours')
    ON CONFLICT (user_id, day) DO UPDATE
      SET blocked_until = now() + interval '24 hours', updated_at = now();
    RETURN -1;
  END IF;

  INSERT INTO public.magai_events (user_id, cost) VALUES (_uid, _cost);

  INSERT INTO public.magai_usage (user_id, day, credits)
  VALUES (_uid, (now() AT TIME ZONE 'utc')::date, _cost)
  ON CONFLICT (user_id, day) DO UPDATE
    SET credits = public.magai_usage.credits + _cost, updated_at = now()
  RETURNING credits INTO _total;

  RETURN _total;
END;
$$;

-- Cooldown expiry (null when not blocked)
CREATE OR REPLACE FUNCTION public.magai_blocked_until()
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT max(blocked_until) FROM public.magai_usage
  WHERE user_id = auth.uid() AND blocked_until > now()
$$;