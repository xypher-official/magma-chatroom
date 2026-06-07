import { useState } from "react";
import { motion } from "framer-motion";
import { Megaphone, Send, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const COLORS = [
  { key: "amber", label: "Magma", grad: "from-amber-500 to-orange-600" },
  { key: "red", label: "Lava", grad: "from-red-500 to-rose-700" },
  { key: "sky", label: "Ice", grad: "from-sky-500 to-blue-700" },
  { key: "emerald", label: "Toxic", grad: "from-emerald-500 to-teal-700" },
  { key: "fuchsia", label: "Royal", grad: "from-fuchsia-500 to-purple-700" },
];

const ICONS = ["Megaphone", "Flame", "Crown", "Sparkles", "Zap", "Trophy", "Skull", "Star", "Bell", "AlertTriangle"];

const AdminAnnounceTab = ({ myUserId }: { myUserId: string }) => {
  const [title, setTitle] = useState("ANUNCIO GLOBAL");
  const [message, setMessage] = useState("");
  const [color, setColor] = useState("amber");
  const [icon, setIcon] = useState("Megaphone");
  const [duration, setDuration] = useState(8);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!message.trim() || !myUserId) return;
    setSending(true);
    const { error } = await supabase.from("global_announcements").insert({
      sender_id: myUserId,
      title: title.trim(),
      message: message.trim(),
      color, icon,
      duration_ms: Math.max(2, Math.min(60, duration)) * 1000,
    });
    setSending(false);
    if (error) toast.error(error.message);
    else { toast.success("🌋 ¡Anuncio lanzado a todo el sitio!"); setMessage(""); }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-rose-500/10 p-4">
        <h3 className="text-sm font-bold flex items-center gap-2 text-foreground mb-1">
          <Megaphone size={16} className="text-amber-400" /> Anuncio global en vivo
        </h3>
        <p className="text-[11px] text-muted-foreground">
          Aparece instantáneamente a TODOS los usuarios conectados con animación épica estilo Strongest Battlegrounds.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Encabezado (mayúsculas)</label>
        <input value={title} onChange={(e) => setTitle(e.target.value.toUpperCase())} maxLength={40}
          className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/50" />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Mensaje (lo que verán en grande)</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={140}
          placeholder="¡EVENTO ESPECIAL EN 5 MINUTOS!"
          className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-base outline-none focus:ring-2 focus:ring-ring/50 resize-none font-semibold" />
        <p className="text-[10px] text-right text-muted-foreground">{message.length}/140</p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Color</label>
        <div className="grid grid-cols-5 gap-2">
          {COLORS.map((c) => (
            <button key={c.key} onClick={() => setColor(c.key)}
              className={`p-2 rounded-lg bg-gradient-to-br ${c.grad} text-white text-xs font-bold border-2 transition-all ${color === c.key ? "border-white scale-105 shadow-lg" : "border-transparent opacity-70"}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Ícono</label>
        <div className="flex gap-1 flex-wrap">
          {ICONS.map((i) => (
            <button key={i} onClick={() => setIcon(i)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-mono border transition-colors ${icon === i ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
              {i}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Duración: {duration}s</label>
        <input type="range" min={3} max={20} value={duration} onChange={(e) => setDuration(+e.target.value)} className="w-full accent-primary" />
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
        onClick={send} disabled={sending || !message.trim()}
        className="w-full py-4 rounded-xl magma-gradient text-primary-foreground font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50 magma-glow-sm">
        <Sparkles size={18} /> LANZAR ANUNCIO <Send size={18} />
      </motion.button>
    </div>
  );
};

export default AdminAnnounceTab;