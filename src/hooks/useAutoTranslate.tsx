import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "./useI18n";

// In-memory + localStorage cache so we never re-translate the same string.
const memCache = new Map<string, string>();
const STORAGE = "magma.translateCache.v1";

const loadDisk = () => {
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, string>;
    Object.entries(obj).forEach(([k, v]) => memCache.set(k, v));
  } catch { /* noop */ }
};
loadDisk();
const persist = () => {
  try {
    const obj: Record<string, string> = {};
    // cap size
    const arr = Array.from(memCache.entries()).slice(-3000);
    arr.forEach(([k, v]) => { obj[k] = v; });
    localStorage.setItem(STORAGE, JSON.stringify(obj));
  } catch { /* noop */ }
};

// Batch queue so multiple components requesting translations get
// merged into a single edge-function call per ~80ms tick.
type PendingItem = { text: string; resolve: (s: string) => void };
const pending: Record<string, PendingItem[]> = {};
let flushTimer: any = null;

const scheduleFlush = () => {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    const langs = Object.keys(pending);
    for (const lang of langs) {
      const items = pending[lang]; delete pending[lang];
      if (!items?.length) continue;
      const uniq = Array.from(new Set(items.map(i => i.text)));
      try {
        const { data } = await supabase.functions.invoke("translate-text", {
          body: { texts: uniq, target: lang },
        });
        const translations: string[] = data?.translations ?? uniq;
        const map = new Map<string, string>();
        uniq.forEach((t, i) => map.set(t, translations[i] ?? t));
        items.forEach(i => {
          const out = map.get(i.text) ?? i.text;
          memCache.set(lang + "::" + i.text, out);
          i.resolve(out);
        });
        persist();
      } catch (e) {
        console.warn("translate failed", e);
        items.forEach(i => i.resolve(i.text));
      }
    }
  }, 80);
};

const requestTranslation = (text: string, lang: string) =>
  new Promise<string>((resolve) => {
    const key = lang + "::" + text;
    const cached = memCache.get(key);
    if (cached !== undefined) { resolve(cached); return; }
    (pending[lang] ||= []).push({ text, resolve });
    scheduleFlush();
  });

const looksLikeJustSymbols = (s: string) => !/[a-zA-Z\u00C0-\u024F]/.test(s);

/** Returns a translated version of `text` to the user's current language. */
export const useAutoTranslate = (text?: string | null) => {
  const { lang } = useI18n();
  const [out, setOut] = useState<string>(text ?? "");
  useEffect(() => {
    const t = (text ?? "").trim();
    if (!t || looksLikeJustSymbols(t)) { setOut(text ?? ""); return; }
    const key = lang + "::" + t;
    const cached = memCache.get(key);
    if (cached !== undefined) { setOut(cached); return; }
    setOut(text ?? "");
    let mounted = true;
    requestTranslation(t, lang).then((r) => { if (mounted) setOut(r); });
    return () => { mounted = false; };
  }, [text, lang]);
  return out;
};