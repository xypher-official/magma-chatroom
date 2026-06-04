import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Icons from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { T } from "./T";

interface Banner { enabled: boolean; message: string; link: string | null; color: string; cta_label?: string; icon?: string; position?: string }

const colorMap: Record<string, string> = {
  amber: "from-amber-500 to-orange-600",
  red: "from-red-500 to-rose-700",
  sky: "from-sky-500 to-blue-700",
  emerald: "from-emerald-500 to-teal-700",
  fuchsia: "from-fuchsia-500 to-purple-700",
};

const SiteBanner = () => {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const load = () => supabase.from("site_banner").select("*").eq("id", 1).maybeSingle()
      .then(({ data }) => data && setBanner(data as Banner));
    load();
    const ch = supabase.channel("banner-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_banner" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const visible = banner?.enabled && banner.message && !dismissed;
  const IconCmp = (banner?.icon && (Icons as any)[banner.icon]) || Icons.Megaphone;
  const X = Icons.X;
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }}
          className={`relative z-30 px-4 py-2 text-white text-sm font-medium bg-gradient-to-r ${colorMap[banner!.color] ?? colorMap.amber} flex items-center justify-center gap-3 shadow-lg`}
        >
          <IconCmp size={16} className="shrink-0" />
          <T className="truncate">{banner!.message}</T>
          {banner!.link && (
            <a href={banner!.link} target={banner!.link.startsWith("http") ? "_blank" : undefined} rel="noreferrer"
              className="ml-2 px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 text-xs font-bold backdrop-blur transition-colors shrink-0">
              <T>{banner!.cta_label || "Open"}</T> →
            </a>
          )}
          <button onClick={() => setDismissed(true)} className="ml-auto p-1 rounded hover:bg-white/20" aria-label="Cerrar">
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SiteBanner;
