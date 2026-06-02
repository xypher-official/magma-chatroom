import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type KbTheme = "magma" | "ice" | "neon" | "minimal";

export const useKeyboardPref = (myUserId?: string) => {
  const [enabled, setEnabled] = useState(false);
  const [theme, setTheme] = useState<KbTheme>("magma");

  useEffect(() => {
    if (!myUserId) return;
    (async () => {
      const { data } = await supabase.from("profiles")
        .select("keyboard_enabled, keyboard_theme").eq("user_id", myUserId).maybeSingle();
      if (data) {
        setEnabled(!!data.keyboard_enabled);
        setTheme(((data.keyboard_theme as KbTheme) ?? "magma"));
      }
    })();
  }, [myUserId]);

  const update = async (next: { enabled?: boolean; theme?: KbTheme }) => {
    if (next.enabled !== undefined) setEnabled(next.enabled);
    if (next.theme) setTheme(next.theme);
    if (!myUserId) return;
    await supabase.from("profiles").update({
      ...(next.enabled !== undefined ? { keyboard_enabled: next.enabled } : {}),
      ...(next.theme ? { keyboard_theme: next.theme } : {}),
    }).eq("user_id", myUserId);
  };

  return { enabled, theme, update };
};