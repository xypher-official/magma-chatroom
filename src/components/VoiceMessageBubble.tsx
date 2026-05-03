import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

interface Props {
  url: string;
  isOwn: boolean;
}

const fmt = (s: number) => {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60); const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
};

const VoiceMessageBubble = ({ url, isOwn }: Props) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    const onTime = () => setProgress(a.currentTime);
    const onEnd = () => { setPlaying(false); setProgress(0); };
    const onMeta = () => setDuration(a.duration);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("ended", onEnd);
    a.addEventListener("loadedmetadata", onMeta);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("loadedmetadata", onMeta);
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current; if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); } else { a.pause(); setPlaying(false); }
  };

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 min-w-[180px] py-1">
      <button onClick={toggle} className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isOwn ? "bg-white/25" : "magma-gradient text-primary-foreground"}`}>
        {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`h-1.5 rounded-full overflow-hidden ${isOwn ? "bg-white/30" : "bg-muted"}`}>
          <div className={`h-full ${isOwn ? "bg-white" : "magma-gradient"}`} style={{ width: `${pct}%` }} />
        </div>
        <p className={`text-[10px] mt-1 font-mono ${isOwn ? "text-white/80" : "text-muted-foreground"}`}>
          {fmt(progress)} / {fmt(duration)}
        </p>
      </div>
      <audio ref={audioRef} src={url} preload="metadata" />
    </div>
  );
};

export default VoiceMessageBubble;