import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Save, Megaphone, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Section { id: string; key: string; title: string; content: string; enabled: boolean }
interface Banner { enabled: boolean; message: string; link: string | null; color: string }

const COLORS = ["amber", "red", "sky", "emerald", "fuchsia"];

const CmsTab = () => {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("site_banner").select("*").eq("id", 1).maybeSingle()
      .then(({ data }) => data && setBanner(data as Banner));
    supabase.from("site_sections").select("*").order("key")
      .then(({ data }) => data && setSections(data as Section[]));
  }, []);

  const saveBanner = async () => {
    if (!banner) return;
    setSaving(true);
    const { error } = await supabase.from("site_banner")
      .update({ ...banner, updated_at: new Date().toISOString() }).eq("id", 1);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("📢 Banner actualizado");
  };

  const saveSection = async (s: Section) => {
    setSaving(true);
    const { error } = await supabase.from("site_sections")
      .update({ title: s.title, content: s.content, enabled: s.enabled, updated_at: new Date().toISOString() })
      .eq("id", s.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success(`✅ Sección "${s.key}" guardada`);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-muted/30 p-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 text-foreground">
          <Megaphone size={16} className="text-primary" /> Banner global del sitio
        </h3>
        {banner && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={banner.enabled} onChange={(e) => setBanner({ ...banner, enabled: e.target.checked })} />
              Mostrar banner a todos
            </label>
            <input
              type="text" value={banner.message}
              onChange={(e) => setBanner({ ...banner, message: e.target.value })}
              placeholder="Mensaje del banner…"
              className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/50"
            />
            <input
              type="text" value={banner.link ?? ""}
              onChange={(e) => setBanner({ ...banner, link: e.target.value })}
              placeholder="Link opcional (https://…)"
              className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm outline-none focus:ring-2 focus:ring-ring/50"
            />
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setBanner({ ...banner, color: c })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border ${banner.color === c ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  {c}
                </button>
              ))}
            </div>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={saveBanner} disabled={saving}
              className="w-full py-2.5 rounded-lg magma-gradient text-primary-foreground font-medium flex items-center justify-center gap-2 disabled:opacity-50">
              <Save size={14} /> Guardar banner
            </motion.button>
          </div>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 text-foreground">
          <FileText size={16} className="text-primary" /> Secciones del sitio
        </h3>
        <div className="space-y-3">
          {sections.map((s, i) => (
            <div key={s.id} className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-muted-foreground">#{s.key}</span>
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={s.enabled}
                    onChange={(e) => setSections(sections.map((x, j) => j === i ? { ...x, enabled: e.target.checked } : x))} />
                  activo
                </label>
              </div>
              <input
                type="text" value={s.title}
                onChange={(e) => setSections(sections.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                placeholder="Título"
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm outline-none"
              />
              <textarea
                value={s.content} rows={3}
                onChange={(e) => setSections(sections.map((x, j) => j === i ? { ...x, content: e.target.value } : x))}
                placeholder="Contenido (markdown permitido)"
                className="w-full px-3 py-2 rounded-lg bg-input border border-border text-foreground text-sm outline-none resize-none"
              />
              <button onClick={() => saveSection(s)} disabled={saving}
                className="w-full py-2 rounded-lg bg-primary/15 text-primary text-sm font-medium hover:bg-primary/25 transition-colors flex items-center justify-center gap-2">
                <Save size={14} /> Guardar
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default CmsTab;
