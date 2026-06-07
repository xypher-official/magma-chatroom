import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Menu, X, Pencil, icons as LucideIcons } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DOMPurify from "dompurify";
import { useAutoTranslate } from "@/hooks/useAutoTranslate";
import { T } from "./T";
import { useUiSettings } from "@/hooks/useUiSettings";

interface Page {
  id: string;
  slug: string;
  title: string;
  content: string;
  emoji: string;
  icon: string;
  enabled: boolean;
  position: number;
}

interface Props { isAdmin?: boolean; onEditCms?: () => void }

const ALLOWED_TAGS = ["h1","h2","h3","h4","h5","h6","p","strong","em","ul","ol","li","a","img","blockquote","code","pre","br","hr","span","div","section","article","header","footer","button","figure","figcaption","table","thead","tbody","tr","td","th","iframe","video","source"];
const ALLOWED_ATTR = ["href","target","rel","src","alt","title","class","style","width","height","loading","srcset","sizes","allow","allowfullscreen","frameborder"];

const renderHtml = (raw: string) => {
  const trimmed = (raw ?? "").trim();
  // If content already looks like HTML, sanitize and render directly.
  if (/^\s*<[a-zA-Z!]/.test(trimmed)) {
    return DOMPurify.sanitize(trimmed, { ALLOWED_TAGS, ALLOWED_ATTR });
  }
  // Otherwise do a tiny markdown -> html pass.
  let html = trimmed
    .replace(/^### (.*)$/gm, "<h3>$1</h3>")
    .replace(/^## (.*)$/gm, "<h2>$1</h2>")
    .replace(/^# (.*)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n\n/g, "</p><p>");
  if (!/^<h\d|^<p|^<ul|^<ol|^<blockquote/.test(html)) html = `<p>${html}</p>`;
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
};

const IconByName = ({ name, size = 18 }: { name: string; size?: number }) => {
  const Cmp = (LucideIcons as any)[name] ?? LucideIcons.FileText;
  return <Cmp size={size} />;
};

const SitePagesMenu = ({ isAdmin, onEditCms }: Props) => {
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState<Page[]>([]);
  const [active, setActive] = useState<Page | null>(null);
  const { t } = useUiSettings();
  const position = (t("pages.menu.position", "top-left") || "top-left").toLowerCase();
  const posClass =
    position === "top-right" ? "top-3 right-3" :
    position === "bottom-left" ? "bottom-3 left-3" :
    position === "bottom-right" ? "bottom-3 right-3" :
    "top-3 left-3";

  useEffect(() => {
    const load = () => supabase.from("site_pages").select("*").order("position", { ascending: true })
      .then(({ data }) => setPages((data ?? []) as Page[]));
    load();
    const ch = supabase.channel("site-pages-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_pages" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const visible = pages.filter((p) => p.enabled || isAdmin);

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
        onClick={() => setOpen(true)}
        title="Secciones del sitio"
        className={`fixed ${posClass} z-40 p-2.5 rounded-xl glass-panel-strong text-foreground hover:text-primary magma-glow-sm`}
      >
        <Menu size={18} />
      </motion.button>

      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 bg-background/70 backdrop-blur-md flex"
        >
          <motion.aside
            initial={{ x: -340 }} animate={{ x: 0 }} exit={{ x: -340 }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-[320px] max-w-[85vw] h-full bg-card border-r border-border flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/10 to-accent/10">
              <h2 className="text-sm font-bold magma-gradient-text">Secciones del sitio</h2>
              <div className="flex gap-1">
                {isAdmin && (
                  <button onClick={() => { setOpen(false); onEditCms?.(); }} title="Editar en panel"
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary">
                    <Pencil size={16} />
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-magma p-2">
              {visible.length === 0 && (
                <p className="text-center text-xs text-muted-foreground p-6">
                  No hay secciones todavía. {isAdmin && "Crea una desde el panel admin → Sitio."}
                </p>
              )}
              {visible.map((p, i) => (
                <motion.button
                  key={p.id}
                  initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  onClick={() => setActive(p)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl mb-1 transition-all border ${
                    active?.id === p.id ? "bg-primary/15 border-primary/30" : "border-transparent hover:bg-muted"
                  } ${!p.enabled ? "opacity-60" : ""}`}
                >
                  <div className="w-9 h-9 rounded-lg magma-gradient flex items-center justify-center text-primary-foreground text-base shrink-0">
                    {p.emoji}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                      <IconByName name={p.icon} size={13} />
                      <T>{p.title || p.slug}</T>
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">/{p.slug}{!p.enabled && " · oculto"}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.aside>

          {active && (
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 h-full overflow-y-auto scrollbar-magma p-6 md:p-10"
            >
              <ActivePageContent page={active} />
            </motion.div>
          )}
        </motion.div>
      )}
    </>
  );
};

const ActivePageContent = ({ page }: { page: Page }) => {
  const translatedTitle = useAutoTranslate(page.title);
  const translatedContent = useAutoTranslate(page.content);
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-2xl magma-gradient flex items-center justify-center text-2xl">{page.emoji}</div>
        <h1 className="text-2xl md:text-3xl font-bold magma-gradient-text">{translatedTitle || page.title}</h1>
      </div>
      <article
        className="prose prose-invert prose-sm md:prose-base max-w-none text-foreground"
        dangerouslySetInnerHTML={{ __html: renderHtml(translatedContent || page.content) }}
      />
    </div>
  );
};

export default SitePagesMenu;
