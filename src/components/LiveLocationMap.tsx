import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { X, MapPin, Navigation, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import MapAutoFit from "./MapAutoFit";

// Fix default marker icons (CDN) so they actually render in bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const meIcon = L.divIcon({
  className: "",
  html: `<div style="width:22px;height:22px;border-radius:9999px;background:linear-gradient(135deg,#f97316,#ef4444);border:3px solid white;box-shadow:0 0 12px rgba(249,115,22,0.7)"></div>`,
  iconSize: [22, 22], iconAnchor: [11, 11],
});
const themIcon = L.divIcon({
  className: "",
  html: `<div style="width:22px;height:22px;border-radius:9999px;background:linear-gradient(135deg,#06b6d4,#3b82f6);border:3px solid white;box-shadow:0 0 12px rgba(59,130,246,0.7)"></div>`,
  iconSize: [22, 22], iconAnchor: [11, 11],
});

interface Ping { lat: number; lng: number; accuracy?: number | null; created_at: string; }

interface Props {
  open: boolean;
  onClose: () => void;
  myUserId: string;
  conversationId?: string;
  groupId?: string;
  contactName?: string;
  mySharing?: boolean;
  onStopMine?: () => void;
}

const LiveLocationMap = ({ open, onClose, myUserId, conversationId, groupId, contactName, mySharing, onStopMine }: Props) => {
  const [shares, setShares] = useState<{ id: string; user_id: string; last?: Ping }[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { display_name: string; avatar_initials: string }>>({});
  const channelRef = useRef<any>(null);

  const refresh = async () => {
    let q = supabase.from("location_shares").select("id, user_id").eq("active", true);
    if (conversationId) q = q.eq("conversation_id", conversationId);
    else if (groupId) q = q.eq("group_id", groupId);
    const { data } = await q;
    if (!data) return;
    // last ping per share
    const enriched = await Promise.all(data.map(async (s) => {
      const { data: p } = await supabase.from("location_pings").select("lat,lng,accuracy,created_at")
        .eq("share_id", s.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return { ...s, last: p as Ping | undefined };
    }));
    setShares(enriched);

    const ids = Array.from(new Set(enriched.map((e) => e.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles")
        .select("user_id, display_name, avatar_initials").in("user_id", ids);
      const map: Record<string, any> = {};
      profs?.forEach((p: any) => { map[p.user_id] = p; });
      setProfiles(map);
    }
  };

  useEffect(() => {
    if (!open) return;
    refresh();
    const ch = supabase.channel(`loc-map-${conversationId ?? groupId ?? "any"}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "location_pings" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "location_shares" }, () => refresh())
      .subscribe();
    channelRef.current = ch;
    const iv = setInterval(refresh, 8000);
    return () => { supabase.removeChannel(ch); clearInterval(iv); };
  }, [open, conversationId, groupId]);

  const points = shares.filter((s) => s.last).map((s) => ({
    id: s.id, uid: s.user_id, lat: s.last!.lat, lng: s.last!.lng, acc: s.last!.accuracy,
    isMe: s.user_id === myUserId,
  }));

  // Compute initial center
  const center: [number, number] = points.length
    ? [points.reduce((a, p) => a + p.lat, 0) / points.length, points.reduce((a, p) => a + p.lng, 0) / points.length]
    : [0, 0];

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[95] bg-background flex flex-col">
          <div className="px-4 py-3 flex items-center gap-3 border-b border-border glass-panel">
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground"><X size={20} /></button>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <MapPin size={18} className="text-primary" /> Live location
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                {points.length} active {points.length === 1 ? "share" : "shares"}{contactName ? ` · ${contactName}` : ""}
              </p>
            </div>
            {mySharing && onStopMine && (
              <button onClick={onStopMine}
                className="px-3 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold flex items-center gap-1.5">
                <Square size={12} fill="currentColor" /> Stop
              </button>
            )}
          </div>
          <div className="flex-1 relative">
            {points.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 ember-bg">
                <Navigation size={42} className="text-muted-foreground mb-3" />
                <p className="font-semibold text-foreground">No live locations yet</p>
                <p className="text-sm text-muted-foreground mt-1">Waiting for the first GPS ping…</p>
              </div>
            ) : (
              <MapContainer center={center} zoom={14} style={{ height: "100%", width: "100%" }}>
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapAutoFit points={points} />
                {points.flatMap((p) => [
                  <Marker key={`m-${p.id}`} position={[p.lat, p.lng]} icon={p.isMe ? meIcon : themIcon}>
                    <Popup>
                      <strong>{p.isMe ? "You" : profiles[p.uid]?.display_name ?? "Unknown"}</strong>
                    </Popup>
                  </Marker>,
                  p.acc ? (
                    <Circle key={`c-${p.id}`} center={[p.lat, p.lng]} radius={p.acc}
                      pathOptions={{ color: p.isMe ? "#f97316" : "#3b82f6", fillOpacity: 0.08, weight: 1 }} />
                  ) : null,
                ])}
              </MapContainer>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LiveLocationMap;