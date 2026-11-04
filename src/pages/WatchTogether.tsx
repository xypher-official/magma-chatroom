import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DOMPurify from "dompurify";
import { ArrowLeft, Crown, Lock, Loader2, Play, Pause, Settings2, Power, Volume2, VolumeX, RotateCcw, RotateCw, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Session = {
  id: string; host_id: string; source_type: string; source: string; title: string;
  is_playing: boolean; position: number; position_at: string; rate: number; active: boolean;
};

const ytId = (u: string) => {
  const m = u.match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/);
  return m ? m[1] : /^[\w-]{11}$/.test(u) ? u : null;
};

const expected = (s: Session) =>
  s.is_playing ? s.position + ((Date.now() - new Date(s.position_at).getTime()) / 1000) * s.rate : s.position;

let ytLoading: Promise<void> | null = null;
const loadYT = () => {
  if ((window as any).YT?.Player) return Promise.resolve();
  if (!ytLoading) ytLoading = new Promise((res) => {
    (window as any).onYouTubeIframeAPIReady = () => res();
    const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; document.body.appendChild(s);
  });
  return ytLoading;
};

// Unified player adapter
interface Adapter { get: () => number; seek: (t: number) => void; play: () => void; pause: () => void; setRate: (r: number) => void; playing: () => boolean }

