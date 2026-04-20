import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface IncomingCall {
  id: string; caller_id: string; call_type: "audio" | "video"; callerName: string; callerAvatar: string;
}

interface Props {
  myUserId: string;
  onAccept: (call: IncomingCall) => void;
}

const IncomingCallToast = ({ myUserId, onAccept }: Props) => {
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);

  useEffect(() => {
    if (!myUserId) return;
    const ch = supabase.channel(`incoming-${myUserId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "calls", filter: `callee_id=eq.${myUserId}` }, async (p) => {
        const c = p.new as any;
        if (c.status !== "ringing") return;
        const { data: prof } = await supabase.from("profiles").select("display_name,avatar_initials").eq("user_id", c.caller_id).maybeSingle();
        setIncoming({ id: c.id, caller_id: c.caller_id, call_type: c.call_type, callerName: prof?.display_name ?? "Alguien", callerAvatar: prof?.avatar_initials ?? "??" });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [myUserId]);

  const reject = async () => {
    if (!incoming) return;
    await supabase.from("calls").update({ status: "rejected", ended_at: new Date().toISOString() }).eq("id", incoming.id);
    await supabase.from("call_signals").insert({ call_id: incoming.id, from_user: myUserId, to_user: incoming.caller_id, signal_type: "hangup", payload: {} });
    setIncoming(null);
  };

  const accept = () => { if (incoming) { onAccept(incoming); setIncoming(null); } };

  return (
    <AnimatePresence>
      {incoming && (
        <motion.div initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -100, opacity: 0 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] glass-panel-strong rounded-2xl p-4 flex items-center gap-3 magma-glow-sm border border-primary/30 max-w-[92vw]">
          <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1, repeat: Infinity }}
            className="w-12 h-12 rounded-full magma-gradient flex items-center justify-center text-primary-foreground font-bold">
            {incoming.callerAvatar}
          </motion.div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{incoming.callerName}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              {incoming.call_type === "video" ? <Video size={11} /> : <Phone size={11} />}
              Llamada entrante…
            </p>
          </div>
          <button onClick={reject} className="p-2.5 rounded-full bg-destructive text-destructive-foreground"><PhoneOff size={16} /></button>
          <button onClick={accept} className="p-2.5 rounded-full bg-green-600 text-white"><Phone size={16} /></button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IncomingCallToast;