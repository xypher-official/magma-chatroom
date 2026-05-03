import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type LocationDuration = "15m" | "1h" | "8h" | "until_stop";

const minutesFor = (d: LocationDuration): number | null => {
  if (d === "15m") return 15;
  if (d === "1h") return 60;
  if (d === "8h") return 480;
  return null;
};

export const useLocationShare = (myUserId?: string) => {
  const [activeShareId, setActiveShareId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const stop = useCallback(async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (activeShareId) {
      await supabase.from("location_shares").update({ active: false }).eq("id", activeShareId);
    }
    setActiveShareId(null);
    setSharing(false);
  }, [activeShareId]);

  const start = useCallback(async (opts: {
    duration: LocationDuration;
    conversationId?: string;
    groupId?: string;
  }) => {
    if (!myUserId) return null;
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return null; }
    setSharing(true);
    const minutes = minutesFor(opts.duration);
    const expires = minutes ? new Date(Date.now() + minutes * 60_000).toISOString() : null;

    const { data, error } = await supabase.from("location_shares").insert({
      user_id: myUserId,
      conversation_id: opts.conversationId ?? null,
      group_id: opts.groupId ?? null,
      expires_at: expires,
      active: true,
    }).select("id").single();
    if (error || !data) { toast.error(error?.message ?? "Share failed"); setSharing(false); return null; }
    setActiveShareId(data.id);

    const id = navigator.geolocation.watchPosition(async (pos) => {
      try {
        await supabase.from("location_pings").insert({
          share_id: data.id,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      } catch (e) { console.warn(e); }
    }, (err) => { toast.error(err.message); }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    watchIdRef.current = id;

    if (expires) {
      setTimeout(() => { stop(); }, minutes! * 60_000);
    }
    return data.id;
  }, [myUserId, stop]);

  useEffect(() => () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
  }, []);

  return { sharing, activeShareId, start, stop };
};