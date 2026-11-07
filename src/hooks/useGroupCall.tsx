import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getIceServers } from "./useWebRTCCall";

export const GROUP_CALL_MAX = 8;

type Sig =
  | { type: "offer" | "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; from: string; to: string; candidate: RTCIceCandidateInit };

export interface Peer { userId: string; stream: MediaStream | null; state: string }

/**
 * Mesh group call over one Realtime channel per group.
 * Presence = who is in the call; broadcast = addressed SDP/ICE.
 * The peer with the smaller user id always sends the offer (no glare).
 */
export const useGroupCall = (groupId: string, me: string) => {
  const [participants, setParticipants] = useState<string[]>([]);
  const [joined, setJoined] = useState(false);
  const [video, setVideo] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [peers, setPeers] = useState<Record<string, Peer>>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pcs = useRef<Record<string, RTCPeerConnection>>({});
  const pendingIce = useRef<Record<string, RTCIceCandidateInit[]>>({});
  const localRef = useRef<MediaStream | null>(null);
  const joinedRef = useRef(false);
  const iceRef = useRef<RTCIceServer[]>([]);

  const setPeer = (id: string, patch: Partial<Peer>) =>
    setPeers((p) => ({ ...p, [id]: { userId: id, stream: null, state: "connecting", ...p[id], ...patch } }));

  const send = (msg: Sig) => chRef.current?.send({ type: "broadcast", event: "sig", payload: msg });

  const closePeer = useCallback((id: string) => {
    pcs.current[id]?.close();
    delete pcs.current[id];
    delete pendingIce.current[id];
    setPeers((p) => { const n = { ...p }; delete n[id]; return n; });
  }, []);

  const makePc = useCallback((id: string) => {
    if (pcs.current[id]) return pcs.current[id];
    const pc = new RTCPeerConnection({ iceServers: iceRef.current });
    pcs.current[id] = pc;
    localRef.current?.getTracks().forEach((t) => pc.addTrack(t, localRef.current!));
    pc.onicecandidate = (e) => e.candidate && send({ type: "ice", from: me, to: id, candidate: e.candidate.toJSON() });
    pc.ontrack = (e) => setPeer(id, { stream: e.streams[0] });
    pc.onconnectionstatechange = () => {
      setPeer(id, { state: pc.connectionState });
      if (pc.connectionState === "failed") pc.restartIce?.();
    };
    setPeer(id, {});
    return pc;
  }, [me]);

  const callPeer = useCallback(async (id: string) => {
    const pc = makePc(id);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send({ type: "offer", from: me, to: id, sdp: offer });
  }, [makePc, me]);

  const flushIce = async (id: string) => {
    const pc = pcs.current[id];
    for (const c of pendingIce.current[id] ?? []) await pc.addIceCandidate(c).catch(() => {});
    pendingIce.current[id] = [];
  };

  // One channel per group: lobby (presence only) + signaling.
  useEffect(() => {
    if (!groupId || !me) return;
    const ch = supabase.channel(`gcall-${groupId}`, { config: { presence: { key: me }, broadcast: { self: false } } });
    ch.on("presence", { event: "sync" }, () => {
      const ids = Object.keys(ch.presenceState()).filter((k) => (ch.presenceState() as any)[k]?.some((x: any) => x.inCall));
      setParticipants(ids);
      if (!joinedRef.current) return;
      // connect to new peers (smaller id offers), drop departed peers
      ids.filter((id) => id !== me && !pcs.current[id] && me < id).forEach((id) => callPeer(id));
      Object.keys(pcs.current).filter((id) => !ids.includes(id)).forEach(closePeer);
    });
    ch.on("broadcast", { event: "sig" }, async ({ payload }) => {
      const m = payload as Sig;
      if (m.to !== me || !joinedRef.current) return;
      try {
        if (m.type === "offer") {
          const pc = makePc(m.from);
          await pc.setRemoteDescription(m.sdp);
          await flushIce(m.from);
          const ans = await pc.createAnswer();
          await pc.setLocalDescription(ans);
          send({ type: "answer", from: me, to: m.from, sdp: ans });
        } else if (m.type === "answer") {
          const pc = pcs.current[m.from];
          if (pc && pc.signalingState === "have-local-offer") { await pc.setRemoteDescription(m.sdp); await flushIce(m.from); }
        } else if (m.type === "ice") {
          const pc = pcs.current[m.from];
          if (pc?.remoteDescription) await pc.addIceCandidate(m.candidate).catch(() => {});
          else (pendingIce.current[m.from] ??= []).push(m.candidate);
        }
      } catch (e) { console.warn("group-call signal", e); }
    });
    ch.subscribe();
    chRef.current = ch;
    return () => { leaveInternal(); supabase.removeChannel(ch); chRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, me]);

  const leaveInternal = () => {
    joinedRef.current = false;
    Object.keys(pcs.current).forEach((id) => { pcs.current[id].close(); });
    pcs.current = {}; pendingIce.current = {};
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
  };

  const join = useCallback(async (withVideo: boolean) => {
    if (joinedRef.current) return;
    if (participants.length >= GROUP_CALL_MAX) { toast.error(`La llamada está llena (máx. ${GROUP_CALL_MAX})`); return false; }
    try {
      iceRef.current = await getIceServers();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: withVideo ? { facingMode: "user" } : false });
      localRef.current = stream;
      setLocalStream(stream);
      setVideo(withVideo); setMuted(false); setCameraOff(false);
      joinedRef.current = true; setJoined(true);
      await chRef.current?.track({ inCall: true, video: withVideo, at: Date.now() });
      return participants.length === 0; // true = started a new call
    } catch (e: any) {
      toast.error(e?.name === "NotAllowedError" ? "Permite el micrófono/cámara para unirte" : "No se pudo acceder al micrófono/cámara");
      return false;
    }
  }, [participants.length]);

  const leave = useCallback(async () => {
    leaveInternal();
    setPeers({}); setLocalStream(null); setJoined(false);
    await chRef.current?.untrack();
  }, []);

  const toggleMute = () => {
    const t = localRef.current?.getAudioTracks()[0]; if (!t) return;
    t.enabled = !t.enabled; setMuted(!t.enabled);
  };
  const toggleCamera = () => {
    const t = localRef.current?.getVideoTracks()[0]; if (!t) return;
    t.enabled = !t.enabled; setCameraOff(!t.enabled);
  };
  const flipCamera = async () => {
    const cur = localRef.current?.getVideoTracks()[0]; if (!cur) return;
    const facing = cur.getSettings().facingMode === "environment" ? "user" : "environment";
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } });
      const nt = s.getVideoTracks()[0];
      Object.values(pcs.current).forEach((pc) => pc.getSenders().find((x) => x.track?.kind === "video")?.replaceTrack(nt));
      localRef.current!.removeTrack(cur); cur.stop(); localRef.current!.addTrack(nt);
      setLocalStream(new MediaStream(localRef.current!.getTracks()));
    } catch { toast.error("No se pudo cambiar de cámara"); }
  };

  return { participants, joined, video, muted, cameraOff, peers, localStream, join, leave, toggleMute, toggleCamera, flipCamera };
};
