import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UserPlus, Search, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Profile { user_id: string; display_name: string; username: string; avatar_initials: string; avatar_url?: string | null; is_official: boolean }

interface Props {
  open: boolean;
  groupId: string;
  groupName: string;
  myUserId: string;
  profiles: Profile[];
  conversations: { user_a: string; user_b: string }[];
  onClose: () => void;
}

/**
 * Invite contacts (users with whom you have a 1:1 conversation) to a group.
 * Creates rows in group_invites; the invitee will see and accept them.
 */
const InviteToGroupDialog = ({ open, groupId, groupName, myUserId, profiles, conversations, onClose }: Props) => {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPicked(new Set()); setQ("");
    Promise.all([
      supabase.from("group_members").select("user_id").eq("group_id", groupId),
      supabase.from("group_invites").select("invitee_id").eq("group_id", groupId).eq("status", "pending"),
    ]).then(([m, i]) => {
      const s = new Set<string>();
      (m.data ?? []).forEach((r: any) => s.add(r.user_id));
      (i.data ?? []).forEach((r: any) => s.add(r.invitee_id));
      setExisting(s);
    });
  }, [open, groupId]);

  const contacts = useMemo(() => {
    const ids = new Set<string>();
    conversations.forEach(c => {
      if (c.user_a === myUserId) ids.add(c.user_b);
      else if (c.user_b === myUserId) ids.add(c.user_a);
    });
    return profiles.filter(p => ids.has(p.user_id) && !p.is_official
      && (p.display_name.toLowerCase().includes(q.toLowerCase()) || p.username.toLowerCase().includes(q.toLowerCase())));
  }, [conversations, profiles, myUserId, q]);

  const toggle = (uid: string) => {
    if (existing.has(uid)) return;
    const s = new Set(picked); s.has(uid) ? s.delete(uid) : s.add(uid); setPicked(s);
  };

  const send = async () => {
    if (picked.size === 0) return;
    setSending(true);
    const rows = Array.from(picked).map(invitee_id => ({ group_id: groupId, inviter_id: myUserId, invitee_id }));
    const { error } = await supabase.from("group_invites").insert(rows);
    setSending(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`📨 ${picked.size} invitación${picked.size > 1 ? "es" : ""} enviada${picked.size > 1 ? "s" : ""}`);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg max-h-[85vh] bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-gradient-to-r from-primary/10 to-fuchsia-500/10">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <UserPlus size={18} className="text-primary" /> Invitar a {groupName}
              </h3>
              <button onClick={onClose} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><X size={18} /></button>
            </div>
            <div className="p-4 border-b border-border">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar entre tus contactos…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/40" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {contacts.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">
                  No tienes contactos disponibles. Inicia una conversación 1:1 primero.
                </p>
              )}
              {contacts.map(p => {
                const already = existing.has(p.user_id);
                const sel = picked.has(p.user_id);
                return (
                  <button key={p.user_id} disabled={already}
                    onClick={() => toggle(p.user_id)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                      already ? "border-transparent opacity-50 cursor-not-allowed" :
                      sel ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted"
                    }`}>
                    <div className="w-9 h-9 rounded-full magma-gradient flex items-center justify-center text-primary-foreground text-xs font-bold overflow-hidden">
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : p.avatar_initials}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.display_name}</p>
                      <p className="text-xs text-muted-foreground truncate">@{p.username}{already && " · ya en grupo / invitado"}</p>
                    </div>
                    {sel && <Check size={16} className="text-primary" />}
                  </button>
                );
              })}
            </div>
            <div className="p-4 border-t border-border">
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                onClick={send} disabled={sending || picked.size === 0}
                className="w-full py-2.5 rounded-lg magma-gradient text-primary-foreground font-semibold disabled:opacity-50">
                Enviar {picked.size} invitación{picked.size === 1 ? "" : "es"}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InviteToGroupDialog;