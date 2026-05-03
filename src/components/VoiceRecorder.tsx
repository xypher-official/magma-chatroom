import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Send, Trash2, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  myUserId: string;
  onSent: (url: string, mediaType: string, durationSec: number) => void;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const VoiceRecorder = ({ myUserId, onSent }: Props) => {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const [hasBlob, setHasBlob] = useState(false);

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        blobRef.current = blob;
        setHasBlob(true);
        cleanupStream();
      };
      rec.start(250);
      recRef.current = rec;
      setRecording(true);
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e: any) {
      toast.error(e?.message?.includes("Permission") ? "Microphone permission denied" : "Mic error");
    }
  };

  const stop = () => {
    recRef.current?.state === "recording" && recRef.current.stop();
    setRecording(false);
  };

  const cancel = () => {
    if (recRef.current?.state === "recording") recRef.current.stop();
    cleanupStream();
    blobRef.current = null;
    chunksRef.current = [];
    setHasBlob(false);
    setRecording(false);
    setSeconds(0);
  };

  const send = async () => {
    const blob = blobRef.current; if (!blob) return;
    setBusy(true);
    try {
      const path = `${myUserId}/voice-${Date.now()}.webm`;
      const { error } = await supabase.storage.from("voice-messages").upload(path, blob, {
        contentType: blob.type, upsert: false,
      });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("voice-messages").createSignedUrl(path, 60 * 60 * 24 * 365);
      const url = signed?.signedUrl ?? path;
      onSent(url, "audio", seconds);
      cancel();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  useEffect(() => () => cleanupStream(), []);

  return (
    <AnimatePresence mode="wait">
      {!recording && !hasBlob && (
        <motion.button key="mic" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
          onClick={start} title="Voice message"
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors">
          <Mic size={20} />
        </motion.button>
      )}
      {recording && (
        <motion.div key="rec" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-destructive/10 border border-destructive/30">
          <motion.span animate={{ scale: [1, 1.3, 1], opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity }}
            className="w-2.5 h-2.5 rounded-full bg-destructive" />
          <span className="text-xs font-mono text-destructive">{fmt(seconds)}</span>
          <button onClick={stop} className="p-1 rounded text-destructive hover:bg-destructive/20"><Square size={14} fill="currentColor" /></button>
          <button onClick={cancel} className="p-1 rounded text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
        </motion.div>
      )}
      {hasBlob && !recording && (
        <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="flex items-center gap-2 px-2 py-1 rounded-xl bg-primary/10 border border-primary/30">
          <span className="text-xs font-mono text-primary">{fmt(seconds)}</span>
          <button onClick={cancel} disabled={busy} className="p-1 rounded text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
          <button onClick={send} disabled={busy} className="p-1.5 rounded-lg magma-gradient text-primary-foreground"><Send size={14} /></button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VoiceRecorder;