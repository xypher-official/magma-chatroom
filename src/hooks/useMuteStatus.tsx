import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useMuteStatus = (userId: string | null) => {
  const [mutedUntil, setMutedUntil] = useState<Date | null>(null);

  useEffect(() => {
    if (!userId) { setMutedUntil(null); return; }
    const load = async () => {
      const { data } = await supabase.from("user_mutes").select("muted_until").eq("user_id", userId).maybeSingle();
      if (data?.muted_until) {
        const d = new Date(data.muted_until);
        setMutedUntil(d > new Date() ? d : null);
      } else setMutedUntil(null);
    };
    load();
    const ch = supabase.channel(`mute-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_mutes", filter: `user_id=eq.${userId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]);

  return { mutedUntil, isMuted: !!mutedUntil && mutedUntil > new Date() };
};