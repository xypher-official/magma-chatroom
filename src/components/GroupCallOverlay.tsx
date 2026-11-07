import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, PhoneOff, SwitchCamera, Users } from "lucide-react";
import type { Peer } from "@/hooks/useGroupCall";

interface Props {
  title: string;
  me: string;
  names: Record<string, string>;
  localStream: MediaStream | null;
  peers: Record<string, Peer>;
  video: boolean; muted: boolean; cameraOff: boolean;
  onMute: () => void; onCamera: () => void; onFlip: () => void; onLeave: () => void;
}

const Tile = ({ stream, name, local, state }: { stream: MediaStream | null; name: string; local?: boolean; state?: string }) => {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream; }, [stream]);
  const hasVideo = !!stream?.getVideoTracks().some((t) => t.enabled && t.readyState === "live");
  return (
    <div className="relative rounded-2xl overflow-hidden glass-panel-strong border border-border min-h-0 grid place-items-center">
      <video ref={ref} autoPlay playsInline muted={local}
        className={`absolute inset-0 w-full h-full object-cover ${local ? "scale-x-[-1]" : ""} ${hasVideo ? "" : "opacity-0"}`} />
      {!hasVideo && (
        <div className="w-16 h-16 rounded-full magma-gradient grid place-items-center text-xl font-bold text-primary-foreground">
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <span className="absolute bottom-2 left-2 rounded-full bg-background/70 px-2 py-0.5 text-[11px] text-foreground">
        {local ? "Tú" : name}{state && state !== "connected" ? ` · ${state === "connecting" || state === "new" ? "conectando…" : state}` : ""}
      </span>
    </div>
  );
};

const GroupCallOverlay = (p: Props) => {
  const list = Object.values(p.peers);
  const count = list.length + 1;
  const cols = count <= 1 ? "grid-cols-1" : count <= 4 ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4";
  const btn = "w-12 h-12 rounded-full grid place-items-center transition-transform active:scale-90";
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] bg-background flex flex-col pt-[env(safe-area-inset-top)] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="px-4 py-3 flex items-center gap-2 text-foreground">
        <Users size={16} className="text-primary" />
        <p className="text-sm font-semibold truncate flex-1">{p.title}</p>
        <span className="text-xs text-muted-foreground">{count}/8</span>
      </div>
      <div className={`flex-1 min-h-0 grid ${cols} auto-rows-fr gap-2 px-2`}>
        <Tile stream={p.localStream} name="Tú" local />
        {list.map((x) => <Tile key={x.userId} stream={x.stream} name={p.names[x.userId] ?? "?"} state={x.state} />)}
      </div>
      <div className="flex justify-center gap-3 pt-3">
        <button onClick={p.onMute} className={`${btn} ${p.muted ? "bg-destructive text-destructive-foreground" : "glass-panel-strong text-foreground"}`}>
          {p.muted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        {p.video && (<>
          <button onClick={p.onCamera} className={`${btn} ${p.cameraOff ? "bg-destructive text-destructive-foreground" : "glass-panel-strong text-foreground"}`}>
            {p.cameraOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>
          <button onClick={p.onFlip} className={`${btn} glass-panel-strong text-foreground`}><SwitchCamera size={20} /></button>
        </>)}
        <button onClick={p.onLeave} className={`${btn} bg-destructive text-destructive-foreground`}><PhoneOff size={20} /></button>
      </div>
    </motion.div>
  );
};

export default GroupCallOverlay;
