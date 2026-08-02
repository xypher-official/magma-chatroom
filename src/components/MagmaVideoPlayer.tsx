import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, RotateCcw,
  RotateCw, PictureInPicture2, Check, ExternalLink, Loader2,
} from "lucide-react";

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
};

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const FITS = [
  { key: "contain", label: "Fit" },
  { key: "cover", label: "Fill" },
] as const;

type Props = {
  src: string;
  poster?: string | null;
  title?: string;
  vertical?: boolean;
  autoPlay?: boolean;
  /** When set, shows a "Watch on MSocialVideos" button linking here (embed mode). */
  watchUrl?: string;
  className?: string;
};

export const MagmaVideoPlayer = ({
  src, poster, title, vertical, autoPlay, watchUrl, className,
}: Props) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const vidRef = useRef<HTMLVideoElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fs, setFs] = useState(false);
  const [showUi, setShowUi] = useState(true);
  const [settings, setSettings] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [fit, setFit] = useState<(typeof FITS)[number]["key"]>(vertical ? "contain" : "contain");
  const [hoverPct, setHoverPct] = useState<number | null>(null);

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  const poke = useCallback(() => {
    setShowUi(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!settings) setShowUi(false);
    }, 2600);
  }, [settings]);

  const toggle = useCallback(() => {
    const v = vidRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
    poke();
  }, [poke]);

  const seekBy = (d: number) => {
    const v = vidRef.current;
    if (!v) return;
    v.currentTime = Math.min(Math.max(0, v.currentTime + d), v.duration || 0);
    poke();
  };

  const seekTo = (ratio: number) => {
    const v = vidRef.current;
    if (!v || !v.duration) return;
    v.currentTime = Math.min(Math.max(0, ratio), 1) * v.duration;
  };

  const onBarPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seekTo(ratio);
  };

  const toggleFullscreen = async () => {
    const el = wrapRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) await el.requestFullscreen();
      else await document.exitFullscreen();
    } catch { /* noop */ }
  };

  const togglePip = async () => {
    const v = vidRef.current as any;
    if (!v) return;
    try {
      if ((document as any).pictureInPictureElement) await (document as any).exitPictureInPicture();
      else if (v.requestPictureInPicture) await v.requestPictureInPicture();
    } catch { /* noop */ }
  };

  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const v = vidRef.current;
    if (v) { v.playbackRate = speed; v.loop = loop; }
  }, [speed, loop]);

  // Keyboard shortcuts scoped to the player
  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case " ": case "k": e.preventDefault(); toggle(); break;
      case "ArrowRight": e.preventDefault(); seekBy(5); break;
      case "ArrowLeft": e.preventDefault(); seekBy(-5); break;
      case "m": setMuted((m) => !m); break;
      case "f": toggleFullscreen(); break;
      default: break;
    }
  };

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseMove={poke}
      onMouseLeave={() => { if (playing && !settings) setShowUi(false); }}
      onTouchStart={poke}
      className={`group relative w-full overflow-hidden bg-black outline-none select-none ${vertical ? "aspect-[9/16] max-h-[80vh] mx-auto" : "aspect-video"} ${className ?? ""}`}
    >
      <video
        ref={vidRef}
        src={src}
        poster={poster ?? undefined}
        playsInline
        autoPlay={autoPlay}
        muted={muted}
        className={`h-full w-full ${fit === "cover" ? "object-cover" : "object-contain"}`}
        onClick={toggle}
        onPlay={() => { setPlaying(true); poke(); }}
        onPause={() => { setPlaying(false); setShowUi(true); }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          setCurrent(v.currentTime);
          try {
            if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
          } catch { /* noop */ }
        }}
        onVolumeChange={(e) => { setVolume(e.currentTarget.volume); setMuted(e.currentTarget.muted); }}
      />

      {/* Loading */}
      {waiting && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Loader2 className="animate-spin text-primary" size={34} />
        </div>
      )}

      {/* Center play burst */}
      <AnimatePresence>
        {!playing && !waiting && (
          <motion.button
            key="big-play"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.3, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            onClick={toggle}
            aria-label="Play"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-16 w-16 rounded-full magma-gradient magma-glow-intense grid place-items-center text-primary-foreground"
          >
            <Play size={26} className="ml-0.5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <AnimatePresence>
        {(showUi || !playing) && (title || watchUrl) && (
          <motion.div
            key="top"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent p-3"
          >
            <p className="line-clamp-2 text-xs font-semibold text-primary-foreground/95 drop-shadow">{title}</p>
            {watchUrl && (
              <a
                href={watchUrl} target="_blank" rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full magma-gradient px-3 py-1.5 text-[11px] font-bold text-primary-foreground magma-glow-sm hover:brightness-110 transition"
              >
                <ExternalLink size={12} /> Watch On MSocialVideos
              </a>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings sheet */}
      <AnimatePresence>
        {settings && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            className="absolute bottom-16 right-3 z-20 w-52 rounded-xl glass-panel-strong p-2 text-xs text-primary-foreground shadow-2xl"
          >
            <p className="px-2 pb-1 pt-0.5 text-[10px] uppercase tracking-wider text-primary-foreground/60">Speed</p>
            <div className="grid grid-cols-3 gap-1">
              {SPEEDS.map((s) => (
                <button key={s} onClick={() => setSpeed(s)}
                  className={`rounded-lg py-1 ${speed === s ? "magma-gradient text-primary-foreground" : "bg-white/5 hover:bg-white/10"}`}>
                  {s}×
                </button>
              ))}
            </div>
            <p className="px-2 pb-1 pt-2 text-[10px] uppercase tracking-wider text-primary-foreground/60">Display</p>
            <div className="grid grid-cols-2 gap-1">
              {FITS.map((f) => (
                <button key={f.key} onClick={() => setFit(f.key)}
                  className={`rounded-lg py-1 ${fit === f.key ? "magma-gradient text-primary-foreground" : "bg-white/5 hover:bg-white/10"}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <button onClick={() => setLoop((l) => !l)}
              className="mt-2 flex w-full items-center justify-between rounded-lg bg-white/5 px-2 py-1.5 hover:bg-white/10">
              <span>Loop</span>
              {loop ? <Check size={13} className="text-primary" /> : <span className="text-primary-foreground/40">Off</span>}
            </button>
            <button onClick={togglePip}
              className="mt-1 flex w-full items-center justify-between rounded-lg bg-white/5 px-2 py-1.5 hover:bg-white/10">
              <span>Picture in picture</span><PictureInPicture2 size={13} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom controls */}
      <AnimatePresence>
        {(showUi || !playing) && (
          <motion.div
            key="bottom"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }}
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3 pb-2.5 pt-6"
          >
            {/* Progress */}
            <div
              className="relative mb-2 h-4 cursor-pointer"
              onPointerDown={onBarPointer}
              onPointerMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setHoverPct(((e.clientX - r.left) / r.width) * 100);
                if (e.buttons === 1) onBarPointer(e);
              }}
              onPointerLeave={() => setHoverPct(null)}
            >
              <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/20">
                <div className="h-full bg-white/30" style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }} />
              </div>
              <div className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full magma-gradient" style={{ width: `${pct}%` }} />
              {hoverPct !== null && (
                <>
                  <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/40" style={{ left: `${pct}%`, width: `${Math.max(0, hoverPct - pct)}%` }} />
                  <div className="absolute -top-6 -translate-x-1/2 rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-mono text-primary-foreground"
                    style={{ left: `${hoverPct}%` }}>
                    {fmt((hoverPct / 100) * duration)}
                  </div>
                </>
              )}
              <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary magma-glow-sm transition-transform group-hover:scale-125"
                style={{ left: `${pct}%` }} />
            </div>

            <div className="flex items-center gap-1.5 text-primary-foreground">
              <button onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="rounded-full p-1.5 hover:bg-white/10">
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button onClick={() => seekBy(-10)} aria-label="Back 10s" className="hidden rounded-full p-1.5 hover:bg-white/10 sm:block"><RotateCcw size={16} /></button>
              <button onClick={() => seekBy(10)} aria-label="Forward 10s" className="hidden rounded-full p-1.5 hover:bg-white/10 sm:block"><RotateCw size={16} /></button>

              <div className="group/vol flex items-center gap-1">
                <button onClick={() => setMuted((m) => !m)} aria-label="Mute" className="rounded-full p-1.5 hover:bg-white/10">
                  {muted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
                </button>
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={muted ? 0 : volume}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (vidRef.current) { vidRef.current.volume = v; vidRef.current.muted = v === 0; }
                    setVolume(v); setMuted(v === 0);
                  }}
                  aria-label="Volume"
                  className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/25 accent-primary transition-all duration-300 group-hover/vol:w-16 sm:w-14"
                />
              </div>

              <span className="ml-1 font-mono text-[11px] tabular-nums text-primary-foreground/85">
                {fmt(current)} <span className="text-primary-foreground/45">/ {fmt(duration)}</span>
              </span>

              <div className="ml-auto flex items-center gap-1">
                {speed !== 1 && <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold">{speed}×</span>}
                <button onClick={() => { setSettings((s) => !s); setShowUi(true); }} aria-label="Settings"
                  className={`rounded-full p-1.5 hover:bg-white/10 ${settings ? "text-primary" : ""}`}>
                  <Settings size={17} className={settings ? "rotate-90 transition-transform" : "transition-transform"} />
                </button>
                <button onClick={toggleFullscreen} aria-label="Fullscreen" className="rounded-full p-1.5 hover:bg-white/10">
                  {fs ? <Minimize size={17} /> : <Maximize size={17} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MagmaVideoPlayer;