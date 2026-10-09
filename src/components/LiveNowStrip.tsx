import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type S = { id: string; title: string; host_id: string; status: string; source: string };

const LiveNowStrip = () => {
  const nav = useNavigate();
  const [items, setItems] = useState<S[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await supabase.from("live_streams").select("id,title,host_id,status,source")
      .in("status", ["live", "paused"]).order("started_at", { ascending: false }).limit(20);
    const list = (data as S[]) ?? [];
    setItems(list);
    if (list.length) {
      const { data: p } = await supabase.from("profiles").select("user_id,display_name").in("user_id", list.map((s) => s.host_id));
      setNames(Object.fromEntries((p ?? []).map((r: any) => [r.user_id, r.display_name])));
    }
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("live-now").on("postgres_changes", { event: "*", schema: "public", table: "live_streams" }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <Radio size={16} className="text-destructive animate-pulse" />
        <h3 className="text-sm font-bold text-foreground">En vivo ahora</h3>
        <button onClick={() => nav("/live/new")}
          className="ml-auto px-3 py-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center gap-1.5">
          <Radio size={12} /> Ir EN VIVO
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nadie está transmitiendo. ¡Empieza tú!</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto scrollbar-magma pb-1">
          {items.map((s) => (
            <motion.button key={s.id} whileHover={{ y: -3 }} onClick={() => nav(`/live/${s.id}`)}
              className="shrink-0 w-56 rounded-2xl glass-panel border border-border p-3 text-left">
              <div className="aspect-video rounded-xl magma-gradient flex items-center justify-center mb-2 relative">
                <Radio className="text-primary-foreground" />
                <span className={`absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${s.status === "paused" ? "bg-muted text-foreground" : "bg-destructive text-destructive-foreground"}`}>
                  {s.status === "paused" ? "PAUSA" : "LIVE"}
                </span>
              </div>
              <p className="text-sm font-semibold text-foreground truncate">{s.title}</p>
              <p className="text-[11px] text-muted-foreground truncate">{names[s.host_id] ?? "…"}</p>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LiveNowStrip;
