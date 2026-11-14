import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Star, Crown, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  user_id: string; username: string; display_name: string;
  avatar_initials: string; avatar_url?: string | null;
  is_verified: boolean; is_official: boolean; is_banned: boolean;
  created_at?: string; last_seen?: string;
}

type Filter = "important" | "az" | "za" | "recent" | "old";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (userId: string, name: string) => void;
  myUserId: string;
}

const UserPickerDialog = ({ open, onClose, onPick, myUserId }: Props) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [important, setImportant] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("important");

  useEffect(() => {
    if (!open) return;
    supabase.from("profiles").select("id, user_id, username, display_name, avatar_initials, is_verified, is_banned, is_official, last_seen, created_at, updated_at, allow_dms, terms_accepted_at, avatar_url, language, email_verified_at, keyboard_enabled, keyboard_theme, bio, wallpaper_url, bubble_color").eq("is_official", false)
      .then(({ data }) => setProfiles((data as any) ?? []));
    supabase.from("important_users").select("user_id, priority")
      .then(({ data }) => {
        const m: Record<string, number> = {};
        for (const r of data ?? []) m[(r as any).user_id] = (r as any).priority ?? 100;
        setImportant(m);
      });
  }, [open]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let arr = profiles.filter((p) => !term || p.display_name.toLowerCase().includes(term) || p.username.toLowerCase().includes(term));
    arr = [...arr];
    arr.sort((a, b) => {
      // "Yo primero": myUserId always first if matches filter
      if (a.user_id === myUserId) return -1;
      if (b.user_id === myUserId) return 1;
      const ia = important[a.user_id]; const ib = important[b.user_id];
      if (filter === "important") {
        if (ia !== undefined && ib === undefined) return -1;
        if (ib !== undefined && ia === undefined) return 1;
        if (ia !== undefined && ib !== undefined) return ia - ib;
        return a.display_name.localeCompare(b.display_name);
      }
      if (filter === "az") return a.display_name.localeCompare(b.display_name);
      if (filter === "za") return b.display_name.localeCompare(a.display_name);
      if (filter === "recent") return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      if (filter === "old") return (a.created_at ?? "").localeCompare(b.created_at ?? "");
      return 0;
    });
    return arr;
  }, [profiles, q, filter, important, myUserId]);

  const FILTERS: { key: Filter; label: string; Icon: typeof Star }[] = [
    { key: "important", label: "Importantes", Icon: Star },
    { key: "az", label: "A → Z", Icon: Filter },
    { key: "za", label: "Z → A", Icon: Filter },
    { key: "recent", label: "Recientes", Icon: Filter },
    { key: "old", label: "Viejos", Icon: Filter },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-background/85 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
          <motion.div initial={{ scale: 0.94, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 20 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[80vh] bg-card rounded-3xl border border-border overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-bold text-foreground">Elegir usuario</h3>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
            </div>
            <div className="px-5 pt-4 space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o @usuario…"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-input border border-border text-sm outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-magma">
                {FILTERS.map(({ key, label, Icon }) => (
                  <button key={key} onClick={() => setFilter(key)}
                    className={`shrink-0 flex items-center gap-1 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                      filter === key ? "magma-gradient text-primary-foreground magma-glow-sm" : "bg-muted hover:bg-muted/70 text-muted-foreground"
                    }`}>
                    <Icon size={11} /> {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-magma p-3 space-y-1">
              {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Sin resultados</p>}
              {filtered.map((p) => {
                const imp = important[p.user_id];
                const isMe = p.user_id === myUserId;
                return (
                  <motion.button key={p.user_id} layout whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    onClick={() => onPick(p.user_id, p.display_name)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-primary/10 transition-colors text-left">
                    <div className="w-10 h-10 rounded-full magma-gradient flex items-center justify-center text-primary-foreground font-bold text-sm overflow-hidden shrink-0">
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : p.avatar_initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate flex items-center gap-1">
                        {p.display_name}
                        {isMe && <Crown size={11} className="text-amber-400" />}
                        {imp !== undefined && imp < 100 && <Star size={11} className="text-amber-400 fill-amber-400" />}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UserPickerDialog;
