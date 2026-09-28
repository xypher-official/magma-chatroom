import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Menu, X, Pencil, icons as LucideIcons } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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

interface Props { isAdmin?: boolean; onEditCms?: () => void; myUserId?: string; profiles?: Record<string, any> }

const IconByName = ({ name, size = 18 }: { name: string; size?: number }) => {
  const Cmp = (LucideIcons as any)[name] ?? LucideIcons.FileText;
  return <Cmp size={size} />;
};

const SitePagesMenu = ({ isAdmin, onEditCms }: Props) => {
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState<Page[]>([]);
  const navigate = useNavigate();
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

  const builtIn: Page[] = [
    { id: "__msocial_videos__", slug: "social/videos", title: "MSocialVideos", content: "", emoji: "🎬", icon: "Clapperboard", enabled: true, position: -1 },
    { id: "__magai__", slug: "magai", title: "MAGAI ASSISTANT 🤖", content: "", emoji: "🤖", icon: "Sparkles", enabled: true, position: -1 },
    { id: "__membership__", slug: "membership", title: "Membership 👑", content: "", emoji: "👑", icon: "Crown", enabled: true, position: -1 },
  ];
  const visible = [...builtIn, ...pages.filter((p) => p.enabled || isAdmin)];

  const goTo = (slug: string) => {
    setOpen(false);
    // Nested slugs (contain "/") route through /s/* to avoid collision with :slug
    if (slug.includes("/")) navigate(`/${slug}`);
    else navigate(`/${slug}`);
  };

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
                  onClick={() => goTo(p.slug)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl mb-1 transition-all border border-transparent hover:bg-muted ${!p.enabled ? "opacity-60" : ""}`}
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
        </motion.div>
      )}
    </>
  );
};

export default SitePagesMenu;
