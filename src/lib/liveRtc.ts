import { supabase } from "@/integrations/supabase/client";

const FALLBACK_ICE: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  {
    urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443", "turn:openrelay.metered.ca:443?transport=tcp"],
    username: "openrelayproject", credential: "openrelayproject",
  },
];

let cache: { s: RTCIceServer[]; at: number } | null = null;
export const getLiveIceServers = async (): Promise<RTCIceServer[]> => {
  if (cache && Date.now() - cache.at < 30 * 60_000) return cache.s;
  try {
    const { data } = await supabase.functions.invoke("turn-credentials");
    if (data?.hasTurn && Array.isArray(data.iceServers)) {
      cache = { s: data.iceServers, at: Date.now() };
      return data.iceServers;
    }
  } catch { /* fallback */ }
  return FALLBACK_ICE;
};

export type LiveSource = "screen" | "camera_front" | "camera_back";

export const getLiveMedia = async (source: LiveSource): Promise<MediaStream> => {
  if (source === "screen") {
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("Tu dispositivo no permite compartir pantalla (en iPhone usa la cámara).");
    const screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      mic.getAudioTracks().forEach((t) => screen.addTrack(t));
    } catch { /* screen only */ }
    return screen;
  }
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video: { facingMode: source === "camera_back" ? { ideal: "environment" } : "user", width: { ideal: 1280 }, height: { ideal: 720 } },
  });
};

export const mediaErrorText = (e: any): string => {
  const n = e?.name ?? "";
  if (n === "NotAllowedError" || n === "SecurityError") return "Permiso denegado. Activa cámara/micrófono/pantalla en los ajustes del navegador.";
  if (n === "NotFoundError" || n === "OverconstrainedError") return "No se encontró la cámara o micrófono solicitado.";
  if (n === "NotReadableError") return "La cámara está siendo usada por otra app.";
  return e?.message ?? "No se pudo iniciar la transmisión";
};
