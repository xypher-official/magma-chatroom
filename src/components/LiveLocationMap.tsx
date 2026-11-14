import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { X, MapPin, Navigation, Square, LocateFixed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const dot = (a: string, b: string) => L.divIcon({
  className: "",
  html: `<div style="width:22px;height:22px;border-radius:9999px;background:linear-gradient(135deg,${a},${b});border:3px solid #fff;box-shadow:0 0 12px ${a}"></div>`,
  iconSize: [22, 22], iconAnchor: [11, 11],
});
const meIcon = dot("#f97316", "#ef4444");
const themIcon = dot("#06b6d4", "#3b82f6");

interface Ping { lat: number; lng: number; accuracy?: number | null; created_at: string; }
interface Props {
  open: boolean; onClose: () => void; myUserId: string;
  conversationId?: string; groupId?: string; contactName?: string;
  mySharing?: boolean; onStopMine?: () => void;
}
type Pt = { id: string; uid: string; lat: number; lng: number; acc?: number | null; isMe: boolean };

const LiveLocationMap = ({ open, onClose, myUserId, conversationId, groupId, contactName, mySharing, onStopMine }: Props) => {
  const [shares, setShares] = useState<{ id: string; user_id: string; last?: Ping }[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [myPos, setMyPos] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const fittedRef = useRef(0);

  const refresh = async () => {
    let q = supabase.from("location_shares").select("id, user_id").eq("active", true);
    if (conversationId) q = q.eq("conversation_id", conversationId);
    else if (groupId) q = q.eq("group_id", groupId);
    const { data } = await q;
    if (!data) return;
    const enriched = await Promise.all(data.map(async (s) => {
      const { data: p } = await supabase.from("location_pings").select("lat,lng,accuracy,created_at")
        .eq("share_id", s.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return { ...s, last: (p ?? undefined) as Ping | undefined };
    }));
    setShares(enriched);
    const ids = Array.from(new Set(enriched.map((e) => e.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, display_name").in("user_id", ids);
      const m: Record<string, string> = {};
      profs?.forEach((p: any) => { m[p.user_id] = p.display_name; });
      setNames(m);
    }
  };

  useEffect(() => {
    if (!open) return;
    refresh();
    const ch = supabase.channel(`loc-map-${conversationId ?? groupId ?? "any"}-${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "location_pings" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "location_shares" }, () => refresh())
      .subscribe();
    const iv = setInterval(refresh, 6000);
    return () => { supabase.removeChannel(ch); clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, conversationId, groupId]);

  useEffect(() => {
    if (!open || !navigator.geolocation) return;
    const set = (p: GeolocationPosition) => setMyPos({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy });
    navigator.geolocation.getCurrentPosition(set, () => {}, { maximumAge: 60000, timeout: 10000 });
    const id = navigator.geolocation.watchPosition(set, () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [open]);

  // Create the map imperatively once the fullscreen panel is mounted.
  useEffect(() => {
    if (!open) return;
    let ro: ResizeObserver | null = null;
    const t = setTimeout(() => {
      const el = boxRef.current;
      if (!el || mapRef.current) return;
      const map = L.map(el, { zoomControl: false, attributionControl: true }).setView([20, -40], 3);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: "© OpenStreetMap contributors",
      }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      fittedRef.current = 0;
      ro = new ResizeObserver(() => map.invalidateSize());
      ro.observe(el);
      [50, 300, 800].forEach((ms) => setTimeout(() => map.invalidateSize(), ms));
    }, 30);
    return () => {
      clearTimeout(t); ro?.disconnect();
      mapRef.current?.remove(); mapRef.current = null; layerRef.current = null;
    };
  }, [open]);

  const remote: Pt[] = shares.filter((s) => s.last).map((s) => ({
    id: s.id, uid: s.user_id, lat: s.last!.lat, lng: s.last!.lng, acc: s.last!.accuracy, isMe: s.user_id === myUserId,
  }));
  const points: Pt[] = remote.some((p) => p.isMe) || !myPos ? remote
    : [...remote, { id: "me", uid: myUserId, lat: myPos.lat, lng: myPos.lng, acc: myPos.acc, isMe: true }];
  const key = points.map((p) => `${p.id}:${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");

  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    points.forEach((p) => {
      const label = p.isMe ? "Tú" : names[p.uid] ?? contactName ?? "Contacto";
      if (p.acc) L.circle([p.lat, p.lng], { radius: p.acc, color: p.isMe ? "#f97316" : "#3b82f6", fillOpacity: 0.08, weight: 1 }).addTo(layer);
      L.marker([p.lat, p.lng], { icon: p.isMe ? meIcon : themIcon }).bindTooltip(label, { permanent: true, direction: "top", offset: [0, -12] }).addTo(layer);
    });
    if (points.length && fittedRef.current !== points.length) {
      fittedRef.current = points.length;
      if (points.length === 1) map.setView([points[0].lat, points[0].lng], 16);
      else map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [60, 60], maxZoom: 17 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, names]);

  const recenter = () => {
    const map = mapRef.current; if (!map || !points.length) return;
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], 16);
    else map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [60, 60], maxZoom: 17 });
  };
  const other = points.find((p) => !p.isMe);

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[95] bg-background" style={{ height: "100dvh" }}>
          <div ref={boxRef} className="absolute inset-0 z-0" style={{ background: "#e5e3df" }} />
          <div className="absolute top-0 inset-x-0 z-[1000] p-3 flex items-center gap-2"
            style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
            <button onClick={onClose} aria-label="Cerrar mapa"
              className="w-11 h-11 shrink-0 rounded-full glass-panel-strong text-foreground flex items-center justify-center shadow-lg"><X size={22} /></button>
            <div className="flex-1 min-w-0 glass-panel-strong rounded-2xl px-3 py-2 shadow-lg">
              <p className="font-bold text-sm text-foreground flex items-center gap-1.5"><MapPin size={15} className="text-primary" /> Ubicación en tiempo real</p>
              <p className="text-xs text-muted-foreground truncate">
                {other ? `${names[other.uid] ?? contactName ?? "Contacto"} en vivo` : `Esperando a ${contactName ?? "la otra persona"}…`}
              </p>
            </div>
          </div>
          {points.length === 0 && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[1000] px-3 py-1.5 rounded-full glass-panel-strong text-xs text-foreground flex items-center gap-1.5">
              <Navigation size={12} className="text-primary animate-pulse" /> Buscando ubicaciones…
            </div>
          )}
          <div className="absolute bottom-0 left-0 z-[1000] p-3 flex gap-2"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <button onClick={recenter} aria-label="Centrar"
              className="w-11 h-11 rounded-full glass-panel-strong text-primary flex items-center justify-center shadow-lg"><LocateFixed size={20} /></button>
            {mySharing && onStopMine && (
              <button onClick={onStopMine}
                className="px-4 h-11 rounded-full bg-destructive text-destructive-foreground text-sm font-bold flex items-center gap-1.5 shadow-lg">
                <Square size={12} fill="currentColor" /> Dejar de compartir
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
export default LiveLocationMap;
