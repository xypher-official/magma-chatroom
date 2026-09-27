import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Current user's chat wallpaper (CSS background value), live-updated. */
export function useMyWallpaper() {
  const [bg, setBg] = useState<string | null>(null);
  useEffect(() => {
    let ch: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id;
      if (!uid) return;
      const { data: p } = await supabase.from("profiles").select("wallpaper_url").eq("user_id", uid).maybeSingle();
      setBg(p?.wallpaper_url ?? null);
      ch = supabase
        .channel(`wall-${uid}-${Math.random()}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${uid}` },
          (payload: any) => setBg(payload.new?.wallpaper_url ?? null))
        .subscribe();
    });
    return () => { if (ch) supabase.removeChannel(ch); };
  }, []);
  return bg ? { background: bg } : undefined;
}
