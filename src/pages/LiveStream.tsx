import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, Camera, Eye, Mic, MicOff, MonitorUp, Pause, Play, Radio, Send, Square, SwitchCamera, Video, Loader2, Share2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLiveIceServers, getLiveMedia, LiveSource, mediaErrorText } from "@/lib/liveRtc";

type Stream = { id: string; host_id: string; title: string; source: string; status: string; started_at: string };
type Chat = { id: string; user_id: string; content: string; created_at: string };
type Prof = { display_name: string; avatar_url: string | null; avatar_initials: string };

const SOURCES: { k: LiveSource; label: string; Icon: any }[] = [
  { k: "camera_front", label: "Cámara frontal", Icon: Camera },
  { k: "camera_back", label: "Cámara trasera", Icon: Video },
  { k: "screen", label: "Compartir pantalla", Icon: MonitorUp },
];

const useMe = () => {
  const [me, setMe] = useState<string | null | undefined>(undefined);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null)); }, []);
  return me;
};

// ---------- Setup screen (/live/new) ----------
const LiveSetup = ({ me }: { me: string }) => {
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [source, setSource] = useState<LiveSource>("camera_front");
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    try {
      const media = await getLiveMedia(source); // asks permissions first
      (window as any).__magmaLiveMedia = media;
      const { data, error } = await supabase.from("live_streams")
        .insert({ host_id: me, title: title.trim() || "Live en Magma 🌋", source, status: "live" }).select("id").single();
      if (error) throw error;
      nav(`/live/${data.id}`, { replace: true });
    } catch (e) { toast.error(mediaErrorText(e)); setBusy(false); }
  };
  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md glass-panel rounded-3xl border border-border p-6 space-y-5">
        <button onClick={() => nav(-1)} className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"><ArrowLeft size={16} /> Volver</button>
        <div className="flex items-center gap-2"><Radio className="text-destructive animate-pulse" /><h1 className="text-xl font-bold text-foreground">Iniciar LIVE</h1></div>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título de tu transmisión" maxLength={100} />
        <div className="grid grid-cols-3 gap-2">
          {SOURCES.map(({ k, label, Icon }) => (
            <button key={k} onClick={() => setSource(k)}
              className={`rounded-2xl border p-3 flex flex-col items-center gap-2 text-xs transition-all ${source === k ? "border-primary bg-primary/10 text-primary scale-[1.03]" : "border-border text-muted-foreground hover:text-foreground"}`}>
              <Icon size={22} /> {label}
            </button>
          ))}
        </div>
        <Button onClick={start} disabled={busy} className="w-full magma-gradient text-primary-foreground gap-2">
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Radio size={16} />} Empezar EN VIVO
        </Button>
        <p className="text-[11px] text-muted-foreground text-center">Se pedirán permisos de cámara, micrófono o pantalla.</p>
      </motion.div>
    </div>
  );
};

