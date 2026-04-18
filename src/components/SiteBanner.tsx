import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Banner { enabled: boolean; message: string; link: string | null; color: string }

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
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }}
          className={`relative z-30 px-4 py-2 text-white text-sm font-medium bg-gradient-to-r ${colorMap[banner!.color] ?? colorMap.amber} flex items-center justify-center gap-3 shadow-lg`}
        >
          <Megaphone size={16} className="shrink-0" />
          {banner!.link ? (
            <a href={banner!.link} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:opacity-90 truncate">
              {banner!.message}
            </a>
          ) : (
            <span className="truncate">{banner!.message}</span>
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
