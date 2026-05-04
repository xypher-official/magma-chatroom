import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Phone, Video, ArrowLeft, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWebRTCCall } from "@/hooks/useWebRTCCall";
import CallOverlay from "@/components/CallOverlay";
import LavaParticles from "@/components/LavaParticles";
import { toast } from "sonner";

interface Sched {
  id: string; host_id: string; title: string; description: string;
  scheduled_at: string; call_type: string; room_id: string;
}

const CallPage = () => {
  const { roomId } = useParams();
  const nav = useNavigate();
  const [me, setMe] = useState<string | null>(null);
  const [sched, setSched] = useState<Sched | null>(null);
  const [hostName, setHostName] = useState("");
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const call = useWebRTCCall(me ?? undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setMe(data.session?.user.id ?? null));
  }, []);

  useEffect(() => {
    if (!roomId) return;
    supabase.from("scheduled_calls").select("*").eq("room_id", roomId).maybeSingle()
      .then(async ({ data }) => {
        if (!data) return;
        setSched(data as Sched);
        const { data: p } = await supabase.from("profiles").select("user_id,display_name,avatar_initials,avatar_url").eq("user_id", (data as any).host_id).maybeSingle();
        if (p) { setHostName(p.display_name); setProfiles({ [p.user_id]: p }); }
      });
  }, [roomId]);

  const join = async (kind: "video" | "audio") => {
    if (!me || !sched) { toast.error("Sign in first"); return; }
    if (me === sched.host_id) { toast.info("You are the host — wait for someone to call you"); return; }
    await call.startCall(sched.host_id, kind);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <LavaParticles />
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
        <button onClick={() => nav("/")} className="absolute top-4 left-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft size={16} /> Back
        </button>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass-panel-strong rounded-3xl p-8 max-w-md w-full text-center magma-glow-intense">
          <div className="w-24 h-24 mx-auto rounded-full magma-gradient p-1 mb-5">
            <div className="w-full h-full rounded-full bg-card flex items-center justify-center text-3xl font-bold magma-gradient-text">
              🌋
            </div>
          </div>
          <h1 className="text-2xl font-bold magma-gradient-text">{sched?.title ?? "Magma Call"}</h1>
          {sched?.description && <p className="text-sm text-muted-foreground mt-2">{sched.description}</p>}
          {sched && (
            <p className="mt-3 text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Calendar size={12} /> {new Date(sched.scheduled_at).toLocaleString()}
            </p>
          )}
          {hostName && <p className="mt-1 text-sm text-foreground">Host: <strong>{hostName}</strong></p>}
          {!sched && <p className="text-sm text-muted-foreground">Loading call…</p>}

          <div className="flex gap-3 justify-center mt-7">
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => join("audio")} disabled={!sched || !me}
              className="flex-1 py-3 rounded-2xl bg-muted hover:bg-muted/70 text-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
              <Phone size={18} /> Audio
            </motion.button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => join("video")} disabled={!sched || !me}
              className="flex-1 py-3 rounded-2xl magma-gradient text-primary-foreground font-semibold magma-glow-sm flex items-center justify-center gap-2 disabled:opacity-50">
              <Video size={18} /> Video
            </motion.button>
          </div>
          {!me && <p className="text-xs text-muted-foreground mt-4">You need to be signed in to join.</p>}
        </motion.div>
      </div>
      {me && <CallOverlay call={call} profiles={profiles} myUserId={me} />}
    </div>
  );
};

export default CallPage;
