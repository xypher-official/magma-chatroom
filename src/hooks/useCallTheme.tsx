import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CallTheme {
  primary_color: string;
  accent_color: string;
  background_style: string;
  button_position: string;
  show_timer: boolean;
  show_participants: boolean;
  hangup_label: string;
  mute_label: string;
  camera_label: string;
  custom_css: string;
}

const DEFAULTS: CallTheme = {
  primary_color: "#f97316",
  accent_color: "#d946ef",
  background_style: "magma",
  button_position: "bottom",
  show_timer: true,
  show_participants: true,
  hangup_label: "End",
  mute_label: "Mute",
  camera_label: "Camera",
  custom_css: "",
};

export const useCallTheme = () => {
  const [theme, setTheme] = useState<CallTheme>(DEFAULTS);

  useEffect(() => {
    const load = () =>
      supabase.from("call_theme").select("*").eq("id", 1).maybeSingle()
        .then(({ data }) => data && setTheme({ ...DEFAULTS, ...(data as any) }));
    load();
    const ch = supabase.channel("call-theme-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "call_theme" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return theme;
};