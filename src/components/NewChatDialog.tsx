import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, MessageSquarePlus, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Badges from "./Badges";

interface Profile {
  user_id: string;
  username: string;
  display_name: string;
  avatar_initials: string;
  is_verified: boolean;
  is_official: boolean;
  is_banned: boolean;
  allow_dms?: boolean;
}

interface Props {
  onClose: () => void;
  onCreated: (conversationId: string) => void;
  myUserId: string;
  profiles: Profile[];
  existingConversations: { user_a: string; user_b: string; id: string }[];
}

const NewChatDialog = ({ onClose, onCreated, myUserId, profiles, existingConversations }: Props) => {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const candidates = useMemo(
    () =>
      profiles
        .filter((p) => p.user_id !== myUserId && !p.is_official && !p.is_banned)
        .filter(
          (p) =>
            p.display_name.toLowerCase().includes(q.toLowerCase()) ||
            p.username.toLowerCase().includes(q.toLowerCase()),
        ),
    [profiles, myUserId, q],
  );

  const startChat = async (target: Profile) => {
    if (target.allow_dms === false) {
      toast.error(`${target.display_name} no permite mensajes nuevos 🔒`);
      return;
    }
    setBusy(target.user_id);
    try {
      const [a, b] = myUserId < target.user_id ? [myUserId, target.user_id] : [target.user_id, myUserId];
      const existing = existingConversations.find((c) => c.user_a === a && c.user_b === b);
      if (existing) {
        onCreated(existing.id);
        return;
      }
      const { data, error } = await supabase
        .from("conversations")
        .insert({ user_a: a, user_b: b })
        .select("id")
        .single();
      if (error) throw error;
      toast.success(`💬 Chat iniciado con ${target.display_name}`);
      onCreated(data.id);
    } catch (e: any) {
      toast.error(e.message ?? "No se pudo iniciar el chat");
    } finally {
      setBusy(null);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 20, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md max-h-[80vh] bg-card rounded-2xl border border-primary/30 shadow-[0_0_60px_hsl(24_100%_50%/0.25)] overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-r from-primary/10 to-amber-500/10">
            <div className="flex items-center gap-2">
              <MessageSquarePlus size={20} className="text-primary" />
              <h2 className="text-base font-bold magma-gradient-text">Nuevo Chat</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <X size={18} />
            </button>
          </div>

          <div className="p-3 border-b border-border">
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted">
              <Search size={16} className="text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar usuarios..."
                className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground flex-1 outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-magma">
            {candidates.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No hay usuarios.</p>
            ) : (
              candidates.map((p) => {
                const blocked = p.allow_dms === false;
                return (
                  <motion.button
                    key={p.user_id}
                    whileHover={{ x: 2 }}
                    disabled={busy === p.user_id || blocked}
                    onClick={() => startChat(p)}
                    className={`w-full flex items-center gap-3 p-3 hover:bg-muted/60 transition-colors text-left disabled:opacity-50`}
                  >
                    <div className="w-10 h-10 rounded-full magma-gradient flex items-center justify-center text-primary-foreground font-bold text-sm">
                      {p.avatar_initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground flex items-center">
                        <span className="truncate">{p.display_name}</span>
                        <Badges isVerified={p.is_verified} size={12} />
                      </p>
                      <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
                    </div>
                    {blocked && <Lock size={14} className="text-muted-foreground" />}
                  </motion.button>
                );
              })
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default NewChatDialog;
