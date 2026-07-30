ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

DROP POLICY IF EXISTS "Senders and admins update messages" ON public.messages;
CREATE POLICY "Senders and admins update messages" ON public.messages
FOR UPDATE TO authenticated
USING (auth.uid() = sender_id OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = sender_id OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Senders delete own messages" ON public.messages;
CREATE POLICY "Senders delete own messages" ON public.messages
FOR DELETE TO authenticated
USING (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Senders mods and admins update group messages" ON public.group_messages;
CREATE POLICY "Senders mods and admins update group messages" ON public.group_messages
FOR UPDATE TO authenticated
USING (auth.uid() = sender_id OR has_role(auth.uid(), 'admin'::app_role) OR is_group_mod_or_owner(group_id, auth.uid()))
WITH CHECK (auth.uid() = sender_id OR has_role(auth.uid(), 'admin'::app_role) OR is_group_mod_or_owner(group_id, auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
GRANT ALL ON public.group_messages TO service_role;