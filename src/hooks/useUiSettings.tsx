import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type Settings = Record<string, string>;

const DEFAULTS: Settings = {
  "app.name": "Magma Chat Room",
  "tab.chats": "Chats",
  "tab.groups": "Grupos",
  "placeholder.message": "Escribe un mensaje...",
  "placeholder.search": "Buscar...",
  "theme.primary": "24 100% 50%",
  "theme.accent": "12 90% 55%",
};

const Ctx = createContext<{ settings: Settings; t: (k: string, fallback?: string) => string }>({
  settings: DEFAULTS,
  t: (k, f) => f ?? DEFAULTS[k] ?? k,
});

export const UiSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  const apply = (s: Settings) => {
    if (s["theme.primary"]) {
      document.documentElement.style.setProperty("--primary", s["theme.primary"]);
      document.documentElement.style.setProperty("--ring", s["theme.primary"]);
      document.documentElement.style.setProperty("--sidebar-primary", s["theme.primary"]);
    }
    if (s["theme.accent"]) {
      document.documentElement.style.setProperty("--accent", s["theme.accent"]);
    }
    if (s["app.name"]) document.title = s["app.name"];
  };

  useEffect(() => {
    let mounted = true;
    supabase.from("ui_settings").select("key,value").then(({ data }) => {
      if (!mounted || !data) return;
      const next = { ...DEFAULTS };
      for (const r of data as { key: string; value: string }[]) next[r.key] = r.value;
      setSettings(next);
      apply(next);
    });
    const ch = supabase.channel("ui-settings-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "ui_settings" }, (payload) => {
        const row = (payload.new ?? payload.old) as { key: string; value?: string };
        setSettings((prev) => {
          const next = { ...prev };
          if (payload.eventType === "DELETE") delete next[row.key];
          else if (row.value !== undefined) next[row.key] = row.value;
          apply(next);
          return next;
        });
      }).subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  const t = (k: string, fallback?: string) => settings[k] ?? fallback ?? DEFAULTS[k] ?? k;
  return <Ctx.Provider value={{ settings, t }}>{children}</Ctx.Provider>;
};

export const useUiSettings = () => useContext(Ctx);
