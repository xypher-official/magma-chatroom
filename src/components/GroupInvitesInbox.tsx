import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Check, X as XIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface InviteRow { id: string; group_id: string; inviter_id: string; status: string }
interface Props { myUserId: string; onJoined?: (groupId: string) => void }

/** Floating bell that lists pending group invites and allows accept/decline. */
const GroupInvitesInbox = ({ myUserId, onJoined }: Props) => {
  const [invites, setInvites] = useState<(InviteRow & { group?: any; inviter?: any })[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("group_invites").select("*")
      .eq("invitee_id", myUserId).eq("status", "pending");
    const rows = (data as InviteRow[] ?? []);
    if (!rows.length) { setInvites([]); return; }
    const gids = [...new Set(rows.map(r => r.group_id))];
    const uids = [...new Set(rows.map(r => r.inviter_id))];
    const [{ data: g }, { data: u }] = await Promise.all([
      supabase.from("groups").select("id,name,avatar_initials,avatar_url").in("id", gids),
      supabase.from("profiles").select("user_id,display_name,avatar_initials").in("user_id", uids),
    ]);
    const gm: any = {}; (g ?? []).forEach((x: any) => gm[x.id] = x);
    const um: any = {}; (u ?? []).forEach((x: any) => um[x.user_id] = x);
    setInvites(rows.map(r => ({ ...r, group: gm[r.group_id], inviter: um[r.inviter_id] })));
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("invites-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "group_invites", filter: `invitee_id=eq.${myUserId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [myUserId]);

  const accept = async (inv: InviteRow) => {
    const { error: e1 } = await supabase.from("group_members").insert({ group_id: inv.group_id, user_id: myUserId });
    if (e1 && !e1.message.includes("duplicate")) { toast.error(e1.message); return; }
    await supabase.from("group_invites").update({ status: "accepted" }).eq("id", inv.id);
    toast.success("✅ Te uniste al grupo");
    onJoined?.(inv.group_id);
    load();
  };
  const decline = async (inv: InviteRow) => {
    await supabase.from("group_invites").update({ status: "declined" }).eq("id", inv.id);
    load();
  };

  if (invites.length === 0) return null;

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 p-3 rounded-full magma-gradient text-primary-foreground shadow-2xl magma-glow"
      >
        <Mail size={18} />
        <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {invites.length}
        </span>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ y: 30, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 30, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-card rounded-2xl border border-border overflow-hidden shadow-2xl">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                <Mail size={16} className="text-primary" />
                <h3 className="font-bold text-foreground">Invitaciones a grupos</h3>
              </div>
              <div className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
                {invites.map(inv => (
                  <motion.div key={inv.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border">
                    <div className="w-11 h-11 rounded-xl magma-gradient flex items-center justify-center text-primary-foreground font-bold overflow-hidden">
                      {inv.group?.avatar_url ? <img src={inv.group.avatar_url} alt="" className="w-full h-full object-cover" /> : (inv.group?.avatar_initials ?? "??")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{inv.group?.name ?? "Grupo"}</p>
                      <p className="text-xs text-muted-foreground truncate">de {inv.inviter?.display_name ?? "alguien"}</p>
                    </div>
                    <button onClick={() => accept(inv)} title="Aceptar"
                      className="p-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-500"><Check size={16} /></button>
                    <button onClick={() => decline(inv)} title="Rechazar"
                      className="p-2 rounded-lg bg-destructive/15 hover:bg-destructive/30 text-destructive"><XIcon size={16} /></button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default GroupInvitesInbox;