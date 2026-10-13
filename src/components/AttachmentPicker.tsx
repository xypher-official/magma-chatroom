import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Image as ImageIcon, FileText, Music, Video, X, Loader2, MoreHorizontal, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type SentKind = "image" | "audio" | "video" | "file" | "watch";
import WatchTogetherSetup from "./WatchTogetherSetup";
import { Tv } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  myUserId: string;
  onSend: (text: string, url: string, kind: SentKind, name: string) => void;
  conversationId?: string | null;
  groupId?: string | null;
}

interface Recent { name: string; url: string }

const kindOf = (file: File): SentKind =>
  file.type.startsWith("image") ? "image"
  : file.type.startsWith("video") ? "video"
  : file.type.startsWith("audio") ? "audio"
  : "file";

const BUCKET = "social-media";

const AttachmentPicker = ({ open, onClose, myUserId, onSend, conversationId, groupId }: Props) => {
  const [tab, setTab] = useState<"photos" | "files">("photos");
  const [recent, setRecent] = useState<Recent[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [watch, setWatch] = useState(false);
  const imgInput = useRef<HTMLInputElement>(null);
  const camInput = useRef<HTMLInputElement>(null);
  const anyInput = useRef<HTMLInputElement>(null);

  const prefix = `chat/${myUserId}`;

  const loadRecent = async () => {
    setLoading(true);
    const { data } = await supabase.storage.from(BUCKET).list(prefix, {
      limit: 60, sortBy: { column: "created_at", order: "desc" },
    });
    const items = (data ?? [])
      .filter((f) => f.name && !f.name.startsWith("."))
      .map((f) => ({
        name: f.name,
        url: supabase.storage.from(BUCKET).getPublicUrl(`${prefix}/${f.name}`).data.publicUrl,
      }));
    setRecent(items);
    setLoading(false);
  };

  useEffect(() => { if (open) loadRecent(); }, [open, myUserId]);

  const upload = async (file: File) => {
    const kind = kindOf(file);
    if (file.size > 40 * 1024 * 1024) { toast.error("Máximo 40 MB por archivo"); return; }
    setBusy(true);
    try {
      const safe = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${prefix}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (error) throw error;
      const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      const label = kind === "image" ? "🖼️" : kind === "video" ? "🎬" : kind === "audio" ? "🎵" : "📄";
      onSend(`${label} ${file.name}`, url, kind, file.name);
      onClose();
    } catch (e: any) { toast.error(e.message ?? "Error al subir"); }
    finally { setBusy(false); }
  };

  const pickFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const f of Array.from(files).slice(0, 6)) await upload(f);
  };

  const isImageName = (n: string) => /\.(png|jpe?g|webp|gif|avif|bmp|heic)$/i.test(n);
  const photos = recent.filter((r) => isImageName(r.name));
  const others = recent.filter((r) => !isImageName(r.name));
  const list = tab === "photos" ? photos : others;

  const tile = "flex flex-col items-center justify-center gap-1.5 rounded-2xl glass-panel-strong py-4 text-[11px] text-muted-foreground active:scale-95 transition-transform";

  return (
    <>
    {watch && (
      <WatchTogetherSetup myUserId={myUserId} conversationId={conversationId} groupId={groupId}
        onClose={() => setWatch(false)}
        onCreated={(id, title) => {
          setWatch(false);
          onSend(`🎬 Watch Together: ${title}`, `/watch/${id}`, "watch", title);
          onClose();
          window.open(`/watch/${id}`, "_self");
        }} />
    )}
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end sm:items-center sm:justify-center"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ y: "100%", opacity: 0.6, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="relative w-full sm:max-w-lg max-h-[88vh] rounded-t-3xl sm:rounded-3xl glass-panel border-t sm:border border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] overflow-y-auto scrollbar-magma"
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-muted sm:hidden" />
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Enviar contenido</h3>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted text-muted-foreground"><X size={16} /></button>
            </div>

            <button onClick={() => setWatch(true)} className="w-full mb-3 flex items-center gap-3 rounded-2xl magma-gradient px-4 py-3 text-left text-primary-foreground active:scale-[0.98] transition-transform">
              <Tv size={22} /><span><span className="block text-sm font-semibold">Watch Together</span><span className="block text-[11px] opacity-80">YouTube, URL, tu dispositivo o embed — en tiempo real</span></span>
            </button>
            <div className="grid grid-cols-4 gap-2 mb-4">
              <button className={tile} onClick={() => camInput.current?.click()}>
                <Camera size={20} className="text-primary" /> Cámara
              </button>
              <button className={tile} onClick={() => imgInput.current?.click()}>
                <ImageIcon size={20} className="text-emerald-400" /> Galería
              </button>
              <button className={tile} onClick={() => anyInput.current?.click()}>
                <FileText size={20} className="text-sky-400" /> Archivo
              </button>
              <button className={tile} onClick={() => setTab(tab === "photos" ? "files" : "photos")}>
                <MoreHorizontal size={20} className="text-amber-400" /> {tab === "photos" ? "More" : "Fotos"}
              </button>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <div className="flex rounded-xl bg-muted p-1 text-xs">
                {(["photos", "files"] as const).map((k) => (
                  <button key={k} onClick={() => setTab(k)}
                    className={`px-3 py-1.5 rounded-lg transition-colors ${tab === k ? "magma-gradient text-primary-foreground" : "text-muted-foreground"}`}>
                    {k === "photos" ? "Tus fotos" : "Tus archivos"}
                  </button>
                ))}
              </div>
              {(loading || busy) && <Loader2 size={14} className="animate-spin text-primary" />}
            </div>

            {list.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                <Upload size={22} className="mx-auto mb-2 opacity-50" />
                {tab === "photos" ? "Todavía no tienes fotos aquí. Sube una desde Galería." : "Sin archivos recientes. Toca Archivo para subir uno."}
              </div>
            ) : tab === "photos" ? (
              <div className="grid grid-cols-3 gap-2">
                {list.map((p) => (
                  <motion.button key={p.url} whileTap={{ scale: 0.95 }}
                    onClick={() => { onSend("🖼️", p.url, "image", p.name); onClose(); }}
                    className="relative aspect-square rounded-xl overflow-hidden border border-border">
                    <img src={p.url} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                  </motion.button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {list.map((f) => {
                  const isVid = /\.(mp4|webm|mov|mkv)$/i.test(f.name);
                  const isAud = /\.(mp3|wav|ogg|m4a|webm)$/i.test(f.name);
                  const Icon = isVid ? Video : isAud ? Music : FileText;
                  return (
                    <button key={f.url}
                      onClick={() => { onSend(`📄 ${f.name}`, f.url, isVid ? "video" : isAud ? "audio" : "file", f.name); onClose(); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl glass-panel-strong text-left active:scale-[0.98] transition-transform">
                      <Icon size={18} className="text-primary shrink-0" />
                      <span className="text-xs text-foreground truncate">{f.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <input ref={camInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pickFiles(e.target.files)} />
            <input ref={imgInput} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => pickFiles(e.target.files)} />
            <input ref={anyInput} type="file" multiple hidden onChange={(e) => pickFiles(e.target.files)} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
};

export default AttachmentPicker;
