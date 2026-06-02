import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { useWebRTCCall } from "@/hooks/useWebRTCCall";

type Call = ReturnType<typeof useWebRTCCall>;

interface Props {
  call: Call;
  profiles: Record<string, { display_name: string; avatar_initials: string; avatar_url?: string | null }>;
  myUserId: string;
}

const CallOverlay = ({ call, profiles, myUserId }: Props) => {
  const { t } = useI18n();
  const { state, incoming, active, muted, cameraOff, localVideoRef, remoteVideoRef,
    acceptCall, declineCall, hangup, toggleMute, toggleCamera } = call;
  const [elapsed, setElapsed] = useState(0);

  // Tick timer when active
  useEffect(() => {
    if (state !== "active") { setElapsed(0); return; }
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [state]);

  // Listen for join/leave events to toast participants
  useEffect(() => {
    if (!active) return;
    const ch = supabase.channel(`call-events-${active.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_events", filter: `call_id=eq.${active.id}` }, (p) => {
        const ev: any = p.new;
        if (ev.user_id === myUserId) return;
        const name = profiles[ev.user_id]?.display_name ?? "Someone";
        if (ev.event_type === "joined") toast.success(`📞 ${name} joined`);
        else if (ev.event_type === "left") toast.info(`👋 ${name} left`);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active, myUserId, profiles]);

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60); const r = s % 60;
    return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
  };

  if (state === "idle") return null;

  // Incoming call modal
  if (state === "ringing" && incoming) {
    const caller = profiles[incoming.callerId];
    return (
      <AnimatePresence>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.85, y: 30 }} animate={{ scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
            className="glass-panel-strong rounded-3xl p-8 max-w-sm w-full text-center magma-glow-intense">
            <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.4, repeat: Infinity }}
              className="mx-auto w-32 h-32 rounded-full magma-gradient p-1 mb-5">
              <div className="w-full h-full rounded-full bg-card flex items-center justify-center text-5xl font-bold magma-gradient-text overflow-hidden">
                {caller?.avatar_url
                  ? <img src={caller.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                  : <span>{caller?.avatar_initials ?? "??"}</span>}
              </div>
            </motion.div>
            <h2 className="text-2xl font-bold text-foreground">{caller?.display_name ?? "?"}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("call.incoming")} · {incoming.callType === "video" ? t("call.video") : t("call.audio")}
            </p>
            <div className="flex gap-4 justify-center mt-8">
              <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                onClick={declineCall}
                className="w-16 h-16 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg">
                <PhoneOff size={26} />
              </motion.button>
              <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                onClick={acceptCall}
                animate={{ boxShadow: ["0 0 0 0 hsl(142 76% 36% / 0.7)", "0 0 0 18px hsl(142 76% 36% / 0)"] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className="w-16 h-16 rounded-full bg-green-600 text-white flex items-center justify-center shadow-lg">
                <Phone size={26} />
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Active / outgoing call
  const otherId = active ? (active.callerId === myUserId ? active.calleeId : active.callerId) : null;
  const other = otherId ? profiles[otherId] : null;
  const isVideo = active?.callType === "video";

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black flex flex-col">
        {/* Remote video / fallback */}
        <div className="flex-1 relative overflow-hidden">
          {/* Remote stream sink — ALWAYS mounted so audio is heard even
              on audio-only calls. Hidden visually when not a video call. */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={isVideo
              ? "absolute inset-0 w-full h-full object-cover"
              : "absolute w-px h-px opacity-0 pointer-events-none"}
          />
          {!isVideo && other && (
            <div className="absolute inset-0 ember-bg flex flex-col items-center justify-center">
              <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}
                className="w-44 h-44 rounded-full magma-gradient p-1 magma-glow-intense">
                <div className="w-full h-full rounded-full bg-card flex items-center justify-center text-7xl font-bold magma-gradient-text overflow-hidden">
                  {other.avatar_url
                    ? <img src={other.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                    : <span>{other.avatar_initials}</span>}
                </div>
              </motion.div>
              <p className="text-3xl font-bold text-foreground mt-6">{other.display_name}</p>
              <p className="text-muted-foreground mt-2">
                {state === "calling" ? t("call.calling") : state === "active" ? t("call.connected") : "…"}
              </p>
              {state === "active" && (
                <p className="text-2xl font-mono mt-3 magma-gradient-text font-bold">{fmtTime(elapsed)}</p>
              )}
            </div>
          )}

          {/* Header bar with name */}
          {isVideo && other && (
            <div className="absolute top-0 inset-x-0 p-5 bg-gradient-to-b from-black/70 to-transparent">
              <p className="text-white font-semibold text-lg">{other.display_name}</p>
              <p className="text-white/70 text-xs flex items-center gap-2">
                <span>{state === "calling" ? t("call.calling") : state === "active" ? t("call.connected") : "…"}</span>
                {state === "active" && <span className="font-mono text-amber-300">{fmtTime(elapsed)}</span>}
              </p>
            </div>
          )}

          {/* Local PiP */}
          {isVideo && (
            <motion.div drag dragConstraints={{ left: -300, right: 300, top: -400, bottom: 0 }}
              className="absolute bottom-32 right-4 w-32 h-44 rounded-2xl overflow-hidden border-2 border-primary/40 shadow-2xl bg-card">
              <video ref={localVideoRef} autoPlay playsInline muted
                className={`w-full h-full object-cover ${cameraOff ? "opacity-0" : ""}`} />
              {cameraOff && (
                <div className="absolute inset-0 flex items-center justify-center bg-card text-muted-foreground">
                  <VideoOff size={28} />
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Controls */}
        <div className="p-6 flex justify-center gap-4 bg-gradient-to-t from-black to-black/0">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={toggleMute}
            className={`w-14 h-14 rounded-full flex items-center justify-center text-white ${muted ? "bg-white/20" : "bg-white/10"}`}>
            {muted ? <MicOff size={22} /> : <Mic size={22} />}
          </motion.button>
          {isVideo && (
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={toggleCamera}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-white ${cameraOff ? "bg-white/20" : "bg-white/10"}`}>
              {cameraOff ? <VideoOff size={22} /> : <Video size={22} />}
            </motion.button>
          )}
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={hangup}
            className="w-16 h-14 rounded-full flex items-center justify-center bg-destructive text-destructive-foreground shadow-lg">
            <PhoneOff size={24} />
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CallOverlay;