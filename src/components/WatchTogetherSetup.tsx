import { useState } from "react";
import { motion } from "framer-motion";
import { X, Youtube, Link2, Upload, Code2, Loader2, Tv } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Src = "youtube" | "url" | "file" | "embed";

interface Props {
  myUserId: string;
  conversationId?: string | null;
  groupId?: string | null;
  onClose: () => void;
  onCreated: (id: string, title: string) => void;
}

const WatchTogetherSetup = ({ myUserId, conversationId, groupId, onClose, onCreated }: Props) => {
  const [kind, setKind] = useState<Src>("youtube");
  const [value, setValue] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    if (!conversationId && !groupId) { toast.error("Abre un chat primero"); return; }
    setBusy(true);
    try {
      let source = value.trim();
      let sourceType: string = kind;
      if (kind === "file") {
        if (!file) throw new Error("Elige un video");
        if (file.size > 200 * 1024 * 1024) throw new Error("Máximo 200 MB");
        const { data: u } = await supabase.auth.getUser();
        const path = `${u.user?.id ?? myUserId}/watch/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
        const { error } = await supabase.storage.from("social-media").upload(path, file, { contentType: file.type || undefined });
        if (error) throw error;
        source = supabase.storage.from("social-media").getPublicUrl(path).data.publicUrl;
        sourceType = "url";
      }
      if (!source) throw new Error("Falta el enlace o código");
      const t = title.trim() || (kind === "file" ? file!.name : "Watch Together");
      const { data: au } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("watch_sessions").insert({
        host_id: au.user?.id ?? myUserId, conversation_id: conversationId ?? null, group_id: groupId ?? null,
        source_type: sourceType, source, title: t,
      }).select("id").single();
      if (error) throw error;
      onCreated(data.id, t);
    } catch (e: any) { toast.error(e.message ?? "Error"); }
    finally { setBusy(false); }
  };

  const opts: { k: Src; label: string; Icon: any }[] = [
    { k: "youtube", label: "YouTube", Icon: Youtube },
    { k: "url", label: "URL", Icon: Link2 },
    { k: "file", label: "Dispositivo", Icon: Upload },
    { k: "embed", label: "Embed", Icon: Code2 },
  ];

  return (
    <motion.div className="fixed inset-0 z-[90] flex items-end sm:items-center sm:justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl glass-panel border border-border p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Tv size={16} className="text-primary" /> Watch Together</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted text-muted-foreground"><X size={16} /></button>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {opts.map(({ k, label, Icon }) => (
            <button key={k} onClick={() => setKind(k)}
              className={`flex flex-col items-center gap-1 rounded-2xl py-3 text-[11px] transition-colors ${kind === k ? "magma-gradient text-primary-foreground" : "glass-panel-strong text-muted-foreground"}`}>
              <Icon size={18} /> {label}
            </button>
          ))}
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (opcional)"
          className="w-full mb-2 px-3 py-2.5 rounded-xl bg-muted text-sm text-foreground outline-none" />
        {kind === "file" ? (
          <input type="file" accept="video/*,audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground" />
        ) : kind === "embed" ? (
          <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={4} placeholder='<iframe src="..."></iframe>'
            className="w-full px-3 py-2.5 rounded-xl bg-muted text-xs font-mono text-foreground outline-none" />
        ) : (
          <input value={value} onChange={(e) => setValue(e.target.value)}
            placeholder={kind === "youtube" ? "https://youtube.com/watch?v=..." : "https://.../video.mp4"}
            className="w-full px-3 py-2.5 rounded-xl bg-muted text-sm text-foreground outline-none" />
        )}
        {kind === "embed" && <p className="mt-2 text-[11px] text-muted-foreground">Con código embed la sincronización es limitada: todos lo ven, pero solo tú puedes tocarlo.</p>}
        <button disabled={busy} onClick={start}
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl magma-gradient py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {busy && <Loader2 size={16} className="animate-spin" />} Empezar
        </button>
      </motion.div>
    </motion.div>
  );
};

export default WatchTogetherSetup;
