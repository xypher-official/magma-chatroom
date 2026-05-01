import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { detectBrowserLang, translate, type Lang } from "@/i18n/translations";

const STORAGE_KEY = "magma.lang";

const I18nCtx = createContext<{
  lang: Lang;
  setLang: (l: Lang) => Promise<void>;
  t: (key: string, fallback?: string) => string;
}>({
  lang: "en",
  setLang: async () => {},
  t: (k, f) => f ?? k,
});

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = (typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null) as Lang | null;
    return stored ?? detectBrowserLang();
  });

  // Try to load language from profile if logged in
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid || !mounted) return;
      supabase.from("profiles").select("language").eq("user_id", uid).maybeSingle().then(({ data: p }) => {
        if (!mounted) return;
        const l = (p as any)?.language as Lang | undefined;
        if (l && ["es", "en", "de", "it", "fr", "pt"].includes(l)) {
          setLangState(l);
          localStorage.setItem(STORAGE_KEY, l);
        }
      });
    });
    return () => { mounted = false; };
  }, []);

  const setLang = useCallback(async (l: Lang) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
    const { data } = await supabase.auth.getUser();
    if (data.user?.id) {
      await supabase.from("profiles").update({ language: l }).eq("user_id", data.user.id);
    }
  }, []);

  const t = useCallback((key: string, fallback?: string) => translate(lang, key, fallback), [lang]);

  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>;
};

export const useI18n = () => useContext(I18nCtx);