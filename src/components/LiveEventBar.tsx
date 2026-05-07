import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LiveEvent { id: string; title: string; description: string; is_active: boolean; created_at: string;
  publish_at?: string | null; countdown_label?: string; theme?: any }
interface Update { id: string; event_id: string; content: string; created_at: string }

const LiveEventBar = () => {
  const [event, setEvent] = useState<LiveEvent | null>(null);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    const loadEvent = async () => {
      const { data } = await supabase
        .from("live_events").select("*").eq("is_active", true).eq("is_draft", false)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      setEvent((data as LiveEvent) ?? null);
    };
    loadEvent();
    const ch = supabase.channel("live-events-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "live_events" }, loadEvent)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (!event) { setUpdates([]); return; }
    const loadUpdates = () => supabase.from("live_updates").select("*").eq("event_id", event.id).order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => data && setUpdates(data as Update[]));
    loadUpdates();
    const ch = supabase.channel(`live-updates-${event.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_updates", filter: `event_id=eq.${event.id}` }, loadUpdates)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [event?.id]);

  if (!event) return null;
  const future = event.publish_at && new Date(event.publish_at).getTime() > now;
  let countdown = "";
  if (future) {
    const ms = new Date(event.publish_at!).getTime() - now;
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const ss = (s % 60).toString().padStart(2, "0");
    countdown = `${h}:${m}:${ss}`;
  }
  const bg = event.theme?.primary && event.theme?.accent
    ? `linear-gradient(90deg, ${event.theme.primary}, ${event.theme.accent})`
    : undefined;
  return (
    <motion.div
      initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      className="relative z-30 text-white shadow-lg"
      style={{ background: bg ?? "linear-gradient(90deg, #dc2626, #9333ea)" }}
    >
      <button onClick={() => setOpen((o) => !o)} className="w-full px-4 py-2 flex items-center gap-3 text-sm font-semibold">
        <motion.div animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }} transition={{ duration: 1.4, repeat: Infinity }}>
          <Radio size={16} />
        </motion.div>
        <span className="text-[10px] tracking-widest font-bold bg-white/20 px-2 py-0.5 rounded">
          {future ? "PRÓXIMAMENTE" : "EN VIVO"}
        </span>
        <span className="truncate">{event.title}</span>
        {future && (
          <span className="ml-auto font-mono font-bold bg-black/30 px-2 py-0.5 rounded text-xs">
            {event.countdown_label ? `${event.countdown_label} ` : ""}{countdown}
          </span>
        )}
        <span className="ml-auto opacity-80">{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-rose-900/40 backdrop-blur-sm"
          >
            <div className="px-4 py-3 max-h-64 overflow-y-auto space-y-2">
              {event.description && <p className="text-xs opacity-90 italic">{event.description}</p>}
              {updates.length === 0 && <p className="text-xs opacity-80">Sin actualizaciones todavía…</p>}
              {updates.map((u) => (
                <motion.div
                  key={u.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  className="text-xs bg-white/10 rounded-lg px-3 py-2"
                >
                  <p className="opacity-70 text-[10px] mb-0.5">{new Date(u.created_at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}</p>
                  <p className="leading-relaxed">{u.content}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default LiveEventBar;
