import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Lock, User as UserIcon, Eye, EyeOff, Shield, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import LavaParticles from "@/components/LavaParticles";
import { useLocationShare } from "@/hooks/useLocationShare";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const meIcon = L.divIcon({
  className: "",
  html: `<div style="width:24px;height:24px;border-radius:9999px;background:linear-gradient(135deg,#f97316,#ef4444);border:3px solid white;box-shadow:0 0 14px rgba(249,115,22,0.8)"></div>`,
  iconSize: [24, 24], iconAnchor: [12, 12],
});
const themIcon = L.divIcon({
  className: "",
  html: `<div style="width:24px;height:24px;border-radius:9999px;background:linear-gradient(135deg,#06b6d4,#3b82f6);border:3px solid white;box-shadow:0 0 14px rgba(59,130,246,0.8)"></div>`,
  iconSize: [24, 24], iconAnchor: [12, 12],
});

const usernameToEmail = (u: string) =>
  `${u.toLowerCase().replace(/[^a-z0-9_]/g, "")}@magmachat.local`;

type Stage = "loading" | "login" | "confirm" | "map";

interface Ping { lat: number; lng: number; accuracy?: number | null; created_at: string }

const SharedLocationPage = () => {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("loading");
  const [sharerProfile, setSharerProfile] = useState<any>(null);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  // login form
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  // map data
  const [pings, setPings] = useState<{ uid: string; name: string; isMe: boolean; lat: number; lng: number; acc?: number | null }[]>([]);
  const myLoc = useLocationShare(myUserId ?? undefined);

  // Load sharer profile (public)
  useEffect(() => {
    if (!shareId) { setStage("login"); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        const session = data?.session;
        if (!session) { setStage("login"); return; }
        setMyUserId(session.user.id);
        await afterLogin(session.user.id);
      } catch (e) {
        console.error("share boot error", e);
        if (!cancelled) setStage("login");
      }
    })();
    // Hard safety: never get stuck on the spinner for more than 6s
    const safety = setTimeout(() => {
      setStage((s) => (s === "loading" ? "login" : s));
    }, 6000);
    return () => { cancelled = true; clearTimeout(safety); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareId]);

  const afterLogin = async (uid: string) => {
    try {
      const { data: share, error } = await supabase
        .from("location_shares")
        .select("user_id, active, conversation_id, group_id")
        .eq("id", shareId!)
        .maybeSingle();
      if (error) console.warn("share fetch", error);
      const { data: me } = await supabase.from("profiles")
        .select("user_id, display_name, username, avatar_initials, avatar_url")
        .eq("user_id", uid).maybeSingle();
      setMyProfile(me);
      if (!share) {
        // RLS may hide it (viewer not in conversation). Still show confirm with generic sharer.
        setSharerProfile({ display_name: "alguien", username: "?", avatar_initials: "??" });
        setStage("confirm");
        return;
      }
      const { data: sharer } = await supabase.from("profiles")
        .select("user_id, display_name, username, avatar_initials, avatar_url, is_verified")
        .eq("user_id", share.user_id).maybeSingle();
      setSharerProfile(sharer ?? { display_name: "alguien", username: "?", avatar_initials: "??" });
      setStage("confirm");
    } catch (e) {
      console.error("afterLogin error", e);
      setStage("confirm");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const email = usernameToEmail(username.trim());
      const { error, data } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) {
        setMyUserId(data.user.id);
        await afterLogin(data.user.id);
      }
    } catch (err: any) {
      toast.error(err.message ?? "Login failed");
    } finally { setLoading(false); }
  };

  const confirmIdentity = async () => {
    setStage("map");
    // Always start sharing my own location so the map has at least one ping
    // even when RLS hides the share row from the viewer.
    if (myUserId && shareId) {
      try {
        const { data: share } = await supabase.from("location_shares")
          .select("conversation_id, group_id")
          .eq("id", shareId).maybeSingle();
        await myLoc.start({
          duration: "1h",
          conversationId: share?.conversation_id ?? undefined,
          groupId: share?.group_id ?? undefined,
        });
      } catch (e) {
        console.warn("could not bind to share, sharing anyway", e);
        await myLoc.start({ duration: "1h" });
      }
    }
  };

  // Load pings + subscribe (map stage)
  useEffect(() => {
    if (stage !== "map" || !shareId) return;
    // Local fallback: if RLS or empty pings keep the map blank, at least show
    // my own browser geolocation so the user always sees a map.
    let geoId: number | null = null;
    if (navigator.geolocation) {
      geoId = navigator.geolocation.watchPosition((pos) => {
        setPings((prev) => {
          const others = prev.filter((p) => !p.isMe);
          return [...others, { uid: "me-local", name: "Tú", isMe: true,
            lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy }];
        });
      }, () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
    }
    const refresh = async () => {
      const { data: share } = await supabase.from("location_shares")
        .select("conversation_id, group_id, user_id")
        .eq("id", shareId).maybeSingle();
      if (!share) return; // keep local pings only
      let q = supabase.from("location_shares").select("id, user_id").eq("active", true);
      if (share.conversation_id) q = q.eq("conversation_id", share.conversation_id);
      else if (share.group_id) q = q.eq("group_id", share.group_id);
      const { data: shares } = await q;
      if (!shares) return;
      const items = await Promise.all(shares.map(async (s) => {
        const { data: p } = await supabase.from("location_pings")
          .select("lat,lng,accuracy,created_at").eq("share_id", s.id)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        const { data: pr } = await supabase.from("profiles")
          .select("display_name").eq("user_id", s.user_id).maybeSingle();
        if (!p) return null;
        return { uid: s.user_id, name: pr?.display_name ?? "?", isMe: s.user_id === myUserId,
          lat: (p as Ping).lat, lng: (p as Ping).lng, acc: (p as Ping).accuracy };
      }));
      const remote = items.filter(Boolean) as any[];
      // Merge with any local-only "me" marker if there is no remote one for me
      setPings((prev) => {
        const localMe = prev.find((p) => p.uid === "me-local");
        const hasRemoteMe = remote.some((p) => p.isMe);
        return hasRemoteMe || !localMe ? remote : [...remote, localMe];
      });
    };
    refresh();
    const ch = supabase.channel(`shared-${shareId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "location_pings" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "location_shares" }, refresh)
      .subscribe();
    const iv = setInterval(refresh, 8000);
    return () => {
      supabase.removeChannel(ch); clearInterval(iv);
      if (geoId !== null && navigator.geolocation) navigator.geolocation.clearWatch(geoId);
    };
  }, [stage, shareId, myUserId]);

  if (stage === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
        <LavaParticles />
        <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 360] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-16 h-16 rounded-full magma-gradient flex items-center justify-center">
          <MapPin className="text-white" size={28} />
        </motion.div>
      </div>
    );
  }

  if (stage === "login") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background relative overflow-hidden">
        <LavaParticles />
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md glass-panel-strong rounded-3xl p-7 border border-primary/20 relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl magma-gradient flex items-center justify-center magma-glow-sm">
              <MapPin className="text-white" size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold magma-gradient-text">Live location</h1>
              <p className="text-xs text-muted-foreground">Inicia sesión para ver la ubicación</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
            Alguien compartió su ubicación contigo. Para protegerla,
            necesitas iniciar sesión en tu cuenta de Magma Chat Room.
          </p>
          <form onSubmit={handleLogin} className="space-y-3">
            <div className="relative">
              <UserIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={username} onChange={(e) => setUsername(e.target.value)}
                required autoComplete="username" placeholder="Nickname"
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type={showPwd ? "text" : "password"} value={password}
                onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password"
                placeholder="Contraseña"
                className="w-full pl-11 pr-11 py-3.5 rounded-2xl bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
              <button type="button" onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground">
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-2xl magma-gradient text-primary-foreground font-bold magma-glow disabled:opacity-60">
              {loading ? "..." : "Entrar"}
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  if (stage === "confirm") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background relative overflow-hidden">
        <LavaParticles />
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md glass-panel-strong rounded-3xl p-8 border border-primary/20 text-center relative z-10">
          <div className="flex items-center justify-center gap-2 mb-5">
            <Shield className="text-primary" size={18} />
            <h2 className="text-lg font-bold magma-gradient-text">Is this you?</h2>
          </div>
          <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}
            className="w-28 h-28 mx-auto rounded-full magma-gradient p-1 mb-4 magma-glow">
            <div className="w-full h-full rounded-full bg-card flex items-center justify-center text-3xl font-bold magma-gradient-text overflow-hidden">
              {myProfile?.avatar_url
                ? <img src={myProfile.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                : (myProfile?.avatar_initials ?? "??")}
            </div>
          </motion.div>
          <p className="text-xl font-bold text-foreground">{myProfile?.display_name}</p>
          <p className="text-sm text-muted-foreground">@{myProfile?.username}</p>
          <p className="mt-5 text-xs text-muted-foreground leading-relaxed">
            Por seguridad, confirma que esta es tu cuenta antes de ver la
            ubicación de <span className="font-semibold text-foreground">{sharerProfile?.display_name}</span>.
          </p>
          <div className="flex gap-2 mt-6">
            <button onClick={async () => { await supabase.auth.signOut(); setStage("login"); }}
              className="flex-1 py-3 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/70 text-sm">
              No, no soy yo
            </button>
            <button onClick={confirmIdentity}
              className="flex-1 py-3 rounded-xl magma-gradient text-primary-foreground font-bold magma-glow-sm flex items-center justify-center gap-2 text-sm">
              <CheckCircle2 size={16} /> Sí, soy yo
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Map stage
  const center: [number, number] = pings.length
    ? [pings.reduce((a, p) => a + p.lat, 0) / pings.length, pings.reduce((a, p) => a + p.lng, 0) / pings.length]
    : [0, 0];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="px-4 py-3 border-b border-border glass-panel flex items-center gap-3">
        <button onClick={() => navigate("/")} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
          <MapPin size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground truncate">
            Ubicación de {sharerProfile?.display_name}
          </h3>
          <p className="text-xs text-muted-foreground truncate">
            {pings.length} persona{pings.length === 1 ? "" : "s"} en vivo
          </p>
        </div>
      </div>
      <div className="flex-1 relative">
        {pings.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 ember-bg">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 1.6, repeat: Infinity }}>
              <MapPin size={42} className="text-primary mb-3" />
            </motion.div>
            <p className="font-semibold text-foreground">Esperando el primer ping…</p>
            <p className="text-sm text-muted-foreground mt-1">La ubicación aparecerá en segundos</p>
          </div>
        ) : (
          <MapContainer center={center} zoom={14} style={{ height: "100%", width: "100%" }}>
            <TileLayer attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {pings.map((p, i) => (
              <div key={`${p.uid}-${i}`}>
                <Marker position={[p.lat, p.lng]} icon={p.isMe ? meIcon : themIcon}>
                  <Popup><strong>{p.isMe ? "Tú" : p.name}</strong></Popup>
                </Marker>
                {p.acc && <Circle center={[p.lat, p.lng]} radius={p.acc}
                  pathOptions={{ color: p.isMe ? "#f97316" : "#3b82f6", fillOpacity: 0.08, weight: 1 }} />}
              </div>
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
};

export default SharedLocationPage;