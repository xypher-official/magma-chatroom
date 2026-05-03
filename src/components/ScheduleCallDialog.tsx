import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, X, Link2, Copy, Trash2, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Sched {
  id: string; title: string; description: string; scheduled_at: string;
  call_type: "video" | "audio"; room_id: string; share_link: string; status: string; host_id: string;
}
interface Props {
  open: boolean;
  onClose: () => void;
  myUserId: string;
}

const fmt = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: "short", timeStyle: "short" });

const ScheduleCallDialog = ({ open, onClose, myUserId }: Props) => {
  const [list, setList] = useState<Sched[]>([]);
  const [title, setTitle] = useState("Magma Call");
  const [when, setWhen] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [type, setType] = useState<"video" | "audio">("video");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("scheduled_calls").select("*")
      .order("scheduled_at", { ascending: true });
    setList((data as Sched[]) ?? []);
  };
  useEffect(() => { if (open) load(); }, [open]);

  const create = async () => {
    if (!title.trim()) return;
    setBusy(true);
    const roomId = crypto.randomUUID();
    const link = `${window.location.origin}/call/${roomId}`;
    const { error } = await supabase.from("scheduled_calls").insert({
      host_id: myUserId, title: title.trim(),
      scheduled_at: new Date(when).toISOString(), call_type: type,
      room_id: roomId, share_link: link, invitee_ids: [],
    });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("📅 Call scheduled"); load(); }
  };

  const copyLink = (s: Sched) => {
    navigator.clipboard.writeText(s.share_link || `${window.location.origin}/call/${s.room_id}`);
    toast.success("🔗 Link copied");
  };

  const cancel = async (s: Sched) => {
    await supabase.from("scheduled_calls").delete().eq("id", s.id);
    toast.success("Cancelled"); load();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} className="fixed inset-0 z-[80] bg-background/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-card glass-panel-strong rounded-2xl border border-primary/20 max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2"><Calendar className="text-primary" size={20} /><h3 className="font-bold">Scheduled calls</h3></div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
            </div>
            <div className="p-5 overflow-y-auto scrollbar-magma space-y-5">
              <section className="space-y-3 p-4 rounded-xl bg-muted/30 border border-border">
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title"
                  className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm" />
                <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm text-foreground" />
                <div className="flex gap-2">
                  {(["video","audio"] as const).map((c) => (
                    <button key={c} onClick={() => setType(c)}
                      className={`flex-1 py-2 rounded-lg text-sm capitalize border ${type === c ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:border-primary/40"}`}>
                      {c}
                    </button>
                  ))}
                </div>
                <button onClick={create} disabled={busy}
                  className="w-full py-2.5 rounded-xl magma-gradient text-primary-foreground font-semibold text-sm magma-glow-sm disabled:opacity-60">
                  📅 Schedule new call
                </button>
              </section>

              <section className="space-y-2">
                <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Upcoming</h4>
                {list.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No scheduled calls.</p>}
                {list.map((s) => (
                  <motion.div key={s.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl border border-border bg-muted/20">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full magma-gradient flex items-center justify-center text-primary-foreground">
                        <Phone size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{s.title}</p>
                        <p className="text-xs text-muted-foreground">{fmt(s.scheduled_at)} · {s.call_type}</p>
                      </div>
                      <button onClick={() => copyLink(s)} title="Copy link" className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary">
                        <Copy size={14} />
                      </button>
                      <a href={`/call/${s.room_id}`} target="_blank" rel="noreferrer" title="Open" className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary">
                        <Link2 size={14} />
                      </a>
                      {s.host_id === myUserId && (
                        <button onClick={() => cancel(s)} title="Cancel" className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ScheduleCallDialog;