import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/** While the app is open, delivers any scheduled messages that are due (checks every 30s). */
const ScheduledMessagesPump = () => {
  useEffect(() => {
    const tick = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) await supabase.rpc("process_scheduled_messages");
    };
    tick();
    const iv = setInterval(tick, 30_000);
    return () => clearInterval(iv);
  }, []);
  return null;
};

export default ScheduledMessagesPump;