// ---------- Chat panel ----------
const LiveChat = ({ streamId, me, canModerate }: { streamId: string; me: string | null; canModerate: boolean }) => {
  const [msgs, setMsgs] = useState<Chat[]>([]);
  const [profs, setProfs] = useState<Record<string, Prof>>({});
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const loadProfs = useCallback(async (ids: string[]) => {
    const missing = ids.filter((i) => !profs[i]);
    if (!missing.length) return;
    const { data } = await supabase.from("profiles").select("user_id,display_name,avatar_url,avatar_initials").in("user_id", missing);
    setProfs((p) => { const n = { ...p }; (data ?? []).forEach((r: any) => (n[r.user_id] = r)); return n; });
  }, [profs]);

  useEffect(() => {
    supabase.from("live_chat_messages").select("*").eq("stream_id", streamId).order("created_at", { ascending: true }).limit(200)
      .then(({ data }) => { setMsgs((data as Chat[]) ?? []); loadProfs([...new Set((data ?? []).map((m: any) => m.user_id))]); });
    const ch = supabase.channel(`lchat-${streamId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "live_chat_messages", filter: `stream_id=eq.${streamId}` },
        (p) => { const m = p.new as Chat; setMsgs((c) => c.some((x) => x.id === m.id) ? c : [...c, m]); loadProfs([m.user_id]); })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "live_chat_messages" },
        (p) => setMsgs((c) => c.filter((x) => x.id !== (p.old as any).id)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const send = async () => {
    const c = text.trim();
    if (!c || !me) return;
    setText("");
    const { error } = await supabase.from("live_chat_messages").insert({ stream_id: streamId, user_id: me, content: c.slice(0, 500) });
    if (error) toast.error(error.message);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-4 py-3 border-b border-border text-sm font-semibold text-foreground">Chat en vivo</div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 scrollbar-magma">
        <AnimatePresence initial={false}>
          {msgs.map((m) => {
            const p = profs[m.user_id];
            return (
              <motion.div key={m.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="flex items-start gap-2 text-sm group">
                <div className="w-7 h-7 rounded-full magma-gradient overflow-hidden shrink-0 flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                  {p?.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : (p?.avatar_initials ?? "··")}
                </div>
                <div className="min-w-0 flex-1 break-words">
                  <span className="font-semibold text-primary mr-1.5">{p?.display_name ?? "…"}</span>
                  <span className="text-foreground">{m.content}</span>
                </div>
                {(canModerate || m.user_id === me) && (
                  <button onClick={() => supabase.from("live_chat_messages").delete().eq("id", m.id)}
                    className="opacity-0 group-hover:opacity-100 text-[10px] text-destructive">✕</button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        {msgs.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Sé el primero en comentar 🔥</p>}
        <div ref={endRef} />
      </div>
      <div className="p-2 border-t border-border flex gap-2" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
        <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={me ? "Escribe un comentario…" : "Inicia sesión para comentar"} disabled={!me} className="min-w-0" maxLength={500} />
        <Button size="icon" onClick={send} disabled={!me || !text.trim()} className="magma-gradient text-primary-foreground shrink-0"><Send size={16} /></Button>
      </div>
    </div>
  );
};

// ---------- Main page ----------
const LiveStream = () => {
  const { streamId } = useParams();
  const nav = useNavigate();
  const me = useMe();
  const [stream, setStream] = useState<Stream | null>(null);
  const [host, setHost] = useState<Prof | null>(null);
  const [viewers, setViewers] = useState(0);
  const [micOn, setMicOn] = useState(true);
  const [paused, setPaused] = useState(false);
  const [connState, setConnState] = useState<"connecting" | "live" | "waiting" | "ended">("connecting");
  const [source, setSource] = useState<LiveSource>("camera_front");
  const [elapsed, setElapsed] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const peers = useRef<Map<string, RTCPeerConnection>>(new Map());
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const viewerPc = useRef<RTCPeerConnection | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const myKey = useRef(crypto.randomUUID());

  const isHost = !!stream && !!me && stream.host_id === me;

  // Load stream row
  useEffect(() => {
    if (!streamId || streamId === "new") return;
    supabase.from("live_streams").select("*").eq("id", streamId).maybeSingle().then(({ data }) => {
      if (!data) { toast.error("Transmisión no encontrada"); nav("/social/videos"); return; }
      setStream(data as Stream);
      setSource(data.source as LiveSource);
      setPaused(data.status === "paused");
      if (data.status === "ended") setConnState("ended");
      supabase.from("profiles").select("display_name,avatar_url,avatar_initials").eq("user_id", data.host_id).maybeSingle()
        .then(({ data: p }) => setHost(p as Prof));
    });
    const ch = supabase.channel(`lstream-${streamId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "live_streams", filter: `id=eq.${streamId}` }, (p) => {
        const s = p.new as Stream;
        setStream(s); setPaused(s.status === "paused");
        if (s.status === "ended") setConnState("ended");
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [streamId, nav]);

  // Timer
  useEffect(() => {
    if (!stream) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - new Date(stream.started_at).getTime()) / 1000)), 1000);
    return () => clearInterval(t);
  }, [stream]);

  const send = (event: string, payload: any) => chanRef.current?.send({ type: "broadcast", event, payload });

  // ---------- HOST ----------
  const connectViewer = useCallback(async (viewerKey: string) => {
    const media = mediaRef.current;
    if (!media) return;
    peers.current.get(viewerKey)?.close();
    const pc = new RTCPeerConnection({ iceServers: await getLiveIceServers() });
    peers.current.set(viewerKey, pc);
    media.getTracks().forEach((t) => pc.addTrack(t, media));
    pc.onicecandidate = (e) => e.candidate && send("ice", { to: viewerKey, from: "host", c: e.candidate.toJSON() });
    pc.onconnectionstatechange = () => {
      if (["failed", "closed"].includes(pc.connectionState)) { pc.close(); peers.current.delete(viewerKey); }
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send("offer", { to: viewerKey, sdp: { type: offer.type, sdp: offer.sdp } });
  }, []);

  useEffect(() => {
    if (!isHost || !stream || stream.status === "ended") return;
    let cancelled = false;
    (async () => {
      let media: MediaStream | null = (window as any).__magmaLiveMedia ?? null;
      (window as any).__magmaLiveMedia = null;
      if (!media) {
        try { media = await getLiveMedia(stream.source as LiveSource); }
        catch (e) { toast.error(mediaErrorText(e)); return; }
      }
      if (cancelled) { media.getTracks().forEach((t) => t.stop()); return; }
      mediaRef.current = media;
      if (videoRef.current) { videoRef.current.srcObject = media; videoRef.current.muted = true; videoRef.current.play().catch(() => {}); }
      media.getVideoTracks()[0]?.addEventListener("ended", () => { if (stream.source === "screen") endLive(); });
      setConnState("live");

      const ch = supabase.channel(`live-${stream.id}`, { config: { presence: { key: "host" }, broadcast: { self: false } } });
      chanRef.current = ch;
      ch.on("broadcast", { event: "join" }, ({ payload }) => connectViewer(payload.from))
        .on("broadcast", { event: "answer" }, async ({ payload }) => {
          const pc = peers.current.get(payload.from);
          if (pc && pc.signalingState === "have-local-offer") await pc.setRemoteDescription(payload.sdp).catch(() => {});
        })
        .on("broadcast", { event: "ice" }, ({ payload }) => {
          if (payload.to !== "host") return;
          peers.current.get(payload.from)?.addIceCandidate(payload.c).catch(() => {});
        })
        .on("broadcast", { event: "leave" }, ({ payload }) => { peers.current.get(payload.from)?.close(); peers.current.delete(payload.from); })
        .on("presence", { event: "sync" }, () => {
          const st = ch.presenceState();
          setViewers(Object.keys(st).filter((k) => k !== "host").length);
        })
        .subscribe(async (s) => {
          if (s === "SUBSCRIBED") { await ch.track({ role: "host" }); send("host-ready", {}); }
        });
    })();
    return () => {
      cancelled = true;
      peers.current.forEach((p) => p.close()); peers.current.clear();
      mediaRef.current?.getTracks().forEach((t) => t.stop()); mediaRef.current = null;
      if (chanRef.current) { supabase.removeChannel(chanRef.current); chanRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, stream?.id]);

  const replaceVideo = async (newSource: LiveSource) => {
    try {
      const fresh = await getLiveMedia(newSource);
      const vt = fresh.getVideoTracks()[0];
      const old = mediaRef.current;
      if (!old || !vt) return;
      old.getVideoTracks().forEach((t) => { old.removeTrack(t); t.stop(); });
      old.addTrack(vt);
      fresh.getAudioTracks().forEach((t) => t.stop());
      vt.enabled = !paused;
      for (const pc of peers.current.values()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        await sender?.replaceTrack(vt).catch(() => {});
      }
      if (videoRef.current) videoRef.current.srcObject = old;
      setSource(newSource);
      await supabase.from("live_streams").update({ source: newSource }).eq("id", stream!.id);
      toast.success("Fuente cambiada");
    } catch (e) { toast.error(mediaErrorText(e)); }
  };

  const toggleMic = () => {
    const next = !micOn;
    mediaRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
  };

  const togglePause = async () => {
    const next = !paused;
    mediaRef.current?.getTracks().forEach((t) => (t.enabled = !next && (t.kind === "video" || micOn)));
    setPaused(next);
    await supabase.from("live_streams").update({ status: next ? "paused" : "live" }).eq("id", stream!.id);
  };

  const endLive = async () => {
    if (!stream) return;
    send("ended", {});
    await supabase.from("live_streams").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", stream.id);
    mediaRef.current?.getTracks().forEach((t) => t.stop());
    toast.success("🏁 Transmisión finalizada");
    nav("/social/videos");
  };

  // ---------- VIEWER ----------
  useEffect(() => {
    if (!stream || isHost || me === undefined || stream.status === "ended") return;
    const key = myKey.current;
    const ch = supabase.channel(`live-${stream.id}`, { config: { presence: { key }, broadcast: { self: false } } });
    chanRef.current = ch;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const askJoin = () => {
      send("join", { from: key });
      if (retry) clearTimeout(retry);
      retry = setTimeout(() => {
        const st = viewerPc.current?.connectionState;
        if (st !== "connected") { setConnState("waiting"); askJoin(); }
      }, 8000);
    };
    ch.on("broadcast", { event: "offer" }, async ({ payload }) => {
      if (payload.to !== key) return;
      viewerPc.current?.close();
      const pc = new RTCPeerConnection({ iceServers: await getLiveIceServers() });
      viewerPc.current = pc;
      pendingIce.current = [];
      pc.ontrack = (e) => {
        if (videoRef.current) { videoRef.current.srcObject = e.streams[0]; videoRef.current.play().catch(() => {}); }
      };
      pc.onicecandidate = (e) => e.candidate && send("ice", { to: "host", from: key, c: e.candidate.toJSON() });
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setConnState("live");
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") { setConnState("connecting"); askJoin(); }
      };
      await pc.setRemoteDescription(payload.sdp);
      for (const c of pendingIce.current) await pc.addIceCandidate(c).catch(() => {});
      pendingIce.current = [];
      const ans = await pc.createAnswer();
      await pc.setLocalDescription(ans);
      send("answer", { from: key, sdp: { type: ans.type, sdp: ans.sdp } });
    })
      .on("broadcast", { event: "ice" }, ({ payload }) => {
        if (payload.to !== key) return;
        const pc = viewerPc.current;
        if (pc?.remoteDescription) pc.addIceCandidate(payload.c).catch(() => {});
        else pendingIce.current.push(payload.c);
      })
      .on("broadcast", { event: "host-ready" }, () => askJoin())
      .on("broadcast", { event: "ended" }, () => setConnState("ended"))
      .on("presence", { event: "sync" }, () => {
        const st = ch.presenceState();
        setViewers(Object.keys(st).filter((k) => k !== "host").length);
      })
      .subscribe(async (s) => {
        if (s === "SUBSCRIBED") { await ch.track({ role: "viewer", user: me }); askJoin(); }
      });
    return () => {
      if (retry) clearTimeout(retry);
      send("leave", { from: key });
      viewerPc.current?.close(); viewerPc.current = null;
      supabase.removeChannel(ch); chanRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream?.id, isHost, me]);

  useEffect(() => { if (connState === "ended" && viewerPc.current) { viewerPc.current.close(); viewerPc.current = null; } }, [connState]);

  if (streamId === "new") {
    if (me === undefined) return <div className="min-h-[100dvh] flex items-center justify-center bg-background"><Loader2 className="animate-spin text-primary" /></div>;
    if (!me) { nav("/"); return null; }
    return <LiveSetup me={me} />;
  }
  if (!stream) return <div className="min-h-[100dvh] flex items-center justify-center bg-background"><Loader2 className="animate-spin text-primary" /></div>;

  const fmt = (s: number) => `${Math.floor(s / 3600) ? Math.floor(s / 3600) + ":" : ""}${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="h-[100dvh] bg-background flex flex-col lg:flex-row overflow-hidden">
      <div className="relative flex-1 min-h-0 bg-black flex items-center justify-center lg:basis-2/3">
        <video ref={videoRef} playsInline autoPlay muted={isHost}
          className={`w-full h-full object-contain ${isHost && source === "camera_front" ? "-scale-x-100" : ""}`} />

        {/* Top bar */}
        <div className="absolute top-0 inset-x-0 p-3 flex items-center gap-2 bg-gradient-to-b from-background/80 to-transparent" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
          <button onClick={() => nav("/social/videos")} className="p-2 rounded-full glass-panel text-foreground"><ArrowLeft size={18} /></button>
          <div className="w-8 h-8 rounded-full magma-gradient overflow-hidden flex items-center justify-center text-xs font-bold text-primary-foreground">
            {host?.avatar_url ? <img src={host.avatar_url} alt="" className="w-full h-full object-cover" /> : host?.avatar_initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">{stream.title}</p>
            <p className="text-[11px] text-muted-foreground truncate">{host?.display_name}</p>
          </div>
          {connState !== "ended" && (
            <span className={`px-2 py-1 rounded-md text-[11px] font-bold tracking-wider ${paused ? "bg-muted text-foreground" : "bg-destructive text-destructive-foreground animate-pulse"}`}>
              {paused ? "PAUSA" : "LIVE"} · {fmt(elapsed)}
            </span>
          )}
          <span className="px-2 py-1 rounded-md glass-panel text-[11px] text-foreground flex items-center gap-1"><Eye size={12} /> {viewers}</span>
          <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copiado"); }}
            className="p-2 rounded-full glass-panel text-foreground"><Share2 size={16} /></button>
        </div>

        {/* Overlays */}
        <AnimatePresence>
          {(connState !== "live" || paused) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-sm text-center px-6">
              {connState === "ended" ? (
                <><Square className="text-muted-foreground" size={36} /><p className="text-foreground font-semibold">La transmisión terminó</p>
                  <Button variant="outline" onClick={() => nav("/social/videos")}>Volver a MSocialVideos</Button></>
              ) : paused ? (
                <><Pause className="text-primary" size={36} /><p className="text-foreground font-semibold">Transmisión en pausa</p><p className="text-xs text-muted-foreground">Volverá en breve…</p></>
              ) : (
                <><Loader2 className="animate-spin text-primary" size={36} />
                  <p className="text-foreground font-semibold">{connState === "waiting" ? "Esperando al anfitrión…" : "Conectando al LIVE…"}</p></>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Host controls */}
        {isHost && connState !== "ended" && (
          <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 glass-panel rounded-full p-2 border border-border z-10">
            <button onClick={toggleMic} title="Micrófono"
              className={`p-3 rounded-full ${micOn ? "bg-muted text-foreground" : "bg-destructive text-destructive-foreground"}`}>
              {micOn ? <Mic size={18} /> : <MicOff size={18} />}
            </button>
            {source !== "screen" && (
              <button onClick={() => replaceVideo(source === "camera_front" ? "camera_back" : "camera_front")} title="Cambiar cámara"
                className="p-3 rounded-full bg-muted text-foreground"><SwitchCamera size={18} /></button>
            )}
            <button onClick={() => replaceVideo(source === "screen" ? "camera_front" : "screen")} title={source === "screen" ? "Usar cámara" : "Compartir pantalla"}
              className="p-3 rounded-full bg-muted text-foreground">{source === "screen" ? <Camera size={18} /> : <MonitorUp size={18} />}</button>
            <button onClick={togglePause} title={paused ? "Reanudar" : "Pausar"} className="p-3 rounded-full bg-muted text-foreground">
              {paused ? <Play size={18} /> : <Pause size={18} />}
            </button>
            <button onClick={endLive} className="px-4 py-3 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center gap-1.5">
              <Square size={14} /> Finalizar
            </button>
          </motion.div>
        )}
      </div>

      <div className="h-[40dvh] lg:h-full lg:w-96 border-t lg:border-t-0 lg:border-l border-border bg-card/60 min-h-0">
        <LiveChat streamId={stream.id} me={me ?? null} canModerate={isHost} />
      </div>
    </div>
  );
};

export default LiveStream;
