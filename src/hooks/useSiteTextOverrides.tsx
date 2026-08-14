import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Override { from_text: string; to_text: string; match_mode: string; enabled: boolean }

const STYLE_ID = "magma-custom-css";

/**
 * Applies admin-defined global text replacements and custom CSS to the whole
 * site. Text nodes are rewritten in place (and re-applied on DOM mutations),
 * so MAGAI can change literally any visible string without a redeploy.
 */
export const useSiteTextOverrides = () => {
  useEffect(() => {
    let overrides: Override[] = [];
    let observer: MutationObserver | null = null;
    let raf = 0;

    const replaceIn = (text: string) => {
      let out = text;
      for (const o of overrides) {
        if (!o.enabled || !o.from_text) continue;
        if (o.match_mode === "contains") {
          if (out.includes(o.from_text)) out = out.split(o.from_text).join(o.to_text);
        } else if (out.trim() === o.from_text) {
          out = out.replace(o.from_text, o.to_text);
        }
      }
      return out;
    };

    const walk = (root: Node) => {
      if (!overrides.length) return;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => {
          const parent = (n as Text).parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName;
          if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA") return NodeFilter.FILTER_REJECT;
          return (n.nodeValue ?? "").trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        },
      });
      const nodes: Text[] = [];
      while (walker.nextNode()) nodes.push(walker.currentNode as Text);
      for (const n of nodes) {
        const next = replaceIn(n.nodeValue ?? "");
        if (next !== n.nodeValue) n.nodeValue = next;
      }
      // placeholders / titles / aria-labels
      if (root instanceof Element || root === document.body) {
        const el = (root instanceof Element ? root : document.body);
        el.querySelectorAll<HTMLElement>("[placeholder],[title],[aria-label]").forEach((node) => {
          (["placeholder", "title", "aria-label"] as const).forEach((attr) => {
            const v = node.getAttribute(attr);
            if (!v) return;
            const next = replaceIn(v);
            if (next !== v) node.setAttribute(attr, next);
          });
        });
      }
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => walk(document.body));
    };

    const start = () => {
      if (observer || !overrides.length) { schedule(); return; }
      schedule();
      observer = new MutationObserver(schedule);
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    };

    const applyCss = (css: string) => {
      let tag = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
      if (!css) { tag?.remove(); return; }
      if (!tag) {
        tag = document.createElement("style");
        tag.id = STYLE_ID;
        document.head.appendChild(tag);
      }
      tag.textContent = css;
    };

    const loadOverrides = async () => {
      const { data } = await supabase.from("text_overrides").select("from_text, to_text, match_mode, enabled").eq("enabled", true);
      overrides = (data ?? []) as Override[];
      start();
    };

    const loadCss = async () => {
      const { data } = await supabase.from("ui_settings").select("value").eq("key", "site.custom_css").maybeSingle();
      applyCss((data as any)?.value ?? "");
    };

    loadOverrides();
    loadCss();

    const channel = supabase
      .channel("site-overrides")
      .on("postgres_changes", { event: "*", schema: "public", table: "text_overrides" }, loadOverrides)
      .on("postgres_changes", { event: "*", schema: "public", table: "ui_settings" }, loadCss)
      .subscribe();

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      supabase.removeChannel(channel);
    };
  }, []);
};