const WatchTogether = () => {
  const { sessionId } = useParams();
  const nav = useNavigate();
  const [me, setMe] = useState<string | null>(null);
  const [s, setS] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [newSrc, setNewSrc] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const ytBox = useRef<HTMLDivElement>(null);
  const ytPlayer = useRef<any>(null);
  const adapter = useRef<Adapter | null>(null);
  const sRef = useRef<Session | null>(null);
  sRef.current = s;
  const isHost = !!s && s.host_id === me;
  const [accepted, setAccepted] = useState(false);
  const [guestsAccepted, setGuestsAccepted] = useState(0);
  const roomRef = useRef<any>(null);
  useEffect(() => {
    if (!me || !sessionId) return;
    const room = supabase.channel(`watch-room-${sessionId}`, { config: { presence: { key: me } } });
    room.on("presence", { event: "sync" }, () => {
      const st = room.presenceState() as Record<string, any[]>;
      setGuestsAccepted(Object.entries(st).filter(([k, v]) => k !== sRef.current?.host_id && v.some((x) => x.accepted)).length);
    }).subscribe((status) => { if (status === "SUBSCRIBED") room.track({ accepted: false }); });
    roomRef.current = room;
    return () => { supabase.removeChannel(room); };
  }, [me, sessionId]);
  const acceptInvite = () => { setAccepted(true); roomRef.current?.track({ accepted: true }); toast.success("Invitación aceptada 🎬"); };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
    supabase.from("watch_sessions").select("*").eq("id", sessionId!).maybeSingle()
      .then(({ data }) => { setS(data as any); setLoading(false); });
    const ch = supabase.channel(`watch-${sessionId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "watch_sessions", filter: `id=eq.${sessionId}` },
        (p) => setS(p.new as any))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId]);

  // Host writes state
  const push = async (patch: Partial<Session>) => {
    const a = adapter.current; const cur = sRef.current; if (!cur) return;
    const body = { position: a?.get() ?? cur.position, position_at: new Date().toISOString(), ...patch };
    setS({ ...cur, ...body } as Session);
    await supabase.from("watch_sessions").update(body).eq("id", cur.id);
  };

  // Set up YouTube player
  const vid = s?.source_type === "youtube" ? ytId(s.source) : null;
  useEffect(() => {
    if (!vid || !ytBox.current || me === null) return;
    let destroyed = false;
    loadYT().then(() => {
      if (destroyed || !ytBox.current) return;
      const host = sRef.current?.host_id === me;
      ytBox.current.innerHTML = "<div></div>";
      ytPlayer.current = new (window as any).YT.Player(ytBox.current.firstChild, {
        videoId: vid, width: "100%", height: "100%",
        playerVars: { controls: host ? 1 : 0, disablekb: host ? 0 : 1, modestbranding: 1, rel: 0, playsinline: 1, mute: host ? 0 : 1 },
        events: {
          onReady: () => {
            const p = ytPlayer.current;
            adapter.current = {
              get: () => p.getCurrentTime?.() ?? 0, seek: (t) => p.seekTo(t, true),
              play: () => p.playVideo(), pause: () => p.pauseVideo(), setRate: (r) => p.setPlaybackRate(r),
              playing: () => p.getPlayerState?.() === 1,
            };
            if (host) setMuted(false);
          },
          onStateChange: (e: any) => {
            if (sRef.current?.host_id !== me) return;
            if (e.data === 1) push({ is_playing: true });
            if (e.data === 2) push({ is_playing: false });
          },
        },
      });
    });
    return () => { destroyed = true; try { ytPlayer.current?.destroy(); } catch {} adapter.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vid, me]);

  // HTML5 video adapter
  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    adapter.current = {
      get: () => v.currentTime, seek: (t) => { v.currentTime = t; },
      play: () => { v.play().catch(() => {}); }, pause: () => v.pause(), setRate: (r) => { v.playbackRate = r; },
      playing: () => !v.paused,
    };
  }, [s?.source_type, s?.source]);

  // Viewers follow host
  useEffect(() => {
    if (!s || isHost) return;
    const tick = () => {
      const a = adapter.current, cur = sRef.current; if (!a || !cur) return;
      const want = expected(cur);
      if (Math.abs(a.get() - want) > 1.5) a.seek(want);
      a.setRate(cur.rate);
      if (cur.is_playing && !a.playing()) a.play();
      if (!cur.is_playing && a.playing()) a.pause();
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [s, isHost]);

  // Host heartbeat
  useEffect(() => {
    if (!isHost) return;
    const i = setInterval(() => { if (sRef.current?.is_playing) push({}); }, 5000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
    try { muted ? ytPlayer.current?.mute() : ytPlayer.current?.unMute(); } catch {}
  }, [muted]);

  if (loading) return <div className="min-h-dvh grid place-items-center bg-background"><Loader2 className="animate-spin text-primary" /></div>;
  if (!s) return <div className="min-h-dvh grid place-items-center bg-background text-muted-foreground text-sm">Sesión no disponible</div>;

  const a = adapter.current;
  const seekBy = (d: number) => { if (!a) return; a.seek(Math.max(0, a.get() + d)); push({}); };
  const togglePlay = () => { if (!a) return; if (!s.is_playing && guestsAccepted === 0) { toast("Espera a que la otra persona acepte la invitación ⏳"); return; } s.is_playing ? a.pause() : a.play(); push({ is_playing: !s.is_playing }); };

  return (
    <main className="min-h-dvh bg-background flex flex-col">
      <header className="flex items-center gap-3 px-4 py-3 glass-panel border-b border-border pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button onClick={() => nav(-1)} className="p-2 rounded-xl hover:bg-muted text-foreground"><ArrowLeft size={18} /></button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-foreground">{s.title}</h1>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {isHost ? <><Crown size={11} className="text-primary" /> Tú controlas el video</> : <><Lock size={11} /> Solo el anfitrión controla</>}
          </p>
        </div>
        <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Enlace copiado"); }}
          className="p-2 rounded-xl hover:bg-muted text-muted-foreground"><Copy size={16} /></button>
      </header>

      <div className="flex-1 flex items-center justify-center p-2 sm:p-6">
        <div className="relative w-full max-w-5xl aspect-video rounded-2xl overflow-hidden bg-muted border border-border">
          {!s.active ? (
            <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">El Watch Together terminó</div>
          ) : s.source_type === "youtube" ? (
            <div ref={ytBox} className="absolute inset-0 [&_iframe]:w-full [&_iframe]:h-full" />
          ) : s.source_type === "embed" ? (
            <div className="absolute inset-0 [&_iframe]:w-full [&_iframe]:h-full"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(s.source, { ADD_TAGS: ["iframe"], ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "src"] }) }} />
          ) : (
            <video ref={videoRef} src={s.source} playsInline muted={muted} controls={isHost}
              onPlay={() => isHost && !s.is_playing && push({ is_playing: true })}
              onPause={() => isHost && s.is_playing && push({ is_playing: false })}
              onSeeked={() => isHost && push({})}
              className="absolute inset-0 w-full h-full object-contain bg-background" />
          )}
          {!isHost && s.active && !accepted && (
            <div className="absolute inset-0 z-20 grid place-items-center bg-background/90 backdrop-blur p-4 text-center">
              <div className="space-y-3">
                <p className="text-sm text-foreground">Te invitaron a ver <b>{s.title}</b> juntos 🍿</p>
                <div className="flex justify-center gap-2">
                  <button onClick={acceptInvite} className="rounded-xl magma-gradient px-4 py-2 text-sm text-primary-foreground">Aceptar</button>
                  <button onClick={() => nav(-1)} className="rounded-xl glass-panel-strong px-4 py-2 text-sm text-foreground">Rechazar</button>
                </div>
              </div>
            </div>
          )}
          {isHost && s.active && guestsAccepted === 0 && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 rounded-full glass-panel-strong px-3 py-1 text-xs text-foreground flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Esperando que acepten la invitación…</div>
          )}
          {!isHost && s.active && <div className="absolute inset-0 z-10" onClick={() => toast("Solo el anfitrión puede controlar el video 🔒")} />}
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button onClick={() => setMuted((m) => !m)} className="flex items-center gap-1.5 rounded-xl glass-panel-strong px-3 py-2 text-xs text-foreground">
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />} {muted ? "Activar sonido" : "Silenciar"}
        </button>
        {isHost && s.active && s.source_type !== "embed" && (
          <>
            <button onClick={() => seekBy(-10)} className="rounded-xl glass-panel-strong p-2 text-foreground"><RotateCcw size={16} /></button>
            <button onClick={togglePlay} className="rounded-xl magma-gradient p-2.5 text-primary-foreground">{s.is_playing ? <Pause size={18} /> : <Play size={18} />}</button>
            <button onClick={() => seekBy(10)} className="rounded-xl glass-panel-strong p-2 text-foreground"><RotateCw size={16} /></button>
          </>
        )}
        {isHost && (
          <>
            <button onClick={() => setShowSettings((v) => !v)} className="flex items-center gap-1.5 rounded-xl glass-panel-strong px-3 py-2 text-xs text-foreground"><Settings2 size={14} /> Ajustes</button>
            {s.active && <button onClick={() => push({ active: false, is_playing: false })} className="flex items-center gap-1.5 rounded-xl bg-destructive px-3 py-2 text-xs text-destructive-foreground"><Power size={14} /> Terminar</button>}
          </>
        )}
      </footer>

      {isHost && showSettings && (
        <div className="mx-auto mb-4 w-full max-w-md rounded-2xl glass-panel border border-border p-4 space-y-3">
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Velocidad</p>
            <div className="flex flex-wrap gap-1.5">
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                <button key={r} onClick={() => { adapter.current?.setRate(r); push({ rate: r }); }}
                  className={`rounded-lg px-2.5 py-1 text-xs ${s.rate === r ? "magma-gradient text-primary-foreground" : "bg-muted text-foreground"}`}>{r}x</button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Cambiar video (YouTube o URL)</p>
            <div className="flex gap-2">
              <input value={newSrc} onChange={(e) => setNewSrc(e.target.value)} placeholder="https://..."
                className="flex-1 min-w-0 rounded-xl bg-muted px-3 py-2 text-xs text-foreground outline-none" />
              <button onClick={() => {
                const v = newSrc.trim(); if (!v) return;
                push({ source: v, source_type: ytId(v) && /youtu/.test(v) ? "youtube" : "url", position: 0, is_playing: false, active: true });
                setNewSrc("");
              }} className="rounded-xl magma-gradient px-3 text-xs font-semibold text-primary-foreground">Cambiar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default WatchTogether;
