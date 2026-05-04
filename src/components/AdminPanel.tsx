import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Send, Megaphone, Users, BarChart3, ShieldCheck, Ban, Trash2, Crown, MessageSquare, Sparkles, FileText, Radio, Palette,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Badges from "./Badges";
import AdminAIConsole from "./AdminAIConsole";
import CmsTab from "./CmsTab";
import EventsTab from "./EventsTab";
import UiTab from "./UiTab";
import UserPickerDialog from "./UserPickerDialog";
import { Search } from "lucide-react";

interface Profile {
  user_id: string;
  username: string;
  display_name: string;
  avatar_initials: string;
  is_verified: boolean;
  is_banned: boolean;
  is_official: boolean;
}

interface AdminPanelProps {
  onClose: () => void;
  profiles: Profile[];
}

type Tab = "ai" | "broadcast" | "users" | "stats" | "cms" | "events" | "ui";

const AdminPanel = ({ onClose, profiles }: AdminPanelProps) => {
  const [tab, setTab] = useState<Tab>("ai");
  const [broadcast, setBroadcast] = useState("");
  const [dmTarget, setDmTarget] = useState<string>("");
  const [dmTargetName, setDmTargetName] = useState<string>("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dmText, setDmText] = useState("");
  const [sending, setSending] = useState(false);
  const [stats, setStats] = useState<{ users?: number; msgs?: number; convs?: number; bcasts?: number }>({});
  const [refreshKey, setRefreshKey] = useState(0);

  const realUsers = profiles.filter((p) => !p.is_official);

  useEffect(() => {
    if (tab !== "stats") return;
    supabase.functions
      .invoke("admin-actions", { body: { action: "stats" } })
      .then(({ data }) => data && setStats(data));
  }, [tab, refreshKey]);

  const callAction = async (body: any) => {
    const { data, error } = await supabase.functions.invoke("admin-actions", { body });
    if (error || data?.error) {
      toast.error(error?.message ?? data?.error ?? "Error");
      return null;
    }
    return data;
  };

  const handleBroadcast = async () => {
    if (!broadcast.trim()) return;
    setSending(true);
    const r = await callAction({ action: "broadcast", content: broadcast.trim() });
    setSending(false);
    if (r) {
      toast.success(`📢 Enviado a ${r.count} usuarios`);
      setBroadcast("");
      setRefreshKey((k) => k + 1);
    }
  };

  const handleDM = async () => {
    if (!dmTarget || !dmText.trim()) return;
    setSending(true);
    const r = await callAction({ action: "dm_as_support", target_user_id: dmTarget, content: dmText.trim() });
    setSending(false);
    if (r) {
      toast.success("💬 DM enviado desde ChatRoom Support");
      setDmText("");
    }
  };

  const [myUserId, setMyUserId] = useState("");
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setMyUserId(data.session?.user.id ?? "")); }, []);

  const toggleVerified = async (p: Profile) => {
    await callAction({ action: "set_verified", target_user_id: p.user_id, value: !p.is_verified });
    toast.success(`${p.is_verified ? "Quitada" : "Otorgada"} verificación a ${p.display_name}`);
  };

  const toggleBanned = async (p: Profile) => {
    if (p.is_official) return;
    await callAction({ action: "set_banned", target_user_id: p.user_id, value: !p.is_banned });
    toast.success(`${p.is_banned ? "Desbaneado" : "Baneado"} ${p.display_name}`);
  };

  const deleteUser = async (p: Profile) => {
    if (p.is_official) return;
    if (!confirm(`¿Eliminar a ${p.display_name}? Esta acción es irreversible.`)) return;
    await callAction({ action: "delete_user", target_user_id: p.user_id });
    toast.success(`🗑️ ${p.display_name} eliminado`);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 30, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-3xl max-h-[90vh] bg-card rounded-2xl border border-amber-500/30 shadow-[0_0_60px_hsl(40_100%_50%/0.3)] overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-amber-500/10 via-primary/10 to-destructive/10">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="p-2 rounded-xl bg-amber-500/20 text-amber-400"
              >
                <Crown size={22} fill="currentColor" />
              </motion.div>
              <div>
                <h2 className="text-lg font-bold magma-gradient-text">Panel de Admin</h2>
                <p className="text-xs text-muted-foreground">Tienes todo el poder MUAJAJA 👑</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex border-b border-border bg-muted/30">
            {([
              ["ai", "IA", Sparkles],
              ["broadcast", "Mensajes", Megaphone],
              ["users", "Usuarios", Users],
              ["cms", "Sitio", FileText],
              ["ui", "UI", Palette],
              ["events", "En vivo", Radio],
              ["stats", "Stats", BarChart3],
            ] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all ${
                  tab === key
                    ? "text-primary border-b-2 border-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-magma p-6">
            {tab === "ai" && <AdminAIConsole />}
            {tab === "cms" && <CmsTab />}
            {tab === "ui" && <UiTab />}
            {tab === "events" && <EventsTab />}
            {tab === "broadcast" && (
              <div className="space-y-6">
                <section>
                  <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Megaphone size={16} className="text-primary" /> Broadcast a TODOS
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Aparecerá en cada usuario como mensaje de <strong className="text-sky-400">ChatRoom Support</strong>.
                  </p>
                  <textarea
                    value={broadcast}
                    onChange={(e) => setBroadcast(e.target.value)}
                    rows={3}
                    placeholder="Escribe el anuncio para todos los usuarios..."
                    className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-none"
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={handleBroadcast} disabled={sending || !broadcast.trim()}
                    className="mt-3 w-full py-3 rounded-xl magma-gradient text-primary-foreground font-semibold magma-glow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Send size={16} /> Enviar a {realUsers.length} usuarios
                  </motion.button>
                </section>

                <div className="border-t border-border pt-6">
                  <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <MessageSquare size={16} className="text-primary" /> Mensaje directo (DM)
                  </h3>
                  <p className="text-xs text-muted-foreground mb-3">
                    Solo lo recibe el usuario seleccionado, también desde ChatRoom Support.
                  </p>
                  <button onClick={() => setPickerOpen(true)}
                    className="w-full mb-2 px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/50 flex items-center gap-2 hover:border-primary/40 transition-colors">
                    <Search size={14} className="text-muted-foreground" />
                    <span className={dmTargetName ? "text-foreground" : "text-muted-foreground"}>
                      {dmTargetName || "Buscar usuario… (filtros, alfabético, recientes, importantes)"}
                    </span>
                  </button>
                  <textarea
                    value={dmText}
                    onChange={(e) => setDmText(e.target.value)}
                    rows={2}
                    placeholder="Mensaje privado..."
                    className="w-full px-4 py-3 rounded-xl bg-input border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/50 resize-none"
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={handleDM} disabled={sending || !dmTarget || !dmText.trim()}
                    className="mt-3 w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Send size={16} /> Enviar DM
                  </motion.button>
                </div>
              </div>
            )}

            {tab === "users" && (
              <div className="space-y-2">
                {realUsers.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">No hay usuarios registrados aún.</p>
                )}
                {realUsers.map((p) => (
                  <motion.div
                    key={p.user_id}
                    layout
                    className={`flex items-center gap-3 p-3 rounded-xl border ${
                      p.is_banned ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/30"
                    }`}
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
                    <div className="flex gap-1">
                      <button
                        onClick={() => toggleVerified(p)}
                        title={p.is_verified ? "Quitar verificación" : "Verificar"}
                        className={`p-2 rounded-lg transition-colors ${
                          p.is_verified ? "text-sky-400 bg-sky-500/15" : "text-muted-foreground hover:text-sky-400 hover:bg-sky-500/10"
                        }`}
                      >
                        <ShieldCheck size={16} />
                      </button>
                      <button
                        onClick={() => toggleBanned(p)}
                        title={p.is_banned ? "Desbanear" : "Banear"}
                        className={`p-2 rounded-lg transition-colors ${
                          p.is_banned ? "text-destructive bg-destructive/15" : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        }`}
                      >
                        <Ban size={16} />
                      </button>
                      <button
                        onClick={() => deleteUser(p)}
                        title="Eliminar usuario"
                        className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {tab === "stats" && (
              <div className="grid grid-cols-2 gap-4">
                {[
                  ["Usuarios", stats.users ?? "—", "from-orange-500 to-red-500"],
                  ["Mensajes", stats.msgs ?? "—", "from-sky-500 to-blue-500"],
                  ["Conversaciones", stats.convs ?? "—", "from-amber-500 to-orange-500"],
                  ["Broadcasts", stats.bcasts ?? "—", "from-fuchsia-500 to-purple-500"],
                ].map(([label, val, grad]) => (
                  <motion.div
                    key={label as string}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="p-5 rounded-2xl border border-border bg-muted/30 relative overflow-hidden"
                  >
                    <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${grad}`} />
                    <p className="relative text-xs uppercase tracking-wider text-muted-foreground">{label as string}</p>
                    <p className="relative text-3xl font-bold magma-gradient-text mt-1">{val}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
      <UserPickerDialog open={pickerOpen} myUserId={myUserId}
        onClose={() => setPickerOpen(false)}
        onPick={(id, name) => { setDmTarget(id); setDmTargetName(name); setPickerOpen(false); }} />
    </AnimatePresence>
  );
};

export default AdminPanel;
