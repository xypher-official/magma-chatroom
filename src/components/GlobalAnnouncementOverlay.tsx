import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Icons from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Announcement {
  id: string;
  title: string;
  message: string;
  style: string;
  color: string;
  icon: string;
  duration_ms: number;
  created_at: string;
}

const colorMap: Record<string, { from: string; to: string; ring: string; glow: string }> = {
  amber:    { from: "#f59e0b", to: "#ea580c", ring: "#fbbf24", glow: "rgba(251,191,36,0.6)" },
  red:      { from: "#ef4444", to: "#7f1d1d", ring: "#fca5a5", glow: "rgba(248,113,113,0.6)" },
  sky:      { from: "#0ea5e9", to: "#1d4ed8", ring: "#7dd3fc", glow: "rgba(56,189,248,0.6)" },
  emerald:  { from: "#10b981", to: "#065f46", ring: "#6ee7b7", glow: "rgba(52,211,153,0.6)" },
  fuchsia:  { from: "#d946ef", to: "#6b21a8", ring: "#f0abfc", glow: "rgba(232,121,249,0.6)" },
};

const GlobalAnnouncementOverlay = ({ enabled }: { enabled: boolean }) => {
  const [queue, setQueue] = useState<Announcement[]>([]);
  const [current, setCurrent] = useState<Announcement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel("global-announcements-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "global_announcements" },
        (payload) => {
          const a = payload.new as Announcement;
          // ignore announcements older than 30s (e.g. on initial connect)
          if (Date.now() - new Date(a.created_at).getTime() > 30000) return;
          setQueue((q) => [...q, a]);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [enabled]);

  useEffect(() => {
    if (current || queue.length === 0) return;
    const next = queue[0];
    setQueue((q) => q.slice(1));
    setCurrent(next);
    const t = setTimeout(() => setCurrent(null), next.duration_ms || 8000);
    return () => clearTimeout(t);
  }, [queue, current]);

  if (!enabled) return null;

  const c = current ? (colorMap[current.color] ?? colorMap.amber) : colorMap.amber;
  const IconCmp = current ? ((Icons as any)[current.icon] ?? Icons.Megaphone) : Icons.Megaphone;

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.id}
          className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Screen-wide pulse flash */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.35, 0] }}
            transition={{ duration: 0.6, times: [0, 0.4, 1] }}
            style={{ background: `radial-gradient(circle, ${c.glow} 0%, transparent 65%)` }}
          />

          {/* Sliding bar — Strongest-Battlegrounds style */}
          <motion.div
            className="relative w-screen overflow-hidden"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            exit={{ scaleY: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{
              transformOrigin: "center",
              background: `linear-gradient(90deg, transparent 0%, ${c.from}cc 20%, ${c.to}f5 50%, ${c.from}cc 80%, transparent 100%)`,
              boxShadow: `0 0 80px 10px ${c.glow}, inset 0 0 30px rgba(0,0,0,0.4)`,
              borderTop: `2px solid ${c.ring}`,
              borderBottom: `2px solid ${c.ring}`,
            }}
          >
            {/* Shine sweep */}
            <motion.div
              className="absolute inset-y-0 w-1/3"
              initial={{ x: "-100%" }}
              animate={{ x: "300%" }}
              transition={{ duration: 1.6, ease: "easeInOut" }}
              style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)" }}
            />

            <motion.div
              className="relative flex items-center justify-center gap-5 px-6 py-8 md:py-12"
              initial={{ x: -120, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 120, opacity: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 220, damping: 22 }}
            >
              <motion.div
                animate={{ rotate: [0, -8, 8, -8, 0], scale: [1, 1.15, 1] }}
                transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 1.2 }}
                className="shrink-0 p-3 rounded-2xl"
                style={{ background: "rgba(0,0,0,0.35)", boxShadow: `0 0 24px ${c.glow}` }}
              >
                <IconCmp size={40} className="text-white" strokeWidth={2.5} />
              </motion.div>

              <div className="text-center min-w-0">
                {current.title && (
                  <motion.p
                    initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.35 }}
                    className="text-[10px] md:text-xs font-black uppercase tracking-[0.35em] text-white/85"
                    style={{ textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}
                  >
                    {current.title}
                  </motion.p>
                )}
                <motion.p
                  initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.4, type: "spring", stiffness: 260, damping: 18 }}
                  className="text-xl md:text-4xl font-black text-white leading-tight break-words"
                  style={{
                    textShadow: `0 2px 0 rgba(0,0,0,0.55), 0 0 18px ${c.glow}, 0 0 36px ${c.glow}`,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {current.message}
                </motion.p>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalAnnouncementOverlay;