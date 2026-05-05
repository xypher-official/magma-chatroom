import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ensurePermission = async () => {
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "default") {
    try { await Notification.requestPermission(); } catch { /* ignore */ }
  }
};

const notify = (title: string, body: string, icon?: string) => {
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try { new Notification(title, { body, icon, badge: icon }); } catch { /* ignore */ }
  }
};

export const useNotifications = (
  myUserId: string | undefined,
  isAdmin: boolean,
  activeConvId: string | null,
  profilesMap: Record<string, { display_name: string; is_official?: boolean; avatar_url?: string | null }>
) => {
  const seenRef = useRef<{ msgs: Set<string>; calls: Set<string>; users: Set<string> }>({
    msgs: new Set(), calls: new Set(), users: new Set(),
  });
  const bootRef = useRef(false);

  useEffect(() => { ensurePermission(); }, []);

  // Seed "seen" so we don't notify for things that already exist on first load
  useEffect(() => {
    if (!myUserId || bootRef.current) return;
    bootRef.current = true;
    (async () => {
      const { data: profs } = await supabase.from("profiles").select("user_id").limit(1000);
      profs?.forEach((p: any) => seenRef.current.users.add(p.user_id));
    })();
  }, [myUserId]);

  useEffect(() => {
    if (!myUserId) return;
    const ch = supabase.channel(`notif-${myUserId}`)
      // New messages — notify if not in active conv & not from me
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
        const m: any = payload.new;
        if (seenRef.current.msgs.has(m.id)) return;
        seenRef.current.msgs.add(m.id);
        if (m.sender_id === myUserId) return;
        if (m.conversation_id === activeConvId) return;
        // Confirm I'm in the conversation
        const { data: conv } = await supabase.from("conversations").select("user_a,user_b")
          .eq("id", m.conversation_id).maybeSingle();
        if (!conv) return;
        if (conv.user_a !== myUserId && conv.user_b !== myUserId) return;
        const sender = profilesMap[m.sender_id];
        const name = sender?.display_name ?? "Someone";
        const preview = (m.content ?? "").slice(0, 80) || "📎 Media";
        toast(`💬 ${name}`, { description: preview });
        notify(`💬 ${name}`, preview, sender?.avatar_url ?? undefined);
      })
      // Incoming calls
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "calls", filter: `callee_id=eq.${myUserId}` }, (payload) => {
        const c: any = payload.new;
        if (seenRef.current.calls.has(c.id)) return;
        seenRef.current.calls.add(c.id);
        const caller = profilesMap[c.caller_id];
        const name = caller?.display_name ?? "Someone";
        toast(`📞 Incoming ${c.call_type} call`, { description: `from ${name}` });
        notify(`📞 Incoming ${c.call_type} call`, `from ${name}`);
      })
      // New accounts (admin only)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, (payload) => {
        const p: any = payload.new;
        if (seenRef.current.users.has(p.user_id)) return;
        seenRef.current.users.add(p.user_id);
        if (!isAdmin) return;
        if (p.is_official) return;
        toast.success(`🌋 New user registered`, { description: `@${p.username} (${p.display_name})` });
        notify("🌋 New account", `@${p.username} just joined Magma Chat Room`);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [myUserId, isAdmin, activeConvId, profilesMap]);
};
