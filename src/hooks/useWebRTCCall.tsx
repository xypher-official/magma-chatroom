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
  // Free public TURN — used only if STUN fails (symmetric NAT, etc.)
  {
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
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
  const stateRef = useRef<CallState>("idle");
  const cleaningRef = useRef(false);
  const isCallerRef = useRef(false);
  const otherUserRef = useRef<string | null>(null);
  const offerSentRef = useRef(false);

  useEffect(() => { stateRef.current = state; }, [state]);

  const cleanup = useCallback(async (markEnded = true) => {
    if (cleaningRef.current) return;
    cleaningRef.current = true;
    try { pcRef.current?.close(); } catch { /* ignore */ }
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (signalChannelRef.current) {
      await supabase.removeChannel(signalChannelRef.current);
      signalChannelRef.current = null;
    }
    if (markEnded && callIdRef.current && myUserId) {
      try { await supabase.from("call_events").insert({ call_id: callIdRef.current, user_id: myUserId, event_type: "left" }); } catch { /* ignore */ }
    }
    if (markEnded && callIdRef.current) {
      await supabase.from("calls").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", callIdRef.current);
    }
    callIdRef.current = null;
    pendingIceRef.current = [];
    isCallerRef.current = false;
    otherUserRef.current = null;
    offerSentRef.current = false;
    setActive(null);
    setIncoming(null);
    setMuted(false);
    setCameraOff(false);
    setState("idle");
    cleaningRef.current = false;
  }, [myUserId]);

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
      const stream = e.streams[0];
      if (stream) {
        stream.getTracks().forEach((t) => {
          if (!remote.getTracks().find((rt) => rt.id === t.id)) remote.addTrack(t);
        });
      } else if (e.track) {
        remote.addTrack(e.track);
      }
      if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== remote) {
        remoteVideoRef.current.srcObject = remote;
      }
    };
    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      if (s === "connected" || s === "completed") setState("active");
      if (s === "failed") { toast.error("Call connection failed"); cleanup(); }
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === "connected") {
        setState("active");
        if (callIdRef.current && myUserId) {
          supabase.from("call_events").insert({ call_id: callIdRef.current, user_id: myUserId, event_type: "joined" }).then(() => {}, () => {});
        }
      }
      if (s === "failed") cleanup();
    };
    return pc;
  }, [cleanup, sendSignal, myUserId]);

  const getLocalStream = useCallback(async (video: boolean) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false,
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  }, []);

  const handleSignal = useCallback(async (sig: any) => {
    if (!sig || sig.from_user === myUserId) return;
    const pc = pcRef.current;
    if (!pc) return;
    const otherUserId = otherUserRef.current ?? sig.from_user;
    try {
      if (sig.signal_type === "offer") {
        if (pc.signalingState !== "stable") {
          console.warn("Ignoring offer in state", pc.signalingState);
          return;
        }
        await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
        for (const c of pendingIceRef.current) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) { console.warn("ice add fail", e); }
        }
        pendingIceRef.current = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal(otherUserId, "answer", { type: answer.type, sdp: answer.sdp });
      } else if (sig.signal_type === "answer") {
        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
          for (const c of pendingIceRef.current) {
            try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) { console.warn("ice add fail", e); }
          }
          pendingIceRef.current = [];
        }
      } else if (sig.signal_type === "ice") {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          try { await pc.addIceCandidate(new RTCIceCandidate(sig.payload)); } catch (e) { console.warn("ice add fail", e); }
        } else {
          pendingIceRef.current.push(sig.payload);
        }
      } else if (sig.signal_type === "hangup") {
        toast.info("📞 Call ended");
        await cleanup(false);
      }
    } catch (e) {
      console.error("signal error", e);
    }
  }, [cleanup, myUserId, sendSignal]);

  const sendOfferAsCaller = useCallback(async () => {
    if (offerSentRef.current) return;
    const pc = pcRef.current;
    const other = otherUserRef.current;
    if (!pc || !other) return;
    offerSentRef.current = true;
    setState("connecting");
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      await sendSignal(other, "offer", { type: offer.type, sdp: offer.sdp });
    } catch (e) {
      console.error("offer error", e);
      offerSentRef.current = false;
    }
  }, [sendSignal]);

  const subscribeSignals = useCallback(async (callId: string) => {
    if (signalChannelRef.current) {
      await supabase.removeChannel(signalChannelRef.current);
      signalChannelRef.current = null;
    }
    return await new Promise<void>((resolve) => {
      const ch = supabase
        .channel(`call-${callId}-${myUserId}`)
        .on("postgres_changes", {
          event: "INSERT", schema: "public", table: "call_signals",
          filter: `call_id=eq.${callId}`,
        }, (payload) => { handleSignal(payload.new); })
        .on("postgres_changes", {
          event: "UPDATE", schema: "public", table: "calls",
          filter: `id=eq.${callId}`,
        }, async (payload) => {
          const c: any = payload.new;
          if (c.status === "ended" || c.status === "declined") {
            if (c.status === "declined") toast.info("📞 Call declined");
            await cleanup(false);
          } else if (c.status === "accepted" && isCallerRef.current) {
            await sendOfferAsCaller();
          }
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            // Replay any signals inserted before subscription was ready
            const { data } = await supabase.from("call_signals")
              .select("*").eq("call_id", callId).order("created_at", { ascending: true });
            for (const s of data ?? []) await handleSignal(s);
            resolve();
          }
        });
      signalChannelRef.current = ch;
    });
  }, [cleanup, handleSignal, myUserId, sendOfferAsCaller]);

  // --- Public API ---
  const startCall = useCallback(async (calleeId: string, callType: "video" | "audio") => {
    if (!myUserId) return;
    if (stateRef.current !== "idle") { toast.error("Already in a call"); return; }
    try {
      setState("calling");
      // Get media first so we surface permission errors before creating the row.
      const stream = await getLocalStream(callType === "video");

      const { data: callRow, error } = await supabase.from("calls").insert({
        caller_id: myUserId, callee_id: calleeId, call_type: callType, status: "ringing", room_id: crypto.randomUUID(),
      }).select("id").single();
      if (error || !callRow) throw error ?? new Error("Could not create call");
      callIdRef.current = callRow.id;
      isCallerRef.current = true;
      otherUserRef.current = calleeId;
      setActive({ id: callRow.id, callerId: myUserId, calleeId, callType });

      const pc = setupPeerConnection(calleeId);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await subscribeSignals(callRow.id);
      // Offer is sent when callee accepts (status → 'accepted' via UPDATE listener).
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message?.includes("Permission") ? "Microphone/camera permission denied" : (e?.message ?? "Call failed"));
      await cleanup();
    }
  }, [cleanup, getLocalStream, myUserId, setupPeerConnection, subscribeSignals]);

  const acceptCall = useCallback(async () => {
    if (!incoming || !myUserId) return;
    try {
      setState("connecting");
      const stream = await getLocalStream(incoming.callType === "video");
      callIdRef.current = incoming.id;
      isCallerRef.current = false;
      otherUserRef.current = incoming.callerId;
      setActive(incoming);
      const pc = setupPeerConnection(incoming.callerId);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await subscribeSignals(incoming.id);
      // Signal caller to send the offer now that we're ready.
      await supabase.from("calls").update({ status: "accepted" }).eq("id", incoming.id);
      setIncoming(null);
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
        if (stateRef.current !== "idle") return;
        setIncoming({ id: c.id, callerId: c.caller_id, calleeId: c.callee_id, callType: c.call_type });
        setState("ringing");
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [myUserId]);

  return {
    state, incoming, active, muted, cameraOff,
    localVideoRef, remoteVideoRef,
    startCall, acceptCall, declineCall, hangup, toggleMute, toggleCamera,
  };
};