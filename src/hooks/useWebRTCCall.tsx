import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * 1-on-1 WebRTC call hook using Supabase Realtime as signaling.
 * Creates/updates rows in `calls` and exchanges offer/answer/ice via `call_signals`.
 */

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

export type CallState = "idle" | "calling" | "ringing" | "connecting" | "active" | "ended";

export interface ActiveCall {
  id: string;
  callerId: string;
  calleeId: string;
  callType: "video" | "audio";
}

export const useWebRTCCall = (myUserId: string | undefined) => {
  const [state, setState] = useState<CallState>("idle");
  const [incoming, setIncoming] = useState<ActiveCall | null>(null);
  const [active, setActive] = useState<ActiveCall | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const signalChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const callIdRef = useRef<string | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);

  const cleanup = useCallback(async (markEnded = true) => {
    try { pcRef.current?.close(); } catch { /* ignore */ }
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    if (signalChannelRef.current) {
      await supabase.removeChannel(signalChannelRef.current);
      signalChannelRef.current = null;
    }
    if (markEnded && callIdRef.current) {
      await supabase.from("calls").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", callIdRef.current);
    }
    callIdRef.current = null;
    pendingIceRef.current = [];
    setActive(null);
    setIncoming(null);
    setMuted(false);
    setCameraOff(false);
    setState("idle");
  }, []);

  const sendSignal = useCallback(async (toUser: string, signalType: string, payload: any) => {
    if (!callIdRef.current || !myUserId) return;
    await supabase.from("call_signals").insert({
      call_id: callIdRef.current,
      from_user: myUserId,
      to_user: toUser,
      signal_type: signalType,
      payload,
    });
  }, [myUserId]);

  const setupPeerConnection = useCallback((otherUserId: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    const remote = new MediaStream();
    remoteStreamRef.current = remote;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;

    pc.onicecandidate = (e) => {
      if (e.candidate) sendSignal(otherUserId, "ice", e.candidate.toJSON());
    };
    pc.ontrack = (e) => {
      e.streams[0]?.getTracks().forEach((t) => remote.addTrack(t));
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setState("active");
      if (pc.connectionState === "failed" || pc.connectionState === "closed") cleanup();
    };
    return pc;
  }, [cleanup, sendSignal]);

  const getLocalStream = useCallback(async (video: boolean) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false,
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  }, []);

  const subscribeSignals = useCallback((callId: string, otherUserId: string) => {
    if (signalChannelRef.current) supabase.removeChannel(signalChannelRef.current);
    const ch = supabase
      .channel(`call-${callId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "call_signals",
        filter: `call_id=eq.${callId}`,
      }, async (payload) => {
        const sig: any = payload.new;
        if (sig.from_user === myUserId) return;
        const pc = pcRef.current;
        if (!pc) return;
        try {
          if (sig.signal_type === "offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
            for (const c of pendingIceRef.current) await pc.addIceCandidate(new RTCIceCandidate(c));
            pendingIceRef.current = [];
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await sendSignal(otherUserId, "answer", { type: answer.type, sdp: answer.sdp });
          } else if (sig.signal_type === "answer") {
            await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
            for (const c of pendingIceRef.current) await pc.addIceCandidate(new RTCIceCandidate(c));
            pendingIceRef.current = [];
          } else if (sig.signal_type === "ice") {
            if (pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(sig.payload));
            else pendingIceRef.current.push(sig.payload);
          } else if (sig.signal_type === "hangup") {
            await cleanup(false);
            toast.info("📞 Call ended");
          }
        } catch (e) {
          console.error("signal error", e);
        }
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "calls",
        filter: `id=eq.${callId}`,
      }, async (payload) => {
        const c: any = payload.new;
        if (c.status === "ended") await cleanup(false);
      })
      .subscribe();
    signalChannelRef.current = ch;
  }, [cleanup, myUserId, sendSignal]);

  // --- Public API ---
  const startCall = useCallback(async (calleeId: string, callType: "video" | "audio") => {
    if (!myUserId) return;
    if (state !== "idle") { toast.error("Already in a call"); return; }
    try {
      setState("calling");
      // Get media first so we surface permission errors before creating the row.
      const stream = await getLocalStream(callType === "video");

      const { data: callRow, error } = await supabase.from("calls").insert({
        caller_id: myUserId, callee_id: calleeId, call_type: callType, status: "ringing", room_id: crypto.randomUUID(),
      }).select("id").single();
      if (error || !callRow) throw error ?? new Error("Could not create call");
      callIdRef.current = callRow.id;
      setActive({ id: callRow.id, callerId: myUserId, calleeId, callType });

      const pc = setupPeerConnection(calleeId);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      subscribeSignals(callRow.id, calleeId);

      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callType === "video" });
      await pc.setLocalDescription(offer);
      await sendSignal(calleeId, "offer", { type: offer.type, sdp: offer.sdp });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message?.includes("Permission") ? "Microphone/camera permission denied" : (e?.message ?? "Call failed"));
      await cleanup();
    }
  }, [cleanup, getLocalStream, myUserId, sendSignal, setupPeerConnection, state, subscribeSignals]);

  const acceptCall = useCallback(async () => {
    if (!incoming || !myUserId) return;
    try {
      setState("connecting");
      const stream = await getLocalStream(incoming.callType === "video");
      callIdRef.current = incoming.id;
      setActive(incoming);
      const pc = setupPeerConnection(incoming.callerId);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      subscribeSignals(incoming.id, incoming.callerId);
      await supabase.from("calls").update({ status: "accepted" }).eq("id", incoming.id);
      setIncoming(null);
      // Wait for offer signal — already subscribed
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Call failed");
      await cleanup();
    }
  }, [cleanup, getLocalStream, incoming, myUserId, setupPeerConnection, subscribeSignals]);

  const declineCall = useCallback(async () => {
    if (!incoming) return;
    await supabase.from("calls").update({ status: "declined", ended_at: new Date().toISOString() }).eq("id", incoming.id);
    setIncoming(null);
    setState("idle");
  }, [incoming]);

  const hangup = useCallback(async () => {
    const other = active?.callerId === myUserId ? active?.calleeId : active?.callerId;
    if (other) await sendSignal(other, "hangup", {});
    await cleanup();
  }, [active, cleanup, myUserId, sendSignal]);

  const toggleMute = useCallback(() => {
    const audio = localStreamRef.current?.getAudioTracks() ?? [];
    const next = !muted;
    audio.forEach((t) => (t.enabled = !next));
    setMuted(next);
  }, [muted]);

  const toggleCamera = useCallback(() => {
    const video = localStreamRef.current?.getVideoTracks() ?? [];
    const next = !cameraOff;
    video.forEach((t) => (t.enabled = !next));
    setCameraOff(next);
  }, [cameraOff]);

  // Listen for incoming calls globally
  useEffect(() => {
    if (!myUserId) return;
    const ch = supabase
      .channel(`incoming-${myUserId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "calls",
        filter: `callee_id=eq.${myUserId}`,
      }, (payload) => {
        const c: any = payload.new;
        if (c.status !== "ringing") return;
        if (state !== "idle") return;
        setIncoming({ id: c.id, callerId: c.caller_id, calleeId: c.callee_id, callType: c.call_type });
        setState("ringing");
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [myUserId, state]);

  return {
    state, incoming, active, muted, cameraOff,
    localVideoRef, remoteVideoRef,
    startCall, acceptCall, declineCall, hangup, toggleMute, toggleCamera,
  };
};