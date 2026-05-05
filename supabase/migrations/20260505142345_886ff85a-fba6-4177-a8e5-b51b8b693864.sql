
DROP POLICY IF EXISTS "host or invitee or admin read sched" ON public.scheduled_calls;
CREATE POLICY "auth read sched"
ON public.scheduled_calls FOR SELECT
TO authenticated
USING (true);
