import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Play, Pause, Volume2, Volume1, VolumeX, Maximize, Minimize, Settings, RotateCcw,
  RotateCw, PictureInPicture2, Check, ExternalLink, Loader2, Gauge, Frame, Repeat,
  Sun, FlipHorizontal2, Camera, Download, Activity, Keyboard, ChevronLeft, Sparkles,
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

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const FITS = [
  { key: "contain", label: "Fit" },
  { key: "cover", label: "Fill" },
  { key: "fill", label: "Stretch" },
] as const;
type FitKey = (typeof FITS)[number]["key"];
type Panel = "root" | "speed" | "display" | "advanced" | "keys" | "stats";

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
  const tapRef = useRef<{ t: number; x: number }>({ t: 0, x: 0 });

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
  const [panel, setPanel] = useState<Panel>("root");
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [fit, setFit] = useState<FitKey>("contain");
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const [bright, setBright] = useState(100);
  const [mirror, setMirror] = useState(false);
  const [ambient, setAmbient] = useState(true);
  const [skipStep, setSkipStep] = useState(10);
  const [burst, setBurst] = useState<{ dir: -1 | 1; id: number } | null>(null);
  const [res, setRes] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  const poke = useCallback(() => {
    setShowUi(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!settings) setShowUi(false);
    }, 2800);
  }, [settings]);

  const toggle = useCallback(() => {
    const v = vidRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
    poke();
  }, [poke]);

  const seekBy = useCallback((d: number) => {
    const v = vidRef.current;
    if (!v) return;
    v.currentTime = Math.min(Math.max(0, v.currentTime + d), v.duration || 0);
    setBurst({ dir: d > 0 ? 1 : -1, id: Date.now() });
    poke();
  }, [poke]);

  const seekTo = (ratio: number) => {
    const v = vidRef.current;
    if (!v || !v.duration) return;
    v.currentTime = Math.min(Math.max(0, ratio), 1) * v.duration;
  };

  const onBarPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    seekTo((e.clientX - rect.left) / rect.width);
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

  const snapshot = () => {
    const v = vidRef.current;
    if (!v) return;
    try {
      const c = document.createElement("canvas");
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
      const a = document.createElement("a");
      a.href = c.toDataURL("image/png");
      a.download = `${(title || "frame").replace(/[^\w-]+/g, "_")}-${Math.round(v.currentTime)}s.png`;
      a.click();
    } catch { /* cross-origin frame */ }
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

  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(() => setBurst(null), 520);
    return () => clearTimeout(t);
  }, [burst]);

  // Keyboard shortcuts scoped to the player
  const onKeyDown = (e: React.KeyboardEvent) => {
    const v = vidRef.current;
    switch (e.key) {
      case " ": case "k": e.preventDefault(); toggle(); break;
      case "ArrowRight": e.preventDefault(); seekBy(skipStep); break;
      case "ArrowLeft": e.preventDefault(); seekBy(-skipStep); break;
      case "j": seekBy(-skipStep); break;
      case "l": seekBy(skipStep); break;
      case "ArrowUp": e.preventDefault(); if (v) { v.volume = Math.min(1, v.volume + 0.1); v.muted = false; } break;
      case "ArrowDown": e.preventDefault(); if (v) v.volume = Math.max(0, v.volume - 0.1); break;
      case "m": setMuted((m) => !m); break;
      case "f": toggleFullscreen(); break;
      case "p": togglePip(); break;
      case ">": setSpeed((s) => SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(s) + 1)] ?? s); break;
      case "<": setSpeed((s) => SPEEDS[Math.max(0, SPEEDS.indexOf(s) - 1)] ?? s); break;
      default:
        if (/^[0-9]$/.test(e.key)) seekTo(Number(e.key) / 10);
        break;
    }
    poke();
  };

  const onSurfacePointer = (e: React.PointerEvent) => {
    const now = Date.now();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (now - tapRef.current.t < 320 && Math.abs(x - tapRef.current.x) < 80) {
      seekBy(x < rect.width / 2 ? -skipStep : skipStep);
      tapRef.current = { t: 0, x: 0 };
      return;
    }
    tapRef.current = { t: now, x };
    setTimeout(() => {
      if (tapRef.current.t === now) toggle();
    }, 240);
  };

  const rowCls = "flex w-full items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2 text-left hover:bg-white/10 transition-colors";

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
      {/* Ambient glow */}
      {ambient && poster && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-8 scale-110 opacity-30 blur-3xl"
          style={{ backgroundImage: `url(${poster})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
      )}

      <video
        ref={vidRef}
        src={src}
        poster={poster ?? undefined}
        playsInline
        autoPlay={autoPlay}
        muted={muted}
        className={`relative h-full w-full ${fit === "cover" ? "object-cover" : fit === "fill" ? "object-fill" : "object-contain"}`}
        style={{ filter: `brightness(${bright}%)`, transform: mirror ? "scaleX(-1)" : undefined }}
        onPointerDown={onSurfacePointer}
        onPlay={() => { setPlaying(true); poke(); }}
        onPause={() => { setPlaying(false); setShowUi(true); }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration || 0);
          setRes({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight });
        }}
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

      {/* Double-tap seek burst */}
      <AnimatePresence>
        {burst && (
          <motion.div
            key={burst.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.15 }}
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${burst.dir < 0 ? "left-8" : "right-8"} flex items-center gap-1.5 rounded-full bg-black/60 px-4 py-2 text-xs font-bold text-primary-foreground backdrop-blur-md`}
          >
            {burst.dir < 0 ? <RotateCcw size={15} /> : <RotateCw size={15} />} {skipStep}s
          </motion.div>
        )}
      </AnimatePresence>

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
            className="absolute bottom-16 right-3 z-20 w-[17rem] max-h-[70%] overflow-y-auto scrollbar-magma rounded-2xl glass-panel-strong p-2 text-xs text-primary-foreground shadow-2xl"
          >
            {panel !== "root" && (
              <button onClick={() => setPanel("root")} className="mb-1 flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-primary-foreground/70 hover:text-primary-foreground">
                <ChevronLeft size={13} /> Back
              </button>
            )}

            {panel === "root" && (
              <div className="space-y-1">
                <button className={rowCls} onClick={() => setPanel("speed")}>
                  <span className="flex items-center gap-2"><Gauge size={14} /> Playback speed</span>
                  <span className="text-primary-foreground/60">{speed}×</span>
                </button>
                <button className={rowCls} onClick={() => setPanel("display")}>
                  <span className="flex items-center gap-2"><Frame size={14} /> Display</span>
                  <span className="text-primary-foreground/60">{FITS.find((f) => f.key === fit)?.label}</span>
                </button>
                <button className={rowCls} onClick={() => setPanel("advanced")}>
                  <span className="flex items-center gap-2"><Sparkles size={14} /> Advanced</span>
                  <span className="text-primary-foreground/60">{skipStep}s</span>
                </button>
                <button className={rowCls} onClick={() => setLoop((l) => !l)}>
                  <span className="flex items-center gap-2"><Repeat size={14} /> Loop</span>
                  {loop ? <Check size={14} className="text-primary" /> : <span className="text-primary-foreground/40">Off</span>}
                </button>
                <button className={rowCls} onClick={togglePip}>
                  <span className="flex items-center gap-2"><PictureInPicture2 size={14} /> Picture in picture</span>
                </button>
                <button className={rowCls} onClick={snapshot}>
                  <span className="flex items-center gap-2"><Camera size={14} /> Capture frame</span>
                </button>
                <a className={rowCls} href={src} download target="_blank" rel="noopener noreferrer">
                  <span className="flex items-center gap-2"><Download size={14} /> Download video</span>
                </a>
                <button className={rowCls} onClick={() => setPanel("stats")}>
                  <span className="flex items-center gap-2"><Activity size={14} /> Stats</span>
                </button>
                <button className={rowCls} onClick={() => setPanel("keys")}>
                  <span className="flex items-center gap-2"><Keyboard size={14} /> Shortcuts</span>
                </button>
              </div>
            )}

            {panel === "speed" && (
              <div className="grid grid-cols-3 gap-1">
                {SPEEDS.map((s) => (
                  <button key={s} onClick={() => setSpeed(s)}
                    className={`rounded-lg py-1.5 font-semibold ${speed === s ? "magma-gradient text-primary-foreground" : "bg-white/5 hover:bg-white/10"}`}>
                    {s}×
                  </button>
                ))}
              </div>
            )}

            {panel === "display" && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-1">
                  {FITS.map((f) => (
                    <button key={f.key} onClick={() => setFit(f.key)}
                      className={`rounded-lg py-1.5 ${fit === f.key ? "magma-gradient text-primary-foreground" : "bg-white/5 hover:bg-white/10"}`}>
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="rounded-xl bg-white/5 px-3 py-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-2"><Sun size={13} /> Brightness</span>
                    <span className="text-primary-foreground/60">{bright}%</span>
                  </div>
                  <input type="range" min={40} max={180} step={5} value={bright}
                    onChange={(e) => setBright(Number(e.target.value))}
                    className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/25 accent-primary" />
                </div>
                <button className={rowCls} onClick={() => setMirror((m) => !m)}>
                  <span className="flex items-center gap-2"><FlipHorizontal2 size={14} /> Mirror</span>
                  {mirror ? <Check size={14} className="text-primary" /> : <span className="text-primary-foreground/40">Off</span>}
                </button>
                <button className={rowCls} onClick={() => setAmbient((a) => !a)}>
                  <span className="flex items-center gap-2"><Sparkles size={14} /> Ambient glow</span>
                  {ambient ? <Check size={14} className="text-primary" /> : <span className="text-primary-foreground/40">Off</span>}
                </button>
              </div>
            )}

            {panel === "advanced" && (
              <div className="space-y-2">
                <p className="px-2 text-[10px] uppercase tracking-wider text-primary-foreground/60">Skip step</p>
                <div className="grid grid-cols-4 gap-1">
                  {[5, 10, 15, 30].map((s) => (
                    <button key={s} onClick={() => setSkipStep(s)}
                      className={`rounded-lg py-1.5 ${skipStep === s ? "magma-gradient text-primary-foreground" : "bg-white/5 hover:bg-white/10"}`}>
                      {s}s
                    </button>
                  ))}
                </div>
                <button className={rowCls} onClick={() => { setSpeed(1); setBright(100); setMirror(false); setFit("contain"); setLoop(false); setSkipStep(10); }}>
                  <span>Reset all settings</span>
                </button>
              </div>
            )}

            {panel === "stats" && (
              <div className="space-y-1 px-2 py-1 font-mono text-[11px] text-primary-foreground/80">
                <p>Resolution: {res.w}×{res.h || "–"}</p>
                <p>Duration: {fmt(duration)}</p>
                <p>Position: {fmt(current)}</p>
                <p>Buffered: {fmt(buffered)}</p>
                <p>Rate: {speed}×</p>
                <p>Volume: {Math.round((muted ? 0 : volume) * 100)}%</p>
              </div>
            )}

            {panel === "keys" && (
              <div className="space-y-1 px-2 py-1 text-[11px] text-primary-foreground/80">
                {[["Space / K", "Play / pause"], ["J / L", "Skip back / forward"], ["← / →", "Seek"], ["↑ / ↓", "Volume"], ["M", "Mute"], ["F", "Fullscreen"], ["P", "Picture in picture"], ["< / >", "Speed"], ["0-9", "Jump to %"]].map(([k, d]) => (
                  <div key={k} className="flex items-center justify-between gap-2">
                    <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono">{k}</span>
                    <span className="text-primary-foreground/60">{d}</span>
                  </div>
                ))}
              </div>
            )}
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
              <button onClick={() => seekBy(-skipStep)} aria-label={`Back ${skipStep}s`} className="hidden rounded-full p-1.5 hover:bg-white/10 sm:block"><RotateCcw size={16} /></button>
              <button onClick={() => seekBy(skipStep)} aria-label={`Forward ${skipStep}s`} className="hidden rounded-full p-1.5 hover:bg-white/10 sm:block"><RotateCw size={16} /></button>

              <div className="group/vol flex items-center gap-1">
                <button onClick={() => setMuted((m) => !m)} aria-label="Mute" className="rounded-full p-1.5 hover:bg-white/10">
                  {muted || volume === 0 ? <VolumeX size={17} /> : volume < 0.5 ? <Volume1 size={17} /> : <Volume2 size={17} />}
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
                <button onClick={togglePip} aria-label="Picture in picture" className="hidden rounded-full p-1.5 hover:bg-white/10 sm:block">
                  <PictureInPicture2 size={16} />
                </button>
                <button onClick={() => { setSettings((s) => !s); setPanel("root"); setShowUi(true); }} aria-label="Settings"
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
