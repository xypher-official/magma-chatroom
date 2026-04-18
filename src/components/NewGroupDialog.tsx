import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Profile { user_id: string; display_name: string; username: string; avatar_initials: string; is_official: boolean }

interface Props {
  onClose: () => void;
  onCreated: (groupId: string) => void;
  myUserId: string;
  profiles: Profile[];
}

const NewGroupDialog = ({ onClose, onCreated, myUserId, profiles }: Props) => {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  const candidates = profiles.filter((p) => !p.is_official && p.user_id !== myUserId
    && (p.display_name.toLowerCase().includes(q.toLowerCase()) || p.username.toLowerCase().includes(q.toLowerCase())));

  const toggle = (uid: string) => {
    const s = new Set(selected);
    s.has(uid) ? s.delete(uid) : s.add(uid);
    setSelected(s);
  };

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    const initials = name.trim().substring(0, 2).toUpperCase();
    const { data: g, error } = await supabase.from("groups")
      .insert({ name: name.trim(), description: desc.trim(), avatar_initials: initials, owner_id: myUserId })
      .select("id").single();
    if (error || !g) { toast.error(error?.message ?? "Error"); setCreating(false); return; }
    const members = [{ group_id: g.id, user_id: myUserId }, ...Array.from(selected).map((u) => ({ group_id: g.id, user_id: u }))];
    await supabase.from("group_members").insert(members);
    toast.success(`👥 Grupo "${name.trim()}" creado con ${members.length} miembros`);
    setCreating(false);
    onCreated(g.id);
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
        <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }} onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg max-h-[85vh] bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <h3 className="font-bold text-foreground flex items-center gap-2"><Users size={18} className="text-primary" /> Nuevo grupo</h3>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><X size={18} /></button>
          </div>
          <div className="p-5 space-y-3 overflow-y-auto flex-1">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del grupo"
              className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm outline-none" />
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descripción (opcional)" rows={2}
              className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm outline-none resize-none" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar miembros…"
              className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm outline-none" />
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {candidates.map((p) => (
                <button key={p.user_id} onClick={() => toggle(p.user_id)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg border transition-all ${selected.has(p.user_id) ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted"}`}>
                  <div className="w-9 h-9 rounded-full magma-gradient flex items-center justify-center text-primary-foreground text-xs font-bold">{p.avatar_initials}</div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.display_name}</p>
                    <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
                  </div>
                  {selected.has(p.user_id) && <Check size={16} className="text-primary" />}
                </button>
              ))}
              {candidates.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">No hay usuarios.</p>}
            </div>
          </div>
          <div className="p-4 border-t border-border">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={create} disabled={creating || !name.trim()}
              className="w-full py-2.5 rounded-lg magma-gradient text-primary-foreground font-semibold disabled:opacity-50">
              Crear grupo ({selected.size + 1} miembros)
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default NewGroupDialog;
