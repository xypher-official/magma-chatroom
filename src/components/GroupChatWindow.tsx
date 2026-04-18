import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ArrowLeft, Users, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Badges from "./Badges";

interface GroupMsg { id: string; group_id: string; sender_id: string; content: string; is_system: boolean; created_at: string }
interface GroupInfo { id: string; name: string; description: string; avatar_initials: string; owner_id: string }
interface Profile { user_id: string; display_name: string; is_verified: boolean; is_official: boolean }

interface Props {
  group: GroupInfo;
  myUserId: string;
  isAdmin: boolean;
  profiles: Record<string, Profile>;
  onBack?: () => void;
  onDeleted?: () => void;
}

const fmt = (iso: string) => new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });

const GroupChatWindow = ({ group, myUserId, isAdmin, profiles, onBack, onDeleted }: Props) => {
  const [messages, setMessages] = useState<GroupMsg[]>([]);
  const [input, setInput] = useState("");
  const [memberCount, setMemberCount] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("group_messages").select("*").eq("group_id", group.id).order("created_at", { ascending: true })
      .then(({ data }) => data && setMessages(data as GroupMsg[]));
    supabase.from("group_members").select("id", { count: "exact", head: true }).eq("group_id", group.id)
      .then(({ count }) => setMemberCount(count ?? 0));
    const ch = supabase.channel(`group-${group.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${group.id}` },
        (p) => setMessages((prev) => prev.some((m) => m.id === (p.new as any).id) ? prev : [...prev, p.new as GroupMsg]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [group.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim()) return;
    const { error } = await supabase.from("group_messages").insert({
      group_id: group.id, sender_id: myUserId, content: input.trim(),
    });
    if (error) toast.error(error.message); else {
      await supabase.from("groups").update({ last_message_at: new Date().toISOString() }).eq("id", group.id);
      setInput("");
    }
  };

  const deleteGroup = async () => {
    if (!confirm(`¿Eliminar el grupo "${group.name}"?`)) return;
    const { error } = await supabase.from("groups").delete().eq("id", group.id);
    if (error) toast.error(error.message); else { toast.success("🗑️ Grupo eliminado"); onDeleted?.(); }
  };

  const canDelete = isAdmin || group.owner_id === myUserId;

  return (
    <div className="h-full flex flex-col bg-background">
      <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="px-4 py-3 flex items-center gap-3 border-b border-border glass-panel">
        {onBack && (
          <button onClick={onBack} className="p-1 rounded-lg hover:bg-muted text-muted-foreground md:hidden"><ArrowLeft size={20} /></button>
        )}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-700 flex items-center justify-center text-white font-bold text-sm">
          {group.avatar_initials}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-foreground truncate">{group.name}</h3>
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Users size={11} /> {memberCount} miembros</p>
        </div>
        {canDelete && (
          <button onClick={deleteGroup} className="p-2 rounded-lg hover:bg-destructive/15 text-muted-foreground hover:text-destructive">
            <Trash2 size={18} />
          </button>
        )}
      </motion.div>

      <div className="flex-1 overflow-y-auto scrollbar-magma p-4 space-y-3 ember-bg">
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isOwn = msg.sender_id === myUserId;
            const sender = profiles[msg.sender_id];
            return (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${isOwn ? "magma-gradient text-primary-foreground rounded-br-md magma-glow-sm" : "glass-panel-strong text-foreground rounded-bl-md"}`}>
                  {!isOwn && (
                    <p className="text-xs font-semibold mb-1 text-fuchsia-400 flex items-center">
                      <span>{sender?.display_name ?? "Usuario"}</span>
                      <Badges isVerified={sender?.is_verified} isOfficial={sender?.is_official} size={11} />
                    </p>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className={`text-[10px] mt-1 text-right ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`}>{fmt(msg.created_at)}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t border-border glass-panel flex items-center gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Escribe al grupo…"
          className="flex-1 px-4 py-2.5 rounded-xl bg-muted text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/30" />
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={send} disabled={!input.trim()}
          className="p-2.5 rounded-xl magma-gradient text-primary-foreground disabled:opacity-40 magma-glow-sm">
          <Send size={18} />
        </motion.button>
      </div>
    </div>
  );
};

export default GroupChatWindow;
