import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Radio, Send, Square, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LiveEvent { id: string; title: string; description: string; is_active: boolean; created_at: string }
interface Update { id: string; content: string; created_at: string }

const EventsTab = () => {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [updateText, setUpdateText] = useState("");

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("live_events").select("*").order("created_at", { ascending: false }).limit(20);
    setEvents((data as LiveEvent[]) ?? []);
    const live = (data as LiveEvent[])?.find((e) => e.is_active);
    if (live && !activeId) setActiveId(live.id);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!activeId) { setUpdates([]); return; }
    supabase.from("live_updates").select("*").eq("event_id", activeId).order("created_at", { ascending: false })
      .then(({ data }) => data && setUpdates(data as Update[]));
  }, [activeId]);

  const createEvent = async () => {
    if (!newTitle.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from("live_events")
      .insert({ title: newTitle.trim(), description: newDesc.trim(), created_by: user.id, is_active: true })
      .select("id").single();
    if (error) { toast.error(error.message); return; }
    toast.success("🎬 Evento creado");
    setNewTitle(""); setNewDesc(""); setActiveId(data!.id); load();
  };

  const postUpdate = async () => {
    if (!activeId || !updateText.trim()) return;
    const { error } = await supabase.from("live_updates").insert({ event_id: activeId, content: updateText.trim() });
    if (error) { toast.error(error.message); return; }
    setUpdateText("");
    supabase.from("live_updates").select("*").eq("event_id", activeId).order("created_at", { ascending: false })
      .then(({ data }) => data && setUpdates(data as Update[]));
  };

  const endEvent = async (id: string) => {
    await supabase.from("live_events").update({ is_active: false, ended_at: new Date().toISOString() }).eq("id", id);
    toast.success("🏁 Evento finalizado");
    load();
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Plus size={16} className="text-primary" /> Crear evento en vivo</h3>
        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Título del evento"
          className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm outline-none" />
        <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Descripción (opcional)" rows={2}
          className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm outline-none resize-none" />
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={createEvent} disabled={!newTitle.trim()}
          className="w-full py-2.5 rounded-lg bg-gradient-to-r from-red-500 to-rose-700 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
          <Radio size={14} /> Iniciar EN VIVO
        </motion.button>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-foreground mb-2">Eventos</h3>
        <div className="space-y-2">
          {events.length === 0 && <p className="text-xs text-muted-foreground">No hay eventos todavía.</p>}
          {events.map((e) => (
            <div key={e.id} className={`rounded-lg border p-3 cursor-pointer ${activeId === e.id ? "border-primary bg-primary/5" : "border-border bg-muted/30"}`}
              onClick={() => setActiveId(e.id)}>
              <div className="flex items-center gap-2">
                {e.is_active && <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold tracking-wider">LIVE</span>}
                <span className="font-medium text-sm text-foreground truncate flex-1">{e.title}</span>
                {e.is_active && (
                  <button onClick={(ev) => { ev.stopPropagation(); endEvent(e.id); }}
                    className="p-1.5 rounded hover:bg-destructive/20 text-destructive" title="Finalizar">
                    <Square size={14} />
                  </button>
                )}
              </div>
              {e.description && <p className="text-xs text-muted-foreground mt-1 truncate">{e.description}</p>}
            </div>
          ))}
        </div>
      </section>

      {activeId && (
        <section className="rounded-xl border border-border bg-muted/30 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Publicar actualización</h3>
          <div className="flex gap-2">
            <input value={updateText} onChange={(e) => setUpdateText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && postUpdate()}
              placeholder="Nueva actualización en vivo…"
              className="flex-1 px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm outline-none" />
            <button onClick={postUpdate} disabled={!updateText.trim()}
              className="px-3 rounded-lg magma-gradient text-primary-foreground disabled:opacity-50">
              <Send size={16} />
            </button>
          </div>
          <div className="space-y-1.5 max-h-48 overflow-y-auto pt-2">
            {updates.map((u) => (
              <div key={u.id} className="text-xs bg-background/40 rounded px-2 py-1.5 border border-border">
                <span className="text-muted-foreground mr-2">{new Date(u.created_at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}</span>
                {u.content}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default EventsTab;
