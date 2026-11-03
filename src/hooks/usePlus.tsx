import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

let cache: { subscribed: boolean; end: string | null } | null = null;

export const usePlus = () => {
  const [subscribed, setSubscribed] = useState(cache?.subscribed ?? false);
  const [end, setEnd] = useState<string | null>(cache?.end ?? null);
  const [loading, setLoading] = useState(!cache);

  const refresh = useCallback(async () => {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) { setSubscribed(false); setLoading(false); return; }
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: s.session.user.id, _role: "admin" });
    if (isAdmin) {
      cache = { subscribed: true, end: null };
      setSubscribed(true); setEnd(null); setLoading(false); return;
    }
    const { data } = await supabase.functions.invoke("check-subscription");
    cache = { subscribed: !!data?.subscribed, end: data?.subscription_end ?? null };
    setSubscribed(cache.subscribed); setEnd(cache.end); setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 60_000);
    // Auth callbacks run while the client's auth lock is held. Defer requests
    // that acquire that same lock, otherwise inference/sign-in can deadlock.
    const { data: sub } = supabase.auth.onAuthStateChange(() => { setTimeout(() => { void refresh(); }, 0); });
    return () => { clearInterval(iv); sub.subscription.unsubscribe(); };
  }, [refresh]);

  return { subscribed, end, loading, refresh };
};

export const startCheckout = async () => {
  const { data, error } = await supabase.functions.invoke("create-checkout");
  if (error || !data?.url) throw new Error(data?.error ?? error?.message ?? "No se pudo abrir el pago");
  window.location.href = data.url;
};

export const openPortal = async () => {
  const { data, error } = await supabase.functions.invoke("customer-portal");
  if (error || !data?.url) throw new Error(data?.error ?? error?.message ?? "No se pudo abrir");
  window.location.href = data.url;
};
