import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SiteEffect { key: string; enabled: boolean; config: any; expires_at: string | null }

export const useSiteEffects = () => {
  const [effects, setEffects] = useState<Record<string, SiteEffect>>({});

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("site_effects").select("*");
      const map: Record<string, SiteEffect> = {};
      (data as SiteEffect[] ?? []).forEach(e => { map[e.key] = e; });
      setEffects(map);
    };
    load();
    const ch = supabase.channel("site-effects-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_effects" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const isOn = (key: string) => {
    const e = effects[key];
    if (!e?.enabled) return false;
    if (e.expires_at && new Date(e.expires_at) < new Date()) return false;
    return true;
  };

  return { effects, isOn };
};