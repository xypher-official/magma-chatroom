import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Radio, Save, Send, Clock, Eye, Plus, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import LiveEventBar from "@/components/LiveEventBar";

interface EventDraft {
  id: string;
  title: string;
  description: string;
  is_active: boolean;
  is_draft: boolean;
  publish_at: string | null;
  countdown_label: string;
  theme: any;
  created_at: string;
}

const EventStudio = () => {
  const nav = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [drafts, setDrafts] = useState<EventDraft[]>([]);
  const [active, setActive] = useState<EventDraft | null>(null);
  const [now, setNow] = useState(Date.now());
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!r);
    })();
  }, []);

  const load = async () => {
    const { data } = await supabase.from("live_events").select("*").order("created_at", { ascending: false });
    setDrafts((data as EventDraft[]) ?? []);
  };
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const createDraft = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from("live_events").insert({
      title: "Nuevo evento", description: "", created_by: user.id, is_active: false, is_draft: true,
      theme: { primary: "#f97316", accent: "#d946ef" }, countdown_label: "Comenzamos en",
    }).select("*").single();
    if (error) { toast.error(error.message); return; }
    toast.success("📝 Borrador creado");
    setActive(data as EventDraft); load();
  };

  const save = async () => {
    if (!active) return;
    const { error } = await supabase.from("live_events").update({
      title: active.title, description: active.description, theme: active.theme,
      countdown_label: active.countdown_label, publish_at: active.publish_at,
    }).eq("id", active.id);
    if (error) { toast.error(error.message); return; }
    toast.success("💾 Guardado"); load();
  };

  const publishNow = async () => {
    if (!active) return;
    await save();
    const { error } = await supabase.from("live_events").update({
      is_active: true, is_draft: false, publish_at: null,
    }).eq("id", active.id);
    if (error) { toast.error(error.message); return; }
    toast.success("🔴 ¡EN VIVO ahora!");
    load();
  };

  const publishWithCountdown = async () => {
    if (!active || !active.publish_at) { toast.error("Define una fecha de publicación primero"); return; }
    await save();
    const { error } = await supabase.from("live_events").update({
      is_active: true, is_draft: false,
    }).eq("id", active.id);
    if (error) { toast.error(error.message); return; }
    toast.success("⏳ Cuenta regresiva iniciada");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este evento?")) return;
    await supabase.from("live_events").delete().eq("id", id);
    if (active?.id === id) setActive(null);
    load();
  };

  const countdown = useMemo(() => {
    if (!active?.publish_at) return null;
    const ms = new Date(active.publish_at).getTime() - now;
    if (ms <= 0) return "00:00:00";
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${ss}`;
  }, [active?.publish_at, now]);

  if (isAdmin === false) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Solo admins.</div>;
  }
  if (isAdmin === null) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="px-4 py-3 border-b border-border flex items-center gap-3 glass-panel sticky top-0 z-30">
        <button onClick={() => nav("/")} className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><ArrowLeft size={18} /></button>
        <div className="flex-1">
          <h1 className="font-bold magma-gradient-text">Event Studio</h1>
          <p className="text-[10px] text-muted-foreground">Crea, previsualiza y programa eventos en vivo</p>
        </div>
        <button onClick={() => setPreviewMode(v => !v)}
          className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${previewMode ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
          <Eye size={14} /> {previewMode ? "Editando" : "Previsualizar"}
        </button>
      </header>

      <div className="grid lg:grid-cols-[260px_1fr_360px] gap-4 p-4">
        {/* Drafts list */}
        <aside className="space-y-2">
          <button onClick={createDraft}
            className="w-full py-2.5 rounded-xl magma-gradient text-primary-foreground font-semibold flex items-center justify-center gap-2 text-sm">
            <Plus size={14} /> Nuevo evento
          </button>
          {drafts.map(d => (
            <button key={d.id} onClick={() => setActive(d)}
              className={`w-full text-left p-3 rounded-xl border transition-all ${
                active?.id === d.id ? "border-primary bg-primary/10" : "border-border bg-muted/30 hover:bg-muted/50"
              }`}>
              <div className="flex items-center gap-2">
                {d.is_active && <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[9px] font-bold">LIVE</span>}
                {d.is_draft && <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[9px] font-bold">DRAFT</span>}
                <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm font-semibold mt-1 truncate">{d.title}</p>
              {d.publish_at && new Date(d.publish_at) > new Date() && (
                <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1"><Clock size={10} /> programado</p>
              )}
            </button>
          ))}
        </aside>

        {/* Editor / preview */}
        <main className="space-y-4">
          {!active ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
              Selecciona o crea un evento para empezar.
            </div>
          ) : previewMode ? (
            <div className="rounded-2xl border border-border overflow-hidden">
              <div className="bg-background">
                <LiveEventBarPreview event={active} countdown={countdown} />
                <div className="p-6 space-y-3">
                  <h2 className="text-2xl font-bold" style={{ color: active.theme?.primary }}>{active.title}</h2>
                  <p className="text-muted-foreground">{active.description}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Título</label>
                <input value={active.title} onChange={e => setActive({ ...active, title: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-input border border-border text-lg font-semibold outline-none focus:ring-2 focus:ring-ring/40" />
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Descripción</label>
                <textarea value={active.description} onChange={e => setActive({ ...active, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-input border border-border outline-none focus:ring-2 focus:ring-ring/40 resize-none" />
              </div>
              <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Tema (preview)</label>
                <div className="flex gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Primario</p>
                    <input type="color" value={active.theme?.primary ?? "#f97316"}
                      onChange={e => setActive({ ...active, theme: { ...active.theme, primary: e.target.value } })}
                      className="w-16 h-10 rounded-lg bg-transparent border border-border" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Acento</p>
                    <input type="color" value={active.theme?.accent ?? "#d946ef"}
                      onChange={e => setActive({ ...active, theme: { ...active.theme, accent: e.target.value } })}
                      className="w-16 h-10 rounded-lg bg-transparent border border-border" />
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Cuenta regresiva (opcional)</label>
                <input value={active.countdown_label}
                  onChange={e => setActive({ ...active, countdown_label: e.target.value })}
                  placeholder='Ej: "Comenzamos en"'
                  className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm outline-none" />
                <input type="datetime-local"
                  value={active.publish_at ? new Date(active.publish_at).toISOString().slice(0, 16) : ""}
                  onChange={e => setActive({ ...active, publish_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm outline-none" />
              </div>
            </div>
          )}
        </main>

        {/* Action panel */}
        <aside className="space-y-3">
          {active && (
            <>
              <button onClick={save}
                className="w-full py-3 rounded-xl bg-muted hover:bg-muted/70 text-foreground font-semibold flex items-center justify-center gap-2">
                <Save size={14} /> Guardar borrador
              </button>
              <button onClick={publishNow}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-700 text-white font-semibold flex items-center justify-center gap-2">
                <Send size={14} /> Publicar AHORA
              </button>
              <button onClick={publishWithCountdown}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold flex items-center justify-center gap-2">
                <Clock size={14} /> Publicar con cuenta regresiva
              </button>
              {countdown && active.is_active && (
                <div className="text-center p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <p className="text-xs text-amber-400 uppercase tracking-wider">{active.countdown_label || "En vivo en"}</p>
                  <p className="text-3xl font-mono font-bold text-amber-400 mt-1">{countdown}</p>
                </div>
              )}
              <button onClick={() => remove(active.id)}
                className="w-full py-2.5 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive font-medium text-sm flex items-center justify-center gap-2">
                <Trash2 size={14} /> Eliminar
              </button>
              <Link to="/" className="block text-center text-xs text-muted-foreground hover:text-foreground">
                ← Volver al chat
              </Link>
            </>
          )}
        </aside>
      </div>
    </div>
  );
};

const LiveEventBarPreview = ({ event, countdown }: { event: any; countdown: string | null }) => (
  <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
    className="px-4 py-3 text-white shadow-lg flex items-center gap-3"
    style={{ background: `linear-gradient(90deg, ${event.theme?.primary ?? "#dc2626"}, ${event.theme?.accent ?? "#9333ea"})` }}>
    <Radio size={16} />
    <span className="text-[10px] tracking-widest font-bold bg-white/20 px-2 py-0.5 rounded">EN VIVO</span>
    <span className="font-semibold truncate">{event.title}</span>
    {countdown && (
      <span className="ml-auto font-mono font-bold bg-black/30 px-2 py-1 rounded">{countdown}</span>
    )}
  </motion.div>
);

export default EventStudio;