
CREATE TABLE public.group_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_channels TO authenticated;
GRANT ALL ON public.group_channels TO service_role;
ALTER TABLE public.group_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read channels" ON public.group_channels FOR SELECT
  USING (public.is_group_member(group_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "mods create channels" ON public.group_channels FOR INSERT
  WITH CHECK (public.is_group_mod_or_owner(group_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "mods update channels" ON public.group_channels FOR UPDATE
  USING (public.is_group_mod_or_owner(group_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "mods delete channels" ON public.group_channels FOR DELETE
  USING (public.is_group_mod_or_owner(group_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- Backfill: one #general channel per existing group
INSERT INTO public.group_channels (group_id, name, position)
SELECT g.id, 'general', 0 FROM public.groups g
ON CONFLICT DO NOTHING;

-- Add channel_id to messages
ALTER TABLE public.group_messages ADD COLUMN channel_id uuid;
UPDATE public.group_messages m
SET channel_id = c.id
FROM public.group_channels c
WHERE c.group_id = m.group_id AND c.name = 'general' AND m.channel_id IS NULL;

-- Auto-create #general when a group is created
CREATE OR REPLACE FUNCTION public.create_default_channel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.group_channels (group_id, name, position)
  VALUES (NEW.id, 'general', 0)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_group_default_channel ON public.groups;
CREATE TRIGGER trg_group_default_channel AFTER INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.create_default_channel();

ALTER PUBLICATION supabase_realtime ADD TABLE public.group_channels;
