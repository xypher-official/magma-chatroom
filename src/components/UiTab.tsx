import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Save, Palette, Type, FilePlus, Trash2, icons as LucideIcons, ShieldAlert, Wrench, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Setting { key: string; value: string }
interface Page { id: string; slug: string; title: string; content: string; emoji: string; icon: string; enabled: boolean; position: number }

const UiTab = () => {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [newKey, setNewKey] = useState(""); const [newVal, setNewVal] = useState("");
  const [newPage, setNewPage] = useState({ slug: "", title: "", emoji: "📄", icon: "FileText" });

  const reload = () => {
    supabase.from("ui_settings").select("*").order("key").then(({ data }) => setSettings((data ?? []) as Setting[]));
    supabase.from("site_pages").select("*").order("position").then(({ data }) => setPages((data ?? []) as Page[]));
  };
  useEffect(() => { reload(); }, []);

  const saveSetting = async (s: Setting) => {
    const { error } = await supabase.from("ui_settings").upsert({ key: s.key, value: s.value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) toast.error(error.message); else toast.success(`✅ ${s.key} guardado`);
  };
  const addSetting = async () => {
    if (!newKey.trim()) return;
    const { error } = await supabase.from("ui_settings").upsert({ key: newKey.trim(), value: newVal }, { onConflict: "key" });
    if (error) toast.error(error.message); else { toast.success("✅ Token agregado"); setNewKey(""); setNewVal(""); reload(); }
  };
  const delSetting = async (key: string) => {
    if (!confirm(`¿Borrar token "${key}"?`)) return;
    await supabase.from("ui_settings").delete().eq("key", key);
    reload();
  };

  const savePage = async (p: Page) => {
    const { error } = await supabase.from("site_pages").update({
      slug: p.slug, title: p.title, content: p.content, emoji: p.emoji, icon: p.icon, enabled: p.enabled, position: p.position, updated_at: new Date().toISOString(),
    }).eq("id", p.id);
    if (error) toast.error(error.message); else toast.success(`✅ Página "${p.slug}" guardada`);
  };
  const addPage = async () => {
    if (!newPage.slug.trim()) return;
    const { error } = await supabase.from("site_pages").insert({ ...newPage, content: "" });
    if (error) toast.error(error.message); else { toast.success("✅ Página creada"); setNewPage({ slug: "", title: "", emoji: "📄", icon: "FileText" }); reload(); }
  };
  const delPage = async (id: string) => {
    if (!confirm("¿Borrar página?")) return;
    await supabase.from("site_pages").delete().eq("id", id);
    reload();
  };

  const iconExists = (name: string) => !!(LucideIcons as any)[name];

  const currentMode = (settings.find((s) => s.key === "site.mode")?.value ?? "").toLowerCase();
  const setMode = async (mode: string) => {
    const { error } = await supabase.from("ui_settings").upsert(
      { key: "site.mode", value: mode, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) toast.error(error.message);
    else { toast.success(mode ? `🌋 Modo "${mode}" activado` : "✅ Modo normal"); reload(); }
  };

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 text-foreground">
          <ShieldAlert size={16} className="text-primary" /> Modo del sitio
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {([
            ["", "Público", Globe, "from-emerald-500 to-teal-500"],
            ["private", "Privado", ShieldAlert, "from-amber-500 to-orange-600"],
            ["maintenance", "Mantenimiento", Wrench, "from-rose-500 to-red-700"],
          ] as const).map(([val, label, Icon, grad]) => (
            <button key={val || "public"} onClick={() => setMode(val)}
              className={`p-3 rounded-xl border text-left transition-all ${
                currentMode === val ? `border-primary bg-gradient-to-br ${grad} text-white shadow-lg` : "border-border bg-muted/30 hover:border-primary/40"
              }`}>
              <Icon size={16} className="mb-1" />
              <p className="text-xs font-bold">{label}</p>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
          <strong>Privado:</strong> oculta secciones y solo permite chats con tus contactos.<br/>
          <strong>Mantenimiento:</strong> bloquea el sitio para todos excepto admins.
        </p>
      </section>

      <section>
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 text-foreground">
          <Palette size={16} className="text-primary" /> Tema (HSL)
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {settings.filter((s) => s.key.startsWith("theme.")).map((s, i) => (
            <div key={s.key} className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-mono text-muted-foreground">{s.key}</p>
              <input value={s.value} placeholder="ej: 24 100% 50%"
                onChange={(e) => setSettings(settings.map((x, j) => x.key === s.key ? { ...x, value: e.target.value } : x))}
                className="w-full px-2 py-1.5 rounded-lg bg-input border border-border text-foreground text-xs outline-none" />
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-md border border-border" style={{ background: `hsl(${s.value})` }} />
                <button onClick={() => saveSetting(s)} className="flex-1 text-xs py-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 flex items-center justify-center gap-1">
                  <Save size={12} /> Guardar
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 text-foreground">
          <Type size={16} className="text-primary" /> Textos UI / Placeholders
        </h3>
        <div className="space-y-2">
          {settings.filter((s) => !s.key.startsWith("theme.")).map((s) => (
            <div key={s.key} className="flex gap-2 items-center">
              <span className="text-xs font-mono text-muted-foreground w-40 truncate" title={s.key}>{s.key}</span>
              <input value={s.value}
                onChange={(e) => setSettings(settings.map((x) => x.key === s.key ? { ...x, value: e.target.value } : x))}
                className="flex-1 px-2 py-1.5 rounded-lg bg-input border border-border text-foreground text-xs outline-none" />
              <button onClick={() => saveSetting(s)} className="p-1.5 rounded-lg bg-primary/15 text-primary hover:bg-primary/25"><Save size={12} /></button>
              <button onClick={() => delSetting(s.key)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"><Trash2 size={12} /></button>
            </div>
          ))}
          <div className="flex gap-2 items-center pt-2 border-t border-border">
            <input placeholder="nueva.clave" value={newKey} onChange={(e) => setNewKey(e.target.value)}
              className="w-40 px-2 py-1.5 rounded-lg bg-input border border-border text-foreground text-xs outline-none" />
            <input placeholder="valor" value={newVal} onChange={(e) => setNewVal(e.target.value)}
              className="flex-1 px-2 py-1.5 rounded-lg bg-input border border-border text-foreground text-xs outline-none" />
            <button onClick={addSetting} className="px-3 py-1.5 rounded-lg magma-gradient text-primary-foreground text-xs">Agregar</button>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 text-foreground">
          <FilePlus size={16} className="text-primary" /> Páginas del sitio (menú ☰)
        </h3>
        <div className="space-y-3">
          {pages.map((p, i) => (
            <div key={p.id} className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex gap-2 items-center">
                <input value={p.emoji} maxLength={2} title="Emoji"
                  onChange={(e) => setPages(pages.map((x, j) => j === i ? { ...x, emoji: e.target.value } : x))}
                  className="w-12 text-center px-2 py-1.5 rounded-lg bg-input border border-border text-base" />
                <input value={p.icon} placeholder="Ícono lucide (ej: FileText)" title="Ícono lucide"
                  onChange={(e) => setPages(pages.map((x, j) => j === i ? { ...x, icon: e.target.value } : x))}
                  className={`w-40 px-2 py-1.5 rounded-lg bg-input border text-xs outline-none ${iconExists(p.icon) ? "border-border" : "border-destructive/50"}`} />
                <input value={p.slug} placeholder="slug"
                  onChange={(e) => setPages(pages.map((x, j) => j === i ? { ...x, slug: e.target.value } : x))}
                  className="flex-1 px-2 py-1.5 rounded-lg bg-input border border-border text-xs outline-none" />
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={p.enabled}
                  onChange={(e) => setPages(pages.map((x, j) => j === i ? { ...x, enabled: e.target.checked } : x))} />pub</label>
              </div>
              <input value={p.title} placeholder="Título"
                onChange={(e) => setPages(pages.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                className="w-full px-2 py-1.5 rounded-lg bg-input border border-border text-sm outline-none" />
              <textarea value={p.content} rows={4} placeholder="Markdown + HTML básico (h1-h3, p, ul, a, img, strong, em)"
                onChange={(e) => setPages(pages.map((x, j) => j === i ? { ...x, content: e.target.value } : x))}
                className="w-full px-2 py-1.5 rounded-lg bg-input border border-border text-xs outline-none font-mono resize-none" />
              <div className="flex gap-2">
                <button onClick={() => savePage(p)} className="flex-1 py-1.5 rounded-lg bg-primary/15 text-primary text-xs flex items-center justify-center gap-1"><Save size={12} /> Guardar</button>
                <button onClick={() => delPage(p.id)} className="px-3 py-1.5 rounded-lg text-destructive bg-destructive/10 text-xs"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
          <div className="rounded-xl border border-dashed border-border p-3 space-y-2">
            <p className="text-xs text-muted-foreground">Nueva página</p>
            <div className="flex gap-2">
              <input value={newPage.emoji} onChange={(e) => setNewPage({ ...newPage, emoji: e.target.value })} className="w-12 text-center px-2 py-1.5 rounded-lg bg-input border border-border" />
              <input value={newPage.icon} placeholder="ícono" onChange={(e) => setNewPage({ ...newPage, icon: e.target.value })} className="w-32 px-2 py-1.5 rounded-lg bg-input border border-border text-xs" />
              <input value={newPage.slug} placeholder="slug-unico" onChange={(e) => setNewPage({ ...newPage, slug: e.target.value })} className="flex-1 px-2 py-1.5 rounded-lg bg-input border border-border text-xs" />
            </div>
            <input value={newPage.title} placeholder="Título" onChange={(e) => setNewPage({ ...newPage, title: e.target.value })} className="w-full px-2 py-1.5 rounded-lg bg-input border border-border text-sm" />
            <button onClick={addPage} className="w-full py-1.5 rounded-lg magma-gradient text-primary-foreground text-xs">Crear</button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default UiTab;
