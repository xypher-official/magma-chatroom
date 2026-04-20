import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  callId: string;
  myUserId: string;
  peerId: string;
  peerName: string;
  initiator: boolean;
  callType: "audio" | "video";
  onEnd: () => void;
}

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const CallWindow = ({ callId, myUserId, peerId, peerName, initiator, callType, onEnd }: Props) => {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [status, setStatus] = useState(initiator ? "Llamando…" : "Conectando…");

  useEffect(() => {
    let cancelled = false;
    const send = async (signal_type: string, payload: any) => {
      await supabase.from("call_signals").insert({ call_id: callId, from_user: myUserId, to_user: peerId, signal_type, payload });
    };

    const setup = async () => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true, video: callType === "video",
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        localStreamRef.current = stream;
        if (localRef.current) localRef.current.srcObject = stream;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      } catch (e: any) {
        toast.error("Sin acceso a cámara/micrófono: " + e.message);
        onEnd(); return;
      }

      pc.onicecandidate = (e) => { if (e.candidate) send("ice", e.candidate.toJSON()); };
      pc.ontrack = (e) => {
        if (remoteRef.current) remoteRef.current.srcObject = e.streams[0];
        setStatus("Conectado");
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          toast.error("Conexión perdida");
          end();
        }
      };

      if (initiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await send("offer", { sdp: offer.sdp, type: offer.type });
        await supabase.from("calls").update({ status: "ringing" }).eq("id", callId);
      }

      const ch = supabase.channel(`call-${callId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "call_signals", filter: `call_id=eq.${callId}` }, async (p) => {
          const row = p.new as any;
          if (row.from_user === myUserId) return;
          if (row.signal_type === "offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(row.payload));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await send("answer", { sdp: answer.sdp, type: answer.type });
            await supabase.from("calls").update({ status: "active" }).eq("id", callId);
          } else if (row.signal_type === "answer") {
            await pc.setRemoteDescription(new RTCSessionDescription(row.payload));
            await supabase.from("calls").update({ status: "active" }).eq("id", callId);
          } else if (row.signal_type === "ice") {
            try { await pc.addIceCandidate(new RTCIceCandidate(row.payload)); } catch {}
          } else if (row.signal_type === "hangup") {
            end();
          }
        })
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    };

    const cleanupP = setup();

    return () => {
      cancelled = true;
      cleanupP.then((fn) => fn?.());
      pcRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId]);

  const end = async () => {
    await supabase.from("call_signals").insert({ call_id: callId, from_user: myUserId, to_user: peerId, signal_type: "hangup", payload: {} });
    await supabase.from("calls").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", callId);
    pcRef.current?.close();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    onEnd();
  };

  const toggleMute = () => {
    const tracks = localStreamRef.current?.getAudioTracks() ?? [];
    tracks.forEach((t) => t.enabled = !t.enabled);
    setMuted((m) => !m);
  };
  const toggleVideo = () => {
    const tracks = localStreamRef.current?.getVideoTracks() ?? [];
    tracks.forEach((t) => t.enabled = !t.enabled);
    setVideoOff((v) => !v);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] bg-black/95 flex flex-col">
      <div className="absolute top-3 left-1/2 -translate-x-1/2 glass-panel-strong px-4 py-1.5 rounded-full text-xs text-foreground z-10">
        {peerName} · {status}
      </div>
      <div className="flex-1 relative">
        <video ref={remoteRef} autoPlay playsInline className="w-full h-full object-cover bg-black" />
        {callType === "video" && (
          <video ref={localRef} autoPlay playsInline muted className="absolute bottom-24 right-4 w-28 h-40 sm:w-40 sm:h-56 object-cover rounded-xl border-2 border-primary/50 bg-black shadow-2xl" />
        )}
      </div>
      <div className="flex items-center justify-center gap-4 p-6 bg-gradient-to-t from-black to-transparent">
        <motion.button whileTap={{ scale: 0.9 }} onClick={toggleMute}
          className={`p-4 rounded-full ${muted ? "bg-destructive text-destructive-foreground" : "glass-panel-strong text-foreground"}`}>
          {muted ? <MicOff size={22} /> : <Mic size={22} />}
        </motion.button>
        {callType === "video" && (
          <motion.button whileTap={{ scale: 0.9 }} onClick={toggleVideo}
            className={`p-4 rounded-full ${videoOff ? "bg-destructive text-destructive-foreground" : "glass-panel-strong text-foreground"}`}>
            {videoOff ? <VideoOff size={22} /> : <VideoIcon size={22} />}
          </motion.button>
        )}
        <motion.button whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.05 }} onClick={end}
          className="p-5 rounded-full bg-destructive text-destructive-foreground magma-glow-sm">
          <PhoneOff size={24} />
        </motion.button>
      </div>
    </motion.div>
  );
};

export default CallWindow;