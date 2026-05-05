import { motion, AnimatePresence } from "framer-motion";
import { Phone, Video, CalendarClock, Link2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  contactName: string;
  contactUserId: string;
  myUserId: string;
  onStartCall: (calleeId: string, callType: "video" | "audio") => void;
  onSchedule: () => void;
}

const CallOptionsSheet = ({ open, onClose, contactName, contactUserId, myUserId, onStartCall, onSchedule }: Props) => {
  const [busy, setBusy] = useState(false);

  const createInviteLink = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const room = crypto.randomUUID();
      const link = `${window.location.origin}/call/${room}`;
      const { error } = await supabase.from("scheduled_calls").insert({
        host_id: myUserId, title: `Call with ${contactName}`,
        scheduled_at: new Date().toISOString(),
        call_type: "video", room_id: room, share_link: link,
        invitee_ids: [contactUserId], status: "open",
      });
      if (error) throw error;
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied!");
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const opts = [
    { icon: Phone, label: "Voice call", desc: "Audio only", color: "from-green-500 to-emerald-600",
      action: () => { onStartCall(contactUserId, "audio"); onClose(); } },
    { icon: Video, label: "Video call", desc: "With camera", color: "from-orange-500 to-red-500",
      action: () => { onStartCall(contactUserId, "video"); onClose(); } },
    { icon: CalendarClock, label: "Schedule call", desc: "Pick a date & time", color: "from-fuchsia-500 to-purple-600",
      action: () => { onSchedule(); onClose(); } },
    { icon: Link2, label: "Custom call link", desc: "Copy a shareable link", color: "from-sky-500 to-cyan-600",
      action: createInviteLink },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose} className="fixed inset-0 z-[90] bg-background/70 backdrop-blur-sm flex items-end md:items-center justify-center p-4">
          <motion.div initial={{ y: 60, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0 }} transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm glass-panel-strong rounded-3xl border border-primary/20 p-5 magma-glow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-foreground">Call options</h3>
                <p className="text-xs text-muted-foreground">with {contactName}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
            </div>
            <div className="space-y-2">
              {opts.map((o, i) => (
                <motion.button key={o.label} disabled={busy}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ scale: 1.02, x: 4 }} whileTap={{ scale: 0.98 }}
                  onClick={o.action}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-muted/40 hover:bg-muted border border-border/40 text-left disabled:opacity-50">
                  <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${o.color} flex items-center justify-center text-white shadow-lg`}>
                    <o.icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">{o.label}</p>
                    <p className="text-xs text-muted-foreground">{o.desc}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CallOptionsSheet;